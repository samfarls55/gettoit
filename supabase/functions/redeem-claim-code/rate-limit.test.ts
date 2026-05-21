// Unit tests for the in-memory sliding-window rate limiter that guards
// `redeem-claim-code` against claim-code guessing.
//
// tb-WF-14 — the redeem function takes a bare 8-char code and hands
// back a session, so a brute-force guesser must be slowed. The keyspace
// (31^8) plus single-use burn plus 30-minute TTL already make a guess
// astronomically unlikely; this limiter is the belt — it caps how many
// redeem attempts one source key (client IP) can make inside a rolling
// window, so a scripted burst is throttled rather than free.
//
// The limiter is pure given its clock — every test pins `now` so the
// window math is deterministic.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { createRateLimiter } from "./rate-limit.ts";

Deno.test("allows requests up to the limit inside the window", () => {
  let now = 1_000_000;
  const limiter = createRateLimiter({
    maxAttempts: 5,
    windowMs: 60_000,
    now: () => now,
  });
  for (let i = 0; i < 5; i++) {
    assertEquals(
      limiter.check("1.2.3.4").allowed,
      true,
      `attempt ${i + 1} of 5 must be allowed`,
    );
  }
});

Deno.test("denies the request that exceeds the limit", () => {
  let now = 1_000_000;
  const limiter = createRateLimiter({
    maxAttempts: 5,
    windowMs: 60_000,
    now: () => now,
  });
  for (let i = 0; i < 5; i++) limiter.check("1.2.3.4");
  const sixth = limiter.check("1.2.3.4");
  assertEquals(sixth.allowed, false, "the 6th attempt must be denied");
  assert(
    (sixth.retryAfterSeconds ?? 0) > 0,
    "a denied result must carry a positive retry-after",
  );
});

Deno.test("the window slides — old attempts age out and free capacity", () => {
  let now = 1_000_000;
  const limiter = createRateLimiter({
    maxAttempts: 3,
    windowMs: 10_000,
    now: () => now,
  });
  // Spend the budget.
  for (let i = 0; i < 3; i++) limiter.check("1.2.3.4");
  assertEquals(limiter.check("1.2.3.4").allowed, false);
  // Advance past the window — every prior attempt ages out.
  now += 10_001;
  assertEquals(
    limiter.check("1.2.3.4").allowed,
    true,
    "once the window has fully slid, the budget is fresh",
  );
});

Deno.test("a partial slide frees exactly the aged-out attempts", () => {
  let now = 1_000_000;
  const limiter = createRateLimiter({
    maxAttempts: 3,
    windowMs: 10_000,
    now: () => now,
  });
  limiter.check("1.2.3.4"); // t=0
  now += 4_000;
  limiter.check("1.2.3.4"); // t=4000
  now += 4_000;
  limiter.check("1.2.3.4"); // t=8000 — budget spent
  assertEquals(limiter.check("1.2.3.4").allowed, false);
  // Advance so only the t=0 attempt ages out (window is 10s).
  now += 2_001; // now t=10001 — t=0 is outside, t=4000 + t=8000 inside
  assertEquals(
    limiter.check("1.2.3.4").allowed,
    true,
    "one aged-out attempt frees exactly one slot",
  );
  // ...and the very next one is denied again — only one slot freed.
  assertEquals(limiter.check("1.2.3.4").allowed, false);
});

Deno.test("separate source keys have independent budgets", () => {
  let now = 1_000_000;
  const limiter = createRateLimiter({
    maxAttempts: 2,
    windowMs: 60_000,
    now: () => now,
  });
  limiter.check("1.1.1.1");
  limiter.check("1.1.1.1");
  assertEquals(
    limiter.check("1.1.1.1").allowed,
    false,
    "the first key is exhausted",
  );
  assertEquals(
    limiter.check("2.2.2.2").allowed,
    true,
    "a different source key must not inherit the first key's spent budget",
  );
});

Deno.test("an empty / unknown source key still gets a budget (fail-closed bucket)", () => {
  let now = 1_000_000;
  const limiter = createRateLimiter({
    maxAttempts: 2,
    windowMs: 60_000,
    now: () => now,
  });
  // A missing IP collapses every anonymous caller into one shared
  // bucket — strictest possible, never unlimited.
  limiter.check("");
  limiter.check("");
  assertEquals(
    limiter.check("").allowed,
    false,
    "callers with no resolvable source key share one capped bucket",
  );
});
