// HTTP-layer tests for the mint-claim-code Edge Function.
//
// Acceptance coverage (tb-WF-13):
//   * mint success — a single-use, ~30-min-TTL, 8-char unambiguous code
//     is minted from the caller's live web session and the encrypted
//     refresh token is stored.
//   * unauthed-caller rejection — no / bad / expired JWT → 401, no row.
//   * code uniqueness — a PK collision on the first attempt is retried
//     with a fresh code; the keyspace draw is unambiguous.

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  CLAIM_CODE_TTL_MS,
  type InsertResult,
  type MintClaimCodeDeps,
  type MintClaimCodeEnv,
  handleRequest,
} from "./handler.ts";
import {
  CLAIM_CODE_ALPHABET,
  CLAIM_CODE_LENGTH,
  decryptToken,
} from "../_shared/claim-code.ts";
import { withMutedConsole } from "../_shared/test-console.ts";

// A valid 32-byte base64 AES-GCM key for the test env.
const TEST_ENC_KEY = "tra6MS8XlmiBodn9NKnRdgEI1ohXtHTkbgnDJZkeaik=";

function envOk(): MintClaimCodeEnv {
  return {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    CLAIM_CODE_ENC_KEY: TEST_ENC_KEY,
  };
}

/** Default deps — auth resolves to a fixed user, insert always succeeds.
 *  Tests override individual fields. */
function depsOk(
  overrides: Partial<MintClaimCodeDeps> = {},
): MintClaimCodeDeps {
  return {
    env: envOk(),
    resolveCaller: () =>
      Promise.resolve("11111111-1111-1111-1111-111111111111"),
    insertCode: () => Promise.resolve<InsertResult>({ ok: true }),
    ...overrides,
  };
}

function mintRequest(
  body: unknown = { refresh_token: "v1.rt_webtoken" },
  headers: Record<string, string> = { Authorization: "Bearer valid-jwt" },
): Request {
  return new Request("https://example/mint-claim-code", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// ── Method gating ──────────────────────────────────────────────────

Deno.test("OPTIONS returns 204 with CORS headers", async () => {
  const res = await handleRequest(
    new Request("https://example/mint-claim-code", { method: "OPTIONS" }),
    depsOk(),
  );
  assertEquals(res.status, 204);
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods")?.includes("POST"),
    true,
  );
});

Deno.test("GET returns 405 method_not_allowed", async () => {
  const res = await handleRequest(
    new Request("https://example/mint-claim-code", { method: "GET" }),
    depsOk(),
  );
  assertEquals(res.status, 405);
  assertEquals((await res.json()).error, "method_not_allowed");
});

// ── Unauthed-caller rejection ──────────────────────────────────────

Deno.test("missing Authorization header returns 401 — no row written", async () => {
  let inserted = false;
  const res = await handleRequest(
    mintRequest(undefined, {}),
    depsOk({
      insertCode: () => {
        inserted = true;
        return Promise.resolve<InsertResult>({ ok: true });
      },
    }),
  );
  assertEquals(res.status, 401);
  assert(!inserted, "no claim_codes row may be written for an unauthed call");
});

Deno.test("non-Bearer Authorization returns 401", async () => {
  const res = await handleRequest(
    mintRequest(undefined, { Authorization: "Basic abc123" }),
    depsOk(),
  );
  assertEquals(res.status, 401);
});

Deno.test("empty Bearer token returns 401", async () => {
  const res = await handleRequest(
    mintRequest(undefined, { Authorization: "Bearer " }),
    depsOk(),
  );
  assertEquals(res.status, 401);
});

Deno.test("resolveCaller returning null (expired/invalid JWT) returns 401 — no row", async () => {
  let inserted = false;
  const res = await handleRequest(
    mintRequest(),
    depsOk({
      resolveCaller: () => Promise.resolve(null),
      insertCode: () => {
        inserted = true;
        return Promise.resolve<InsertResult>({ ok: true });
      },
    }),
  );
  assertEquals(res.status, 401);
  assert(!inserted, "an unresolved JWT must not write a row");
});

Deno.test("resolveCaller throwing returns 401 unauthorized", async () => {
  await withMutedConsole(["error"], async () => {
    const res = await handleRequest(
      mintRequest(),
      depsOk({
        resolveCaller: () => Promise.reject(new Error("auth service down")),
      }),
    );
    assertEquals(res.status, 401);
  });
});

// ── Config gating ──────────────────────────────────────────────────

Deno.test("missing service-role env returns 500 misconfigured", async () => {
  await withMutedConsole(["error"], async () => {
    const res = await handleRequest(
      mintRequest(),
      depsOk({
        env: {
          SUPABASE_URL: "https://example.supabase.co",
          CLAIM_CODE_ENC_KEY: TEST_ENC_KEY,
        },
      }),
    );
    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, "mint_claim_code_misconfigured");
  });
});

Deno.test("missing encryption key returns 500 misconfigured", async () => {
  await withMutedConsole(["error"], async () => {
    const res = await handleRequest(
      mintRequest(),
      depsOk({
        env: {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
        },
      }),
    );
    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, "mint_claim_code_misconfigured");
  });
});

// ── Body validation ────────────────────────────────────────────────

Deno.test("missing refresh_token in body returns 400", async () => {
  const res = await handleRequest(
    mintRequest({}),
    depsOk(),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "missing_refresh_token");
});

Deno.test("non-string refresh_token returns 400", async () => {
  const res = await handleRequest(
    mintRequest({ refresh_token: 12345 }),
    depsOk(),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "missing_refresh_token");
});

// ── Mint success ───────────────────────────────────────────────────

Deno.test("happy path — mints an 8-char unambiguous code with a ~30-min TTL", async () => {
  const storedRows: Array<{
    code: string;
    encryptedToken: string;
    userId: string;
    expiresAt: string;
  }> = [];
  const fixedNow = Date.UTC(2026, 4, 21, 12, 0, 0);
  const res = await handleRequest(
    mintRequest(),
    depsOk({
      now: () => fixedNow,
      insertCode: (_env, row) => {
        storedRows.push(row);
        return Promise.resolve<InsertResult>({ ok: true });
      },
    }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.status, "ok");

  // 8 characters, every one from the unambiguous alphabet.
  assertEquals(body.code.length, CLAIM_CODE_LENGTH);
  for (const ch of body.code as string) {
    assert(
      CLAIM_CODE_ALPHABET.includes(ch),
      `minted code char '${ch}' is not in the unambiguous alphabet`,
    );
  }

  // ~30-minute TTL — expires_at is exactly TTL after the pinned now().
  assertEquals(
    body.expires_at,
    new Date(fixedNow + CLAIM_CODE_TTL_MS).toISOString(),
  );
  assertEquals(CLAIM_CODE_TTL_MS, 30 * 60 * 1000);

  // The stored row carries the same code + expiry.
  assertEquals(storedRows.length, 1);
  assertEquals(storedRows[0].code, body.code);
  assertEquals(storedRows[0].expiresAt, body.expires_at);
});

Deno.test("happy path — the stored token is encrypted, decrypts to the caller's refresh token", async () => {
  let storedEncrypted = "";
  const res = await handleRequest(
    mintRequest({ refresh_token: "v1.rt_the_real_web_token" }),
    depsOk({
      insertCode: (_env, row) => {
        storedEncrypted = row.encryptedToken;
        return Promise.resolve<InsertResult>({ ok: true });
      },
    }),
  );
  assertEquals(res.status, 200);
  // The stored value must NOT be the plaintext token.
  assert(!storedEncrypted.includes("v1.rt_the_real_web_token"));
  // It must decrypt back to the original under the env key.
  const recovered = await decryptToken(storedEncrypted, TEST_ENC_KEY);
  assertEquals(recovered, "v1.rt_the_real_web_token");
});

Deno.test("happy path — the stored user_id is the JWT-resolved id, never from the body", async () => {
  const callerId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const victimId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  let storedUserId = "";
  const res = await handleRequest(
    // A malicious caller tries to plant someone else's id in the body.
    mintRequest({ refresh_token: "v1.rt_x", user_id: victimId }),
    depsOk({
      resolveCaller: () => Promise.resolve(callerId),
      insertCode: (_env, row) => {
        storedUserId = row.userId;
        return Promise.resolve<InsertResult>({ ok: true });
      },
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(storedUserId, callerId);
  assert(storedUserId !== victimId, "body-supplied user_id must be ignored");
});

// ── Code uniqueness — collision retry ──────────────────────────────

Deno.test("a PK collision on the first attempt is retried with a fresh code", async () => {
  const codes = ["AAAAAAAA", "BBBBBBBB", "CCCCCCCC"];
  let codeIndex = 0;
  const attempted: string[] = [];
  const res = await handleRequest(
    mintRequest(),
    depsOk({
      makeCode: () => codes[codeIndex++],
      insertCode: (_env, row) => {
        attempted.push(row.code);
        // First code collides; the second succeeds.
        return Promise.resolve<InsertResult>(
          attempted.length === 1
            ? { ok: false, collision: true }
            : { ok: true },
        );
      },
    }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  // The retry minted the second code, not the collided first one.
  assertEquals(attempted, ["AAAAAAAA", "BBBBBBBB"]);
  assertEquals(body.code, "BBBBBBBB");
});

Deno.test("persistent PK collisions exhaust the retry budget and return 500", async () => {
  await withMutedConsole(["error"], async () => {
    let attempts = 0;
    const res = await handleRequest(
      mintRequest(),
      depsOk({
        insertCode: () => {
          attempts++;
          return Promise.resolve<InsertResult>({ ok: false, collision: true });
        },
      }),
    );
    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, "mint_claim_code_failed");
    // The handler retried several times before giving up.
    assert(attempts >= 5, `expected >= 5 attempts, got ${attempts}`);
  });
});

Deno.test("two successive mints from the same caller yield distinct codes (re-mintable)", async () => {
  const minted = new Set<string>();
  for (let i = 0; i < 2; i++) {
    const res = await handleRequest(mintRequest(), depsOk());
    assertEquals(res.status, 200);
    minted.add((await res.json()).code);
  }
  assertEquals(minted.size, 2, "a fresh call must yield a fresh code");
});

// ── Transport-failure handling ─────────────────────────────────────

Deno.test("an insert transport failure returns 500 mint_claim_code_failed", async () => {
  await withMutedConsole(["error"], async () => {
    const res = await handleRequest(
      mintRequest(),
      depsOk({
        insertCode: () => Promise.reject(new Error("db unreachable")),
      }),
    );
    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, "mint_claim_code_failed");
  });
});

Deno.test("response sets Content-Type application/json", async () => {
  const res = await handleRequest(mintRequest(), depsOk());
  assertStringIncludes(
    res.headers.get("Content-Type") ?? "",
    "application/json",
  );
});
