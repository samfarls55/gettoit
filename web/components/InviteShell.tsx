// GetToIt web — web invitee shell (Surface web-01).
//
// tb-WF-11 — the shell scaffold mounted at `/join/<roomId>`. The Web
// invitee is the Account-disjoint Plan-member subtype: no homepage, no
// Plan list, one Plan reached through the iMessage/SMS deep link.
//
// Canonical spec: `design-system/surfaces/web-01-invitee-shell.md`.
// Behavior is locked in the decision doc
// `gti-vault/50_product/workflow-overhaul-web-invitee-flow.md` (§Q3
// identity, §Q4 name entry).
//
// This slice — tb-WF-11 — lands the scaffold and the FIRST-LANDING path
// through it:
//   1. ensure the anonymous Supabase session (decision doc §Q3 — the
//      sole identity mechanism, held in `localStorage`; no URL token,
//      no separate cookie),
//   2. check for an existing `members` row,
//   3. no row  → render the name-entry surface (web-01 §A); on submit,
//      insert the `members` row carrying `display_name`, then hand into
//      the quiz,
//      row present → hand straight into the quiz.
//
// Out of scope (tb-WF-12): re-click resume routing, the read-only
// verdict card, the "plan closed" terminal, and leave. The state
// machine below is deliberately shaped so those surfaces slot in as
// extra `phase` variants without reworking the foundation.

"use client";

import { useEffect, useRef, useState } from "react";

import { ensureAnonSession, getSupabaseClient } from "../lib/supabase";
import { createMembership, findMembership } from "../lib/invitee-shell";

import { NameEntry } from "./NameEntry";
import { SessionRoom } from "./SessionRoom";
import { GradientSurface, GTIMark } from "./SunsetPop";

// The shell's first-landing state machine. tb-WF-12 extends this union
// with the resume / verdict-card / terminal phases.
type Phase =
  | { kind: "booting" }
  | { kind: "name-entry" }
  | { kind: "quiz" }
  | { kind: "error"; message: string };

export function InviteShell({ roomId }: { roomId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "booting" });
  const [userId, setUserId] = useState<string | null>(null);
  // Surfaced on the name-entry surface when the `members` insert fails.
  const [submitError, setSubmitError] = useState<string | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);

  // ── Boot — anon session + membership lookup ──────────────────────
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

        // Does this anon user already hold a `members` row for the
        // room? A storage-cleared returner has no row and is, by
        // construction, indistinguishable from a first-timer — they
        // land on name entry, which is correct (decision doc §Q3).
        const membership = await findMembership(
          getSupabaseClient(),
          roomId,
          uid,
        );
        if (cancelled) return;
        setPhase(membership ? { kind: "quiz" } : { kind: "name-entry" });
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
      // Hand into the quiz. `SessionRoom`'s own member upsert is
      // idempotent (`ignoreDuplicates` on the (room_id, user_id) PK),
      // so it is a harmless no-op now that the row exists — it will
      // not clobber the `display_name` just written.
      setPhase({ kind: "quiz" });
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

  // phase.kind === "quiz" — hand the invitee into the quiz. tb-WF-10
  // swaps `SessionRoom`'s quiz to the v1.1 web quiz; the shell does not
  // care which quiz renders, only that it handed off a member + a room.
  return <SessionRoom roomId={roomId} />;
}

// A minimal transient frame for the boot gap — the anon-session mint +
// membership lookup. Kept quiet (no wordmark, single centered line) so
// a fast boot does not flash a heavy surface. tb-WF-12 reuses this
// shape for the §B resume routing frame.
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
          Opening the plan&hellip;
        </p>
      </div>
    </GradientSurface>
  );
}

// Boot-failure surface — the anon session could not be minted or the
// membership lookup threw. Calm, no red (Sunset Pop has no red token),
// no CTA: a transient network failure resolves on a reload.
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
