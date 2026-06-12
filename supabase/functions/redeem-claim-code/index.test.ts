// HTTP-layer tests for the redeem-claim-code Edge Function.
//
// Acceptance coverage (tb-WF-14):
//   * redeem success — a valid, unredeemed, unexpired code is burned
//     single-use and the carried anonymous session's refresh token is
//     decrypted and returned.
//   * double-redeem rejection — a code already marked redeemed is
//     rejected and no second burn happens.
//   * expiry rejection — a code past its `expires_at` is rejected.
//   * unknown-code rejection — a structurally valid code with no row.
//   * malformed-code rejection — a code that fails the cheap
//     well-formedness pre-check is rejected before any DB round-trip.
//   * rate-limiting — once the injected limiter denies, the handler
//     returns 429 and never touches the database (guessing defense).
//
// The handler is pure: the DB lookup, the single-use burn, and the
// rate-limit decision are all dependency-injected, so every path is
// driven deterministically without a live Postgres or a real clock.

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  type ClaimCodeRow,
  handleRequest,
  type RedeemClaimCodeDeps,
  type RedeemClaimCodeEnv,
} from "./handler.ts";
import { encryptToken } from "../_shared/claim-code.ts";
import { withMutedConsole } from "../_shared/test-console.ts";

// A valid 32-byte base64 AES-GCM key for the test env. Same fixture
// key the mint-claim-code tests use.
const TEST_ENC_KEY = "tra6MS8XlmiBodn9NKnRdgEI1ohXtHTkbgnDJZkeaik=";

const VALID_CODE = "ABCD2345";
const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const FIXED_NOW = Date.UTC(2026, 4, 21, 12, 0, 0);

function envOk(): RedeemClaimCodeEnv {
  return {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    CLAIM_CODE_ENC_KEY: TEST_ENC_KEY,
  };
}

/** Build a `claim_codes` row for the fixtures. `refreshToken` is
 *  encrypted under the test key, mirroring what `mint-claim-code`
 *  stored. */
async function makeRow(
  overrides: Partial<Omit<ClaimCodeRow, "encryptedToken">> & {
    refreshToken?: string;
  } = {},
): Promise<ClaimCodeRow> {
  const refreshToken = overrides.refreshToken ?? "v1.rt_web_anon_token";
  return {
    code: overrides.code ?? VALID_CODE,
    encryptedToken: await encryptToken(refreshToken, TEST_ENC_KEY),
    userId: overrides.userId ?? CALLER_ID,
    // 30 minutes after the pinned now() — comfortably unexpired.
    expiresAt: overrides.expiresAt ??
      new Date(FIXED_NOW + 30 * 60 * 1000).toISOString(),
    redeemedAt: overrides.redeemedAt ?? null,
  };
}

/** Default deps — limiter allows, lookup finds an unredeemed row, the
 *  burn succeeds. Tests override individual fields. */
function depsOk(
  row: ClaimCodeRow,
  overrides: Partial<RedeemClaimCodeDeps> = {},
): RedeemClaimCodeDeps {
  return {
    env: envOk(),
    now: () => FIXED_NOW,
    checkRateLimit: () => ({ allowed: true }),
    lookupCode: () => Promise.resolve(row),
    // The burn is conditional: it returns `{ burned: true }` only when
    // the row was still unredeemed at burn time. The default always
    // succeeds; the double-redeem test overrides it.
    burnCode: () => Promise.resolve({ burned: true }),
    ...overrides,
  };
}

function redeemRequest(
  body: unknown = { code: VALID_CODE },
  method = "POST",
): Request {
  return new Request("https://example/redeem-claim-code", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

// ── Method gating ──────────────────────────────────────────────────

Deno.test("OPTIONS returns 204 with CORS headers", async () => {
  const res = await handleRequest(
    new Request("https://example/redeem-claim-code", { method: "OPTIONS" }),
    depsOk(await makeRow()),
  );
  assertEquals(res.status, 204);
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods")?.includes("POST"),
    true,
  );
});

Deno.test("GET returns 405 method_not_allowed", async () => {
  const res = await handleRequest(
    redeemRequest(undefined, "GET"),
    depsOk(await makeRow()),
  );
  assertEquals(res.status, 405);
  assertEquals((await res.json()).error, "method_not_allowed");
});

// ── Config gating ──────────────────────────────────────────────────

Deno.test("missing service-role env returns 500 misconfigured", async () => {
  await withMutedConsole(["error"], async () => {
    const res = await handleRequest(
      redeemRequest(),
      depsOk(await makeRow(), {
        env: {
          SUPABASE_URL: "https://example.supabase.co",
          CLAIM_CODE_ENC_KEY: TEST_ENC_KEY,
        },
      }),
    );
    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, "redeem_claim_code_misconfigured");
  });
});

Deno.test("missing encryption key returns 500 misconfigured", async () => {
  await withMutedConsole(["error"], async () => {
    const res = await handleRequest(
      redeemRequest(),
      depsOk(await makeRow(), {
        env: {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
        },
      }),
    );
    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, "redeem_claim_code_misconfigured");
  });
});

// ── Body validation ────────────────────────────────────────────────

Deno.test("missing code in body returns 400 invalid_code", async () => {
  const res = await handleRequest(
    redeemRequest({}),
    depsOk(await makeRow()),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "invalid_code");
});

Deno.test("non-string code returns 400 invalid_code", async () => {
  const res = await handleRequest(
    redeemRequest({ code: 12345 }),
    depsOk(await makeRow()),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "invalid_code");
});

Deno.test("a malformed code is rejected before any DB lookup", async () => {
  let lookedUp = false;
  const res = await handleRequest(
    // 'O', '0', 'I', '1' are excluded from the unambiguous alphabet.
    redeemRequest({ code: "OOOO1111" }),
    depsOk(await makeRow(), {
      lookupCode: () => {
        lookedUp = true;
        return Promise.resolve(null);
      },
    }),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "invalid_code");
  assert(
    !lookedUp,
    "a structurally invalid code must short-circuit before a DB round-trip",
  );
});

Deno.test("a wrong-length code is rejected as invalid_code", async () => {
  const res = await handleRequest(
    redeemRequest({ code: "ABCD" }),
    depsOk(await makeRow()),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "invalid_code");
});

// ── Redeem success ─────────────────────────────────────────────────

Deno.test("happy path — a valid code is burned and the session is returned", async () => {
  let burned = false;
  let burnedCode = "";
  const row = await makeRow({ refreshToken: "v1.rt_the_real_web_token" });
  const res = await handleRequest(
    redeemRequest(),
    depsOk(row, {
      burnCode: (_env, code) => {
        burned = true;
        burnedCode = code;
        return Promise.resolve({ burned: true });
      },
    }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.status, "ok");
  // The decrypted refresh token of the carried anonymous identity.
  assertEquals(body.refresh_token, "v1.rt_the_real_web_token");
  // The carried anonymous user_id is echoed for the client to sanity-check.
  assertEquals(body.user_id, CALLER_ID);
  // The code was burned single-use.
  assert(burned, "a successful redeem must burn the code");
  assertEquals(burnedCode, VALID_CODE);
});

Deno.test("happy path — a lowercase code is uppercased before lookup", async () => {
  let lookedUpWith = "";
  const res = await handleRequest(
    redeemRequest({ code: VALID_CODE.toLowerCase() }),
    depsOk(await makeRow(), {
      lookupCode: (_env, code) => {
        lookedUpWith = code;
        return Promise.resolve(makeRow());
      },
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(
    lookedUpWith,
    VALID_CODE,
    "the redeem side must uppercase the user's input before the lookup",
  );
});

Deno.test("happy path — surrounding whitespace is trimmed before lookup", async () => {
  let lookedUpWith = "";
  const res = await handleRequest(
    redeemRequest({ code: `  ${VALID_CODE}  ` }),
    depsOk(await makeRow(), {
      lookupCode: (_env, code) => {
        lookedUpWith = code;
        return Promise.resolve(makeRow());
      },
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(lookedUpWith, VALID_CODE);
});

// ── Unknown-code rejection ─────────────────────────────────────────

Deno.test("an unknown code returns 404 code_not_found", async () => {
  const res = await handleRequest(
    redeemRequest(),
    depsOk(await makeRow(), {
      lookupCode: () => Promise.resolve(null),
    }),
  );
  assertEquals(res.status, 404);
  assertEquals((await res.json()).error, "code_not_found");
});

// ── Double-redeem rejection ────────────────────────────────────────

Deno.test("an already-redeemed code returns 409 code_already_redeemed", async () => {
  let burned = false;
  const row = await makeRow({
    redeemedAt: new Date(FIXED_NOW - 60_000).toISOString(),
  });
  const res = await handleRequest(
    redeemRequest(),
    depsOk(row, {
      burnCode: () => {
        burned = true;
        return Promise.resolve({ burned: true });
      },
    }),
  );
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error, "code_already_redeemed");
  assert(!burned, "an already-redeemed code must not be burned again");
});

Deno.test("a concurrent double-redeem — burn loses the race — returns 409", async () => {
  // The row read as unredeemed, but the conditional burn UPDATE matched
  // zero rows (another redeem won the race between the SELECT and the
  // UPDATE). The handler must treat that as already-redeemed, never
  // hand back a session for a code it did not actually burn.
  const res = await handleRequest(
    redeemRequest(),
    depsOk(await makeRow(), {
      burnCode: () => Promise.resolve({ burned: false }),
    }),
  );
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error, "code_already_redeemed");
});

// ── Expiry rejection ───────────────────────────────────────────────

Deno.test("an expired code returns 410 code_expired", async () => {
  let burned = false;
  const row = await makeRow({
    // One second before the pinned now() — expired.
    expiresAt: new Date(FIXED_NOW - 1000).toISOString(),
  });
  const res = await handleRequest(
    redeemRequest(),
    depsOk(row, {
      burnCode: () => {
        burned = true;
        return Promise.resolve({ burned: true });
      },
    }),
  );
  assertEquals(res.status, 410);
  assertEquals((await res.json()).error, "code_expired");
  assert(!burned, "an expired code must not be burned");
});

Deno.test("a code expiring exactly at now() is treated as expired", async () => {
  const row = await makeRow({
    expiresAt: new Date(FIXED_NOW).toISOString(),
  });
  const res = await handleRequest(
    redeemRequest(),
    depsOk(row),
  );
  assertEquals(res.status, 410);
  assertEquals((await res.json()).error, "code_expired");
});

// ── Rate-limiting ──────────────────────────────────────────────────

Deno.test("a rate-limited caller returns 429 and never touches the DB", async () => {
  let lookedUp = false;
  let burned = false;
  const res = await handleRequest(
    redeemRequest(),
    depsOk(await makeRow(), {
      checkRateLimit: () => ({ allowed: false, retryAfterSeconds: 42 }),
      lookupCode: () => {
        lookedUp = true;
        return Promise.resolve(null);
      },
      burnCode: () => {
        burned = true;
        return Promise.resolve({ burned: true });
      },
    }),
  );
  assertEquals(res.status, 429);
  assertEquals((await res.json()).error, "rate_limited");
  assert(!lookedUp, "a rate-limited request must not reach the DB lookup");
  assert(!burned, "a rate-limited request must not burn anything");
});

Deno.test("a 429 response carries a Retry-After header", async () => {
  const res = await handleRequest(
    redeemRequest(),
    depsOk(await makeRow(), {
      checkRateLimit: () => ({ allowed: false, retryAfterSeconds: 30 }),
    }),
  );
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Retry-After"), "30");
  await res.body?.cancel();
});

// ── Decryption failure ─────────────────────────────────────────────

Deno.test("a row whose token cannot be decrypted returns 500 redeem_claim_code_failed", async () => {
  await withMutedConsole(["error"], async () => {
    // The stored ciphertext was encrypted under a DIFFERENT key — the
    // GCM auth tag fails to verify and `decryptToken` throws.
    const wrongKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const row: ClaimCodeRow = {
      code: VALID_CODE,
      encryptedToken: await encryptToken("v1.rt_x", wrongKey),
      userId: CALLER_ID,
      expiresAt: new Date(FIXED_NOW + 30 * 60 * 1000).toISOString(),
      redeemedAt: null,
    };
    const res = await handleRequest(
      redeemRequest(),
      depsOk(row),
    );
    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, "redeem_claim_code_failed");
  });
});

// ── Transport-failure handling ─────────────────────────────────────

Deno.test("a lookup transport failure returns 500 redeem_claim_code_failed", async () => {
  await withMutedConsole(["error"], async () => {
    const res = await handleRequest(
      redeemRequest(),
      depsOk(await makeRow(), {
        lookupCode: () => Promise.reject(new Error("db unreachable")),
      }),
    );
    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, "redeem_claim_code_failed");
  });
});

Deno.test("a burn transport failure returns 500 redeem_claim_code_failed", async () => {
  await withMutedConsole(["error"], async () => {
    const res = await handleRequest(
      redeemRequest(),
      depsOk(await makeRow(), {
        burnCode: () => Promise.reject(new Error("db unreachable")),
      }),
    );
    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, "redeem_claim_code_failed");
  });
});

Deno.test("invalid JSON body returns 400 invalid_request_body", async () => {
  const res = await handleRequest(
    new Request("https://example/redeem-claim-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    }),
    depsOk(await makeRow()),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "invalid_request_body");
});

Deno.test("response sets Content-Type application/json", async () => {
  const res = await handleRequest(redeemRequest(), depsOk(await makeRow()));
  assertStringIncludes(
    res.headers.get("Content-Type") ?? "",
    "application/json",
  );
});
