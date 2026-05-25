// verdict-firing — the quiz-redesign fire-decision predicate (TB-13).
//
// Pure function. No network, no Supabase client, no clock. The SQL
// trigger / RPC in `20260515*_verdict_fire_on_q5_complete.sql` mirrors
// this predicate's logic at the database layer; this module is the
// canonical, fixture-testable statement of WHEN a verdict fires, and
// the regression guard for the quiz-redesign firing contract.
//
// Why this module exists
// ──────────────────────
// The pre-redesign firing path (`20260513224000000_verdict_fire_trigger_and_cron.sql`)
// was timer-driven: a `rooms.deadline_at`, a per-minute `pg_cron` job
// that fired on deadline expiry, and a minimum quorum of two votes.
// The quiz redesign (PRD module H, user stories 33-36) retires
// the timer entirely:
//
//   * No shot clock — a member is never rushed (user story 34). There
//     is no `deadline_at`, no cron, no elapsed-time channel. This
//     module's `FiringInput` carries NO time field by construction —
//     the absence is the contract.
//   * Auto-fire on all-complete — the verdict fires the moment every
//     participant has completed Q5 (user story 35).
//   * Close voting — the initiator can produce the verdict on demand
//     without waiting on a straggler (user story 33).
//   * Solo resolves — a session with only the initiator still produces
//     a verdict (user story 36). There is no minimum quorum.
//
// "Completed Q5" signal
// ─────────────────────
// A member completes Q5 by submitting their quiz: the write inserts a
// `votes` row whose `q5` slot carries a `regret`-kind answer (the Q5
// preference probe, TB-08). The caller resolves that into the set of
// member user-ids that have a Q5-complete votes row; this predicate
// gates on the CURRENT membership set, so a user who completed Q5 and
// then left the room never satisfies the all-complete check.

// ───────────────────────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────────────────────

/** The inputs the fire-decision predicate needs. By construction this
 *  shape carries NO time / deadline / timer field — the redesigned quiz has
 *  no shot clock and the predicate must never be able to fire on
 *  elapsed time. */
export interface FiringInput {
  /** The user-ids of the room's CURRENT members. A solo session is a
   *  single-element list (the initiator alone). */
  member_user_ids: readonly string[];
  /** The user-ids that have completed Q5 — i.e. have a `votes` row
   *  carrying a `regret`-kind Q5 slot. May contain ids that are no
   *  longer members (a user completed Q5 then left); the predicate
   *  intersects against `member_user_ids`. May contain duplicates
   *  (defensive insert-retry); the predicate dedupes. */
  q5_complete_user_ids: readonly string[];
  /** True when the initiator pressed the "close voting" control. Fires
   *  the verdict on demand without waiting on a straggler. */
  close_voting: boolean;
}

/** How a fire was triggered — mirrors `verdict-engine.ts`'s
 *  `VerdictMethod`. `quorum` = the all-complete auto-fire; `manual` =
 *  the initiator's close-voting control. */
export type FiringMethod = "quorum" | "manual";

/** The predicate's output. */
export interface FiringDecision {
  /** Whether the verdict should fire now. */
  should_fire: boolean;
  /** When firing, how it was triggered — drives the `method` field on
   *  the durable `verdicts` row. Undefined when `should_fire` is
   *  false. */
  method?: FiringMethod;
}

// ───────────────────────────────────────────────────────────────────────
// Predicate
// ───────────────────────────────────────────────────────────────────────

/** Decide whether a room's verdict should fire.
 *
 *  Two fire signals, in priority order:
 *
 *   1. Close voting — when the initiator pressed "close voting" the
 *      verdict fires immediately, regardless of how many participants
 *      have finished. `method = "manual"`.
 *   2. All-complete — when every current member has completed Q5 the
 *      verdict auto-fires. `method = "quorum"`.
 *
 *  A room with zero members never fires (there is nothing to compute
 *  a verdict over) — this guards the close-voting path too, so an
 *  explicit request on a memberless room is a safe no-op.
 *
 *  There is no timer, no deadline, no minimum quorum: a solo session
 *  (one member) fires on either signal exactly like a group. */
export function decideFiring(input: FiringInput): FiringDecision {
  const members = new Set(input.member_user_ids);

  // An empty room has no verdict to produce — never fire, even on an
  // explicit close-voting request.
  if (members.size === 0) {
    return { should_fire: false };
  }

  // Close voting — the initiator forces the verdict without waiting on
  // a straggler.
  if (input.close_voting) {
    return { should_fire: true, method: "manual" };
  }

  // All-complete auto-fire — every current member must have a
  // Q5-complete signal. Intersect against the membership set so a
  // stale id (a user who left after finishing) cannot satisfy the
  // room, and dedupe so a retry-doubled id cannot over-count.
  let completedMembers = 0;
  const counted = new Set<string>();
  for (const userId of input.q5_complete_user_ids) {
    if (members.has(userId) && !counted.has(userId)) {
      counted.add(userId);
      completedMembers += 1;
    }
  }

  if (completedMembers === members.size) {
    return { should_fire: true, method: "quorum" };
  }

  return { should_fire: false };
}
