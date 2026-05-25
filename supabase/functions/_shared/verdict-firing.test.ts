// verdict-firing fixture tests (TB-13 — quiz-redesign firing on the Q5-complete
// signal).
//
// Pure-logic tests against the fire-decision predicate's public
// interface. No Supabase round-trip, no Edge runtime, no clock — just
// `(FiringInput) → FiringDecision`.
//
// The quiz redesign retires the pre-redesign timer / shot-clock / deadline
// path. The verdict now fires on exactly two signals:
//   1. All participants have completed Q5 (every room member has a
//      votes row carrying a `regret`-kind Q5 slot) — auto-fire.
//   2. The initiator presses "close voting" — fire on demand, without
//      waiting on a straggler.
// A solo session (the initiator alone) still produces a verdict on
// either signal. There is no minimum quorum and no timer.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  decideFiring,
  type FiringInput,
} from "./verdict-firing.ts";

// ───────────────────────────────────────────────────────────────────────
// Fixture helpers
// ───────────────────────────────────────────────────────────────────────

/** Build a FiringInput. Defaults: a two-member room, nobody done,
 *  not a close-voting request. Override what each test needs. */
function makeInput(overrides: Partial<FiringInput> = {}): FiringInput {
  return {
    member_user_ids: overrides.member_user_ids ?? ["initiator", "guest"],
    q5_complete_user_ids: overrides.q5_complete_user_ids ?? [],
    close_voting: overrides.close_voting ?? false,
  };
}

// ───────────────────────────────────────────────────────────────────────
// All-participants-complete auto-fire
// ───────────────────────────────────────────────────────────────────────

Deno.test("auto-fire — fires when every participant has completed Q5", () => {
  const decision = decideFiring(makeInput({
    member_user_ids: ["initiator", "guest"],
    q5_complete_user_ids: ["initiator", "guest"],
  }));
  assert(decision.should_fire, "verdict should fire on all-complete");
  assertEquals(decision.method, "quorum");
});

Deno.test("auto-fire — does NOT fire while a participant is still in the quiz", () => {
  const decision = decideFiring(makeInput({
    member_user_ids: ["initiator", "guest"],
    q5_complete_user_ids: ["initiator"],
  }));
  assert(!decision.should_fire, "verdict must wait for the straggler");
});

Deno.test("auto-fire — does NOT fire when nobody has completed Q5", () => {
  const decision = decideFiring(makeInput({
    member_user_ids: ["initiator", "guest", "third"],
    q5_complete_user_ids: [],
  }));
  assert(!decision.should_fire);
});

Deno.test("auto-fire — a stale Q5-complete id for a non-member does not satisfy the room", () => {
  // A user who completed Q5 then left the room must not count toward
  // the all-complete check — the predicate gates on the CURRENT
  // membership set.
  const decision = decideFiring(makeInput({
    member_user_ids: ["initiator", "guest"],
    q5_complete_user_ids: ["initiator", "ghost"],
  }));
  assert(!decision.should_fire, "guest still owes a Q5; ghost left");
});

Deno.test("auto-fire — duplicate Q5-complete ids do not over-count toward all-complete", () => {
  // A defensive insert-retry could surface the same user id twice;
  // the predicate must dedupe before comparing against the member set.
  const decision = decideFiring(makeInput({
    member_user_ids: ["initiator", "guest"],
    q5_complete_user_ids: ["initiator", "initiator"],
  }));
  assert(!decision.should_fire, "guest still owes a Q5");
});

// ───────────────────────────────────────────────────────────────────────
// Initiator "close voting" — fire without a straggler
// ───────────────────────────────────────────────────────────────────────

Deno.test("close-voting — fires immediately even with a participant still mid-quiz", () => {
  const decision = decideFiring(makeInput({
    member_user_ids: ["initiator", "guest"],
    q5_complete_user_ids: ["initiator"],
    close_voting: true,
  }));
  assert(decision.should_fire, "close-voting fires without the straggler");
  assertEquals(decision.method, "manual");
});

Deno.test("close-voting — fires even when no participant has finished", () => {
  const decision = decideFiring(makeInput({
    member_user_ids: ["initiator", "guest"],
    q5_complete_user_ids: [],
    close_voting: true,
  }));
  assert(decision.should_fire, "close-voting fires regardless of progress");
  assertEquals(decision.method, "manual");
});

// ───────────────────────────────────────────────────────────────────────
// Solo session — initiator alone still resolves
// ───────────────────────────────────────────────────────────────────────

Deno.test("solo — a one-member room auto-fires once the initiator completes Q5", () => {
  const decision = decideFiring(makeInput({
    member_user_ids: ["initiator"],
    q5_complete_user_ids: ["initiator"],
  }));
  assert(decision.should_fire, "a dead session with only the initiator resolves");
  assertEquals(decision.method, "quorum");
});

Deno.test("solo — a one-member room can close voting before the initiator finishes", () => {
  const decision = decideFiring(makeInput({
    member_user_ids: ["initiator"],
    q5_complete_user_ids: [],
    close_voting: true,
  }));
  assert(decision.should_fire);
  assertEquals(decision.method, "manual");
});

Deno.test("solo — a one-member room does NOT auto-fire before the initiator completes Q5", () => {
  const decision = decideFiring(makeInput({
    member_user_ids: ["initiator"],
    q5_complete_user_ids: [],
  }));
  assert(!decision.should_fire);
});

// ───────────────────────────────────────────────────────────────────────
// No timer / no shot clock — there is no deadline channel
// ───────────────────────────────────────────────────────────────────────

Deno.test("no shot clock — the predicate has no time input and never fires on elapsed time", () => {
  // Regression guard against re-introducing a deadline channel: the
  // FiringInput shape carries only membership, Q5-completion, and the
  // close-voting flag. A room with an incomplete quiz never fires no
  // matter how old it is.
  const input = makeInput({
    member_user_ids: ["initiator", "guest"],
    q5_complete_user_ids: ["initiator"],
  });
  // FiringInput exposes exactly three keys — no `deadline_at`,
  // `timer_minutes`, or `created_at`.
  assertEquals(
    Object.keys(input).sort(),
    ["close_voting", "member_user_ids", "q5_complete_user_ids"],
  );
  assert(!decideFiring(input).should_fire);
});

// ───────────────────────────────────────────────────────────────────────
// Empty / degenerate rooms
// ───────────────────────────────────────────────────────────────────────

Deno.test("empty room — a room with no members does not fire", () => {
  const decision = decideFiring(makeInput({
    member_user_ids: [],
    q5_complete_user_ids: [],
  }));
  assert(!decision.should_fire, "an empty room has nothing to decide over");
});

Deno.test("empty room — close voting on a memberless room still does not fire", () => {
  // Defensive: there is no verdict to compute with zero members, so
  // even an explicit close-voting request is a no-op.
  const decision = decideFiring(makeInput({
    member_user_ids: [],
    q5_complete_user_ids: [],
    close_voting: true,
  }));
  assert(!decision.should_fire);
});
