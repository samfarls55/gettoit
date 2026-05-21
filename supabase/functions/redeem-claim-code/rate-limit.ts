// In-memory sliding-window rate limiter for the redeem-claim-code
// Edge Function (tb-WF-14).
//
// ── What it defends ─────────────────────────────────────────────────
// `redeem-claim-code` takes a bare 8-character claim code and, on a
// match, hands back a session. That shape invites brute-force guessing.
// The primary defenses are structural — a 31^8 keyspace, a single-use
// burn, and a ~30-minute TTL — which already make a successful guess
// astronomically unlikely. This limiter is the belt to that braces: it
// caps how many redeem attempts a single source key (the client IP)
// can make inside a rolling window, so a scripted burst is throttled
// instead of free.
//
// ── Why in-memory, not DB-backed ────────────────────────────────────
// Edge Function instances are short-lived and a burst can land across
// several instances, so an in-memory limiter is not a hard global cap.
// It is deliberately chosen anyway:
//   * It blunts the realistic threat — a single scripted source hammering
//     the endpoint reuses one warm instance and is throttled within it.
//   * It needs no extra table, no migration, no write amplification on
//     the hot path.
//   * The structural defenses above carry the real weight; this is a
//     speed bump, not the lock.
// A DB- or KV-backed global limiter is a clean future upgrade if real
// abuse ever appears (ADR 0015 has no real users pre-launch).
//
// The limiter is pure given its injected clock — every unit test pins
// `now` so the window arithmetic is deterministic.

export interface RateLimitConfig {
  /** Max attempts permitted for one source key inside `windowMs`. */
  maxAttempts: number;
  /** The rolling window length, in milliseconds. */
  windowMs: number;
  /** Clock — injectable so tests pin the window math. Defaults to
   *  `Date.now`. */
  now?: () => number;
}

/** The verdict for one `check` call. `allowed` false carries a
 *  `retryAfterSeconds` hint — how long until the oldest in-window
 *  attempt ages out and a slot frees. */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface RateLimiter {
  /** Record an attempt for `key` and return whether it is allowed.
   *  Calling `check` always counts as an attempt — a denied call still
   *  consumes nothing extra but does not free a slot either. */
  check: (key: string) => RateLimitResult;
}

/** Create a sliding-window rate limiter. State lives in a `Map` keyed
 *  by source key; each value is the sorted list of in-window attempt
 *  timestamps. Old timestamps are pruned lazily on each `check`. */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const now = config.now ?? Date.now;
  // key → ascending list of attempt timestamps still inside the window.
  const hits = new Map<string, number[]>();

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const cutoff = t - config.windowMs;

      // Prune attempts that have aged out of the rolling window.
      const prior = hits.get(key) ?? [];
      const live = prior.filter((ts) => ts > cutoff);

      if (live.length >= config.maxAttempts) {
        // Budget spent. The oldest live attempt is the first to age
        // out; the caller may retry once it crosses the window edge.
        // We do NOT record this denied attempt — denying does not
        // extend the cooldown, it just refuses service.
        hits.set(key, live);
        const oldest = live[0];
        const retryAfterMs = oldest + config.windowMs - t;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        };
      }

      // Within budget — record this attempt and allow it.
      live.push(t);
      hits.set(key, live);
      return { allowed: true };
    },
  };
}
