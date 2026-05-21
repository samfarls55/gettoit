// GetToIt web — web invitee shell (Surface web-01).
//
// The shell scaffold mounted at `/join/<roomId>`. The Web invitee is
// the Account-disjoint Plan-member subtype: no homepage, no Plan list,
// one Plan reached through the iMessage/SMS deep link.
//
// Canonical spec: `design-system/surfaces/web-01-invitee-shell.md`.
// Behavior is locked in the decision doc
// `gti-vault/50_product/workflow-overhaul-web-invitee-flow.md`.
//
// ── tb-WF-11 — first-landing foundation ─────────────────────────────
//   §A First-landing name entry: ensure the anonymous Supabase session,
//   check for an existing `members` row, render name entry when there
//   is none, write the row carrying `display_name`, hand into the quiz.
//
// ── tb-WF-12 — re-click behaviors ───────────────────────────────────
// Everything that happens when an invitee re-opens the link after the
// first landing. The shell resolves the invitee to the Plan's current
// state and renders the right surface:
//
//   §B Resume   — a member of a still-open Plan is handed into the quiz
//                 with their `members.quiz_progress`, resuming at the
//                 last-answered question. "Already voted → Waiting" and
//                 "verdict → Verdict" fall out of `SessionRoom.boot`.
//   §C Decided  — a member of a decided Plan sees a read-only verdict
//                 card (plan name + verdict venue).
//   §D Closed   — a membership that no longer resolves sees the "this
//                 plan is closed" terminal.
//   §E Leave    — the Q1–Q5 quiz chrome carries a `Leave` affordance
//                 (wired through `SessionRoom`); confirming it drops
//                 the `members` row and routes to the "you left this
//                 plan" terminal. A subsequent re-click is a fresh
//                 first-landing (soft rejoin — no tombstone).
//
// This slice adds no new schema and no new server code — every
// server-side piece already exists. It is a vertical slice integrating
// through those layers up to the web UI.
//
// ── §A vs §D — a deliberate routing decision ────────────────────────
// `rooms` carries a membership-gated SELECT policy (`rooms_select_members`):
// a user with no `members` row cannot read the room at all. So the
// shell cannot, with no new server code, tell a genuine first-timer
// apart from a TTL-purged member or a stranger on a *decided* Plan —
// all three present as "no `members` row". Per the surface doc §B
// single-path lock, a no-membership click routes to §A name entry (the
// copy reads correctly for a first-timer AND a storage-cleared
// returner). §D is reached when a membership *does* resolve at boot
// but the room read inside `readRoomPlanState` comes back empty — the
// membership aged out, which is exactly "membership does not resolve".

"use client";

import { useEffect, useRef, useState } from "react";

import { ensureAnonSession, getSupabaseClient } from "../lib/supabase";
import { mintClaimCode } from "../lib/claim-code";
import {
  createMembership,
  findMembership,
  leaveMembership,
  readQuizProgress,
  readRoomPlanState,
} from "../lib/invitee-shell";
import type { QuizProgressState } from "../lib/quiz-progress";

import {
  PlanClosedTerminal,
  PlanLeftTerminal,
  WebVerdictCard,
} from "./InviteShellSurfaces";
import { NameEntry } from "./NameEntry";
import { SessionRoom } from "./SessionRoom";
import { GradientSurface, GTIMark } from "./SunsetPop";

// The shell's state machine. tb-WF-11 shipped booting / name-entry /
// quiz / error; tb-WF-12 adds the re-click destinations: the §C decided
// card, the §D closed terminal, and the §E "you left" terminal.
type Phase =
  | { kind: "booting" }
  | { kind: "name-entry" }
  // §B — the invitee is a member of an open Plan; `SessionRoom` resumes
  // them from `progress` (mid-quiz → last question, voted → Waiting,
  // verdict → Verdict).
  | { kind: "quiz"; progress: QuizProgressState }
  // §C — decided Plan; render the read-only verdict card.
  | { kind: "decided"; planName: string; verdictPlaceName: string }
  // §D — membership no longer resolves; render the closed terminal.
  | { kind: "closed" }
  // §E — the invitee confirmed Leave; render the "you left" terminal.
  | { kind: "left" }
  | { kind: "error"; message: string };

export function InviteShell({ roomId }: { roomId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "booting" });
  const [userId, setUserId] = useState<string | null>(null);
  // Surfaced on the name-entry surface when the `members` insert fails.
  const [submitError, setSubmitError] = useState<string | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);

  // ── Boot — anon session + membership + Plan-state resolution ──────
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        // Identity is the anonymous Supabase session (decision doc
        // §Q3). `ensureAnonSession` is idempotent — a returning
        // invitee with an intact `localStorage` session reuses it.
        const uid = await ensureAnonSession();
        if (cancelled) return;
        setUserId(uid);

        const client = getSupabaseClient();

        // Does this anon user already hold a `members` row for the
        // room?
        const membership = await findMembership(client, roomId, uid);
        if (cancelled) return;

        // No `members` row → first-landing. A storage-cleared returner
        // is, by construction, indistinguishable from a true
        // first-timer — they land on name entry, which is correct
        // (surface doc §B single-path lock).
        if (!membership) {
          setPhase({ kind: "name-entry" });
          return;
        }

        // The invitee is a member — this is a re-click. Resolve the
        // Plan state behind the room to pick the §B / §C / §D branch.
        const planState = await readRoomPlanState(client, roomId, uid);
        if (cancelled) return;

        if (planState.kind === "unresolved") {
          // The membership-gated room read came back empty — the
          // membership aged out (anon-TTL purge). §D closed terminal.
          setPhase({ kind: "closed" });
          return;
        }

        if (planState.kind === "decided") {
          // §C — read-only verdict card.
          setPhase({
            kind: "decided",
            planName: planState.planName,
            verdictPlaceName: planState.verdictPlaceName,
          });
          return;
        }

        // §B — the Plan is still open; read the in-flight quiz progress
        // and hand the invitee into the quiz, which resumes them at the
        // last-answered question (or Waiting / Verdict via its boot).
        const progress = await readQuizProgress(client, roomId, uid);
        if (cancelled) return;
        setPhase({ kind: "quiz", progress });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error
          ? err.message
          : "Couldn't open this plan.";
        setPhase({ kind: "error", message });
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // ── §C live update — Realtime rebroadcast while the decided card is
  //    open. If a reroll changes the verdict during `decided-active`,
  //    the venue name cross-fades to the new value (decision doc §Q6).
  //    Reuses the existing `room:<id>` channel + `verdict_ready`
  //    broadcast and `rooms` UPDATE — no new server code. The invitee
  //    is a read-only observer; they take no action.
  const decided = phase.kind === "decided";
  useEffect(() => {
    if (!decided || !userId) return;
    const client = getSupabaseClient();
    // The test / SSR fake client may not expose `.channel` — skip the
    // subscription rather than throw; the static card still renders.
    if (typeof client.channel !== "function") return;

    let cancelled = false;
    const reresolve = async () => {
      const next = await readRoomPlanState(client, roomId, userId);
      if (cancelled) return;
      if (next.kind === "decided") {
        setPhase({
          kind: "decided",
          planName: next.planName,
          verdictPlaceName: next.verdictPlaceName,
        });
      } else if (next.kind === "unresolved") {
        setPhase({ kind: "closed" });
      }
      // `open` is not expected once decided — ignore the downgrade.
    };

    const channel = client
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        () => {
          void reresolve();
        },
      )
      .on("broadcast", { event: "verdict_ready" }, () => {
        void reresolve();
      });
    channel.subscribe();

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [decided, roomId, userId]);

  // Guard against a double-submit racing the phase flip.
  const submitInFlight = useRef(false);

  async function handleNameSubmit(name: string) {
    if (!userId || submitInFlight.current) return;
    submitInFlight.current = true;
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      // Write the `members` row carrying the typed name — the system's
      // first real `display_name` source (tb-WF-11 migration).
      await createMembership(getSupabaseClient(), {
        roomId,
        userId,
        displayName: name,
      });
      // Hand into the quiz at a fresh start. `SessionRoom`'s own member
      // upsert is idempotent (`ignoreDuplicates` on the (room_id,
      // user_id) PK), so it is a harmless no-op now that the row
      // exists — it will not clobber the `display_name` just written.
      setPhase({ kind: "quiz", progress: freshProgress() });
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Couldn't join the plan. Try again.";
      // Stay on the name-entry surface and surface the failure — the
      // invitee can retry without losing what they typed.
      setSubmitError(message);
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  }

  // §E — the quiz-chrome `Leave` confirm fired. Drop the `members` row
  // and route to the "you left this plan" terminal. The leave delete
  // (`members_delete_self` RLS policy) takes `quiz_progress` along on
  // the row delete. Throwing here keeps the invitee on the quiz with
  // the failure surfaced rather than faking a successful leave — but
  // the shell routes to the terminal only on success.
  async function handleLeave() {
    if (!userId) return;
    await leaveMembership(getSupabaseClient(), roomId, userId);
    setPhase({ kind: "left" });
  }

  if (phase.kind === "booting") {
    return <ShellRoutingFrame />;
  }

  if (phase.kind === "error") {
    return <ShellErrorSurface message={phase.message} />;
  }

  if (phase.kind === "name-entry") {
    return (
      <NameEntry
        onSubmit={handleNameSubmit}
        submitting={submitting}
        errorMessage={submitError}
      />
    );
  }

  if (phase.kind === "decided") {
    // §C — read-only verdict card. Terminal-by-completion: no CTA, the
    // exit is closing the tab. The one install-adjacent affordance is
    // the sg-WF-8 / tb-WF-13 "Getting the app?" claim-code mint line —
    // a returning user reconnecting old data lands on decided rooms,
    // which render §C, so the card must carry the mint affordance.
    return (
      <WebVerdictCard
        planName={phase.planName}
        verdictPlaceName={phase.verdictPlaceName}
        onMintClaimCode={() => mintClaimCode()}
      />
    );
  }

  if (phase.kind === "closed") {
    // §D — "this plan is closed" terminal. Terminal-by-failure.
    return <PlanClosedTerminal />;
  }

  if (phase.kind === "left") {
    // §E — "you left this plan" terminal. Re-clicking the link is a
    // fresh first-landing (soft rejoin).
    return <PlanLeftTerminal />;
  }

  // phase.kind === "quiz" — §A first-landing or §B resume both land
  // here. `SessionRoom` is handed the resume progress and the leave
  // callback; tb-WF-10 swapped its quiz to the v1.1 web quiz, so the
  // shell does not care which quiz renders, only that it handed off a
  // member + a room + the resume state.
  return (
    <SessionRoom
      roomId={roomId}
      initialProgress={phase.progress}
      onLeave={handleLeave}
    />
  );
}

/** A fresh "start at Q1" progress state for a first-landing hand-off. */
function freshProgress(): QuizProgressState {
  return {
    lastIndex: 1,
    cuisines: [],
    noPreference: false,
    budget: 1,
    reputation: "no_preference",
    vibe: 2,
  };
}

// A minimal transient frame for the boot gap — the anon-session mint +
// membership + Plan-state resolution. Kept quiet (no wordmark, single
// centered line) so a fast boot does not flash a heavy surface. This is
// also the surface doc §B resume routing frame.
function ShellRoutingFrame() {
  return (
    <GradientSurface stop="initiator">
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: "0 22px",
        }}
      >
        <p
          className="gti-eyebrow"
          style={{ color: "rgba(255,255,255,0.6)", textAlign: "center" }}
        >
          Picking up where you left off&hellip;
        </p>
      </div>
    </GradientSurface>
  );
}

// Boot-failure surface — the anon session could not be minted or a boot
// read threw. Calm, no red (Sunset Pop has no red token), no CTA: a
// transient network failure resolves on a reload.
function ShellErrorSurface({ message }: { message: string }) {
  return (
    <GradientSurface stop="initiator">
      <div
        data-testid="invite-shell-error"
        style={{
          position: "absolute",
          inset: 0,
          padding: "22px 22px 24px",
          display: "flex",
          flexDirection: "column",
          color: "var(--paper)",
        }}
      >
        <GTIMark size={20} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            maxWidth: 360,
            marginInline: "auto",
          }}
        >
          <div className="gti-eyebrow" style={{ opacity: 0.6 }}>
            This plan
          </div>
          <h1
            className="gti-display"
            style={{ fontSize: 32, margin: "10px 0 0", textWrap: "balance" }}
          >
            Couldn&apos;t open this plan
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              fontFamily: "var(--ff-body)",
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.78)",
              maxWidth: 280,
              textWrap: "balance",
            }}
          >
            {message}
          </p>
        </div>
      </div>
    </GradientSurface>
  );
}
