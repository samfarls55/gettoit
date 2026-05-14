// HTTP-layer tests for the delete-user Edge Function.
// Covers method gating, auth gating, config gating, and the security
// invariant that the caller can only delete themselves (the request
// body is never trusted for identity).

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type DeleteUserDeps,
  type DeleteUserEnv,
  handleRequest,
} from "./handler.ts";

function envOk(): DeleteUserEnv {
  return {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  };
}

function depsOk(overrides: Partial<DeleteUserDeps> = {}): DeleteUserDeps {
  return {
    env: envOk(),
    resolveCaller: () => Promise.resolve("11111111-1111-1111-1111-111111111111"),
    deleteUser: () => Promise.resolve(true),
    ...overrides,
  };
}

Deno.test("OPTIONS returns 204 with CORS headers", async () => {
  const res = await handleRequest(
    new Request("https://example/delete-user", { method: "OPTIONS" }),
    depsOk(),
  );
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Methods")?.includes("POST"), true);
});

Deno.test("GET returns 405 method_not_allowed", async () => {
  const res = await handleRequest(
    new Request("https://example/delete-user", { method: "GET" }),
    depsOk(),
  );
  assertEquals(res.status, 405);
  const body = await res.json();
  assertEquals(body.error, "method_not_allowed");
});

Deno.test("missing Authorization header returns 401", async () => {
  const res = await handleRequest(
    new Request("https://example/delete-user", { method: "POST" }),
    depsOk(),
  );
  assertEquals(res.status, 401);
});

Deno.test("non-Bearer Authorization returns 401", async () => {
  const res = await handleRequest(
    new Request("https://example/delete-user", {
      method: "POST",
      headers: { Authorization: "Basic abc123" },
    }),
    depsOk(),
  );
  assertEquals(res.status, 401);
});

Deno.test("empty Bearer token returns 401", async () => {
  const res = await handleRequest(
    new Request("https://example/delete-user", {
      method: "POST",
      headers: { Authorization: "Bearer " },
    }),
    depsOk(),
  );
  assertEquals(res.status, 401);
});

Deno.test("missing service-role env returns 500 misconfigured", async () => {
  const res = await handleRequest(
    new Request("https://example/delete-user", {
      method: "POST",
      headers: { Authorization: "Bearer jwt-x" },
    }),
    depsOk({ env: { SUPABASE_URL: "https://example.supabase.co" } }),
  );
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "delete_user_misconfigured");
});

Deno.test("resolveCaller returning null returns 401 unauthorized", async () => {
  const res = await handleRequest(
    new Request("https://example/delete-user", {
      method: "POST",
      headers: { Authorization: "Bearer invalid-jwt" },
    }),
    depsOk({ resolveCaller: () => Promise.resolve(null) }),
  );
  assertEquals(res.status, 401);
});

Deno.test("resolveCaller throwing returns 401 unauthorized", async () => {
  const res = await handleRequest(
    new Request("https://example/delete-user", {
      method: "POST",
      headers: { Authorization: "Bearer expired-jwt" },
    }),
    depsOk({
      resolveCaller: () => Promise.reject(new Error("expired")),
    }),
  );
  assertEquals(res.status, 401);
});

Deno.test("happy path returns 200 with the validated user_id", async () => {
  let observedUserId = "";
  const res = await handleRequest(
    new Request("https://example/delete-user", {
      method: "POST",
      headers: { Authorization: "Bearer valid-jwt" },
    }),
    depsOk({
      resolveCaller: () => Promise.resolve("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
      deleteUser: (_env, userId) => {
        observedUserId = userId;
        return Promise.resolve(true);
      },
    }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.status, "ok");
  assertEquals(body.user_id, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  assertEquals(body.existed, true);
  assertEquals(observedUserId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
});

Deno.test("happy path forwards existed=false when admin reports user_not_found", async () => {
  const res = await handleRequest(
    new Request("https://example/delete-user", {
      method: "POST",
      headers: { Authorization: "Bearer valid-jwt" },
    }),
    depsOk({
      deleteUser: () => Promise.resolve(false),
    }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.status, "ok");
  assertEquals(body.existed, false);
});

Deno.test("admin delete throwing returns 500 delete_user_failed", async () => {
  const res = await handleRequest(
    new Request("https://example/delete-user", {
      method: "POST",
      headers: { Authorization: "Bearer valid-jwt" },
    }),
    depsOk({
      deleteUser: () => Promise.reject(new Error("auth service down")),
    }),
  );
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "delete_user_failed");
});

// Security invariant: a body-supplied user_id MUST be ignored. The
// handler always deletes the user_id resolved from the JWT, never
// the one in the body. This test would catch a regression where a
// future change starts trusting the body.
Deno.test("body-supplied user_id is ignored — only the JWT-resolved id is deleted", async () => {
  const callerId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const victimId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  let actuallyDeleted = "";
  const res = await handleRequest(
    new Request("https://example/delete-user", {
      method: "POST",
      headers: {
        Authorization: "Bearer caller-jwt",
        "Content-Type": "application/json",
      },
      // A malicious caller tries to delete someone else by passing
      // their id in the body. The handler must ignore this entirely.
      body: JSON.stringify({ user_id: victimId, target: victimId }),
    }),
    depsOk({
      resolveCaller: () => Promise.resolve(callerId),
      deleteUser: (_env, userId) => {
        actuallyDeleted = userId;
        return Promise.resolve(true);
      },
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(actuallyDeleted, callerId);
  assert(actuallyDeleted !== victimId, "must not delete the body-supplied victim id");
  const body = await res.json();
  assertEquals(body.user_id, callerId);
});

Deno.test("response sets Content-Type application/json", async () => {
  const res = await handleRequest(
    new Request("https://example/delete-user", {
      method: "POST",
      headers: { Authorization: "Bearer valid-jwt" },
    }),
    depsOk(),
  );
  const ct = res.headers.get("Content-Type") ?? "";
  assertStringIncludes(ct, "application/json");
});
