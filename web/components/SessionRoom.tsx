// GetToIt web — Session orchestrator.
//
// Client component mounted at `/s/<sessionId>`. Owns the entire web
// session lifecycle:
//
//   1. Anonymous sign-in (idempotent).
//   2. Insert the caller as a `members` row (idempotent — the unique
//      (room_id, user_id) primary key swallows retries).
//   3. Drive the 5-question quiz; submit the `votes` row.
//   4. Subscribe to Realtime so the Waiting + Verdict surfaces stay in
//      lockstep with iOS:
//        * `room:<roomId>` broadcast carries `verdict_ready`.
//        * `members:room_id=eq.<roomId>` postgres_changes carries
//          member joins so the avatar row grows live.
//        * `votes:room_id=eq.<roomId>` postgres_changes carries
//          peer vote submissions for the answered set.
//        * `rooms:id=eq.<roomId>` postgres_changes carries status
//          flips (open → firing → verdict_ready, expired).
//   5. Once `rooms.status === 'verdict_ready'` (or the broadcast
//      arrives), fetch the verdict + cuts + receipts and render the
//      read-only S05 surface.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  QUIZ_DEFAULTS,
  buildVoteRow,
  DUMMY_CANDIDATES,
  seedRegret,
  toggleVeto,
  type VoteRow,
} from "../lib/quiz";

import {
  shapeVerdictView,
  type CutRow,
  type OptionRow,
  type VerdictRow,
  type VerdictView,
  type VoteSummaryRow,
} from "../lib/verdict";

import { APP_STORE_URL } from "../lib/app-store";
import { ensureAnonSession, getSupabaseClient } from "../lib/supabase";

import {
  QuizQ1Vetoes,
  QuizQ2Budget,
  QuizQ3Distance,
  QuizQ4Vibe,
  QuizQ5Regret,
} from "./QuizScreens";
import { VerdictReadOnly } from "./VerdictReadOnly";
import {
  WaitingScreen,
  type WaitingMemberView,
} from "./WaitingScreen";

type Phase =
  | { kind: "booting" }
  | { kind: "error"; message: string }
  | { kind: "joining" }
  | { kind: "quiz"; step: 1 | 2 | 3 | 4 | 5 }
  | { kind: "submitting" }
  | { kind: "waiting" }
  | { kind: "verdict"; view: VerdictView };

type MembersRow = { room_id: string; user_id: string; role: string };
type VotesRow = { room_id: string; user_id: string };
type RoomsRow = {
  id: string;
  status: string;
  deadline_at: string | null;
};

const POSTGRES_CHANGE_INSERT = "INSERT" as const;

export function SessionRoom({ roomId }: { roomId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "booting" });
  const [userId, setUserId] = useState<string | null>(null);

  // Quiz state.
  const [q1Vetoes, setQ1Vetoes] = useState<Set<string>>(() => new Set());
  const [q2Budget, setQ2Budget] = useState<number>(QUIZ_DEFAULTS.q2_budget);
  const [q3Walk, setQ3Walk] = useState<number>(QUIZ_DEFAULTS.q3_walk_minutes);
  const [q4Vibe, setQ4Vibe] = useState<number>(QUIZ_DEFAULTS.q4_vibe);
  const [q5Ratings, setQ5Ratings] = useState<Record<string, number>>(() =>
    seedRegret(DUMMY_CANDIDATES),
  );

  // Realtime + room state.
  const [members, setMembers] = useState<MembersRow[]>([]);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(() => new Set());
  const [roomStatus, setRoomStatus] = useState<string>("open");
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  const channelRef = useRef<ReturnType<
    ReturnType<typeof getSupabaseClient>["channel"]
  > | null>(null);

  // ────────────────────────────────────────────────────────────────
  // Boot — anon auth + member insert + initial fetches + Realtime.
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        setPhase({ kind: "joining" });
        const uid = await ensureAnonSession();
        if (cancelled) return;
        setUserId(uid);

        const client = getSupabaseClient();

        // Member insert (idempotent — PK on (room_id, user_id)).
        const { error: memberErr } = await client.from("members").upsert(
          {
            room_id: roomId,
            user_id: uid,
            role: "participant",
          },
          { onConflict: "room_id,user_id", ignoreDuplicates: true },
        );
        if (memberErr) {
          // RLS rejecting the insert is recoverable iff the row
          // already exists; surface the message on any other error.
          throw memberErr;
        }

        // Hydrate the avatar row + answered set.
        const [{ data: memberRows }, { data: voteRows }, { data: roomRows }] =
          await Promise.all([
            client
              .from("members")
              .select("room_id, user_id, role")
              .eq("room_id", roomId),
            client
              .from("votes")
              .select("room_id, user_id")
              .eq("room_id", roomId),
            client
              .from("rooms")
              .select("id, status, deadline_at")
              .eq("id", roomId)
              .limit(1),
          ]);
        if (cancelled) return;
        setMembers((memberRows as MembersRow[] | null) ?? []);
        setAnsweredIds(
          new Set(((voteRows as VotesRow[] | null) ?? []).map((v) => v.user_id)),
        );
        const room = (roomRows as RoomsRow[] | null)?.[0];
        if (room) {
          setRoomStatus(room.status);
          setDeadlineAt(room.deadline_at);
        }

        // Realtime — broadcast (verdict_ready) + postgres_changes
        // (members/votes/rooms).
        const channel = client
          .channel(`room:${roomId}`)
          .on(
            "postgres_changes",
            {
              event: POSTGRES_CHANGE_INSERT,
              schema: "public",
              table: "members",
              filter: `room_id=eq.${roomId}`,
            },
            (payload) => {
              const row = payload.new as MembersRow;
              setMembers((prev) =>
                prev.some((m) => m.user_id === row.user_id)
                  ? prev
                  : [...prev, row],
              );
            },
          )
          .on(
            "postgres_changes",
            {
              event: POSTGRES_CHANGE_INSERT,
              schema: "public",
              table: "votes",
              filter: `room_id=eq.${roomId}`,
            },
            (payload) => {
              const row = payload.new as VotesRow;
              setAnsweredIds((prev) => {
                if (prev.has(row.user_id)) return prev;
                const next = new Set(prev);
                next.add(row.user_id);
                return next;
              });
            },
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "rooms",
              filter: `id=eq.${roomId}`,
            },
            (payload) => {
              const row = payload.new as RoomsRow;
              setRoomStatus(row.status);
              setDeadlineAt(row.deadline_at);
            },
          )
          .on("broadcast", { event: "verdict_ready" }, () => {
            setRoomStatus("verdict_ready");
          });

        channel.subscribe();
        channelRef.current = channel;

        // Did the caller already vote on a prior visit? Skip ahead to
        // Waiting/Verdict (idempotent — votes has a unique PK).
        if (
          ((voteRows as VotesRow[] | null) ?? []).some((v) => v.user_id === uid)
        ) {
          if (room?.status === "verdict_ready" || room?.status === "locked") {
            setPhase({ kind: "waiting" }); // fetchVerdict will flip
          } else {
            setPhase({ kind: "waiting" });
          }
        } else if (room?.status === "verdict_ready" || room?.status === "locked") {
          // Verdict already shipped; treat the user as a late-joiner
          // and skip the quiz altogether.
          setPhase({ kind: "waiting" });
        } else {
          setPhase({ kind: "quiz", step: 1 });
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to join the session.";
        setPhase({ kind: "error", message });
      }
    }
    void boot();
    return () => {
      cancelled = true;
      const ch = channelRef.current;
      if (ch) {
        void ch.unsubscribe();
      }
      channelRef.current = null;
    };
  }, [roomId]);

  // Countdown tick.
  useEffect(() => {
    if (!deadlineAt) {
      setSecondsRemaining(null);
      return;
    }
    const target = new Date(deadlineAt).getTime();
    function tick() {
      const remaining = Math.max(
        0,
        Math.floor((target - Date.now()) / 1000),
      );
      setSecondsRemaining(remaining);
    }
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [deadlineAt]);

  // Fetch verdict when the room flips to verdict_ready.
  useEffect(() => {
    if (
      roomStatus !== "verdict_ready" &&
      roomStatus !== "locked"
    ) {
      return;
    }
    let cancelled = false;
    async function loadVerdict() {
      try {
        const client = getSupabaseClient();
        const { data: verdictRows } = await client
          .from("verdicts")
          .select("id, room_id, option_id, computed_at, method, rule_text")
          .eq("room_id", roomId)
          .limit(1);
        const verdict = (verdictRows as VerdictRow[] | null)?.[0];
        if (!verdict) return;

        // No-survivor: just shape with empty option/cuts but real
        // votes for surviving-hard-needs label.
        if (verdict.method === "no_survivor") {
          const { data: voteRows } = await client
            .from("votes")
            .select(
              "user_id, q1_vetoes, q2_budget, q3_walk_minutes, q4_vibe, q5_regret",
            )
            .eq("room_id", roomId);
          if (cancelled) return;
          const view = shapeVerdictView({
            verdict,
            winningOption: null,
            cuts: [],
            cutOptions: {},
            votes: (voteRows as VoteSummaryRow[] | null) ?? [],
            memberCount: members.length,
          });
          if (view) setPhase({ kind: "verdict", view });
          return;
        }

        const [
          { data: optionRows },
          { data: cutRows },
          { data: voteRows },
        ] = await Promise.all([
          client
            .from("options")
            .select("id, payload")
            .eq("id", verdict.option_id ?? "")
            .limit(1),
          client
            .from("option_cuts")
            .select("verdict_id, option_id, cut_reason, cut_text")
            .eq("verdict_id", verdict.id),
          client
            .from("votes")
            .select(
              "user_id, q1_vetoes, q2_budget, q3_walk_minutes, q4_vibe, q5_regret",
            )
            .eq("room_id", roomId),
        ]);

        const winningOption = (optionRows as OptionRow[] | null)?.[0] ?? null;
        const cuts = (cutRows as CutRow[] | null) ?? [];

        // Fetch the option metadata for each cut so the drawer can
        // render the human-readable name.
        const cutOptionIds = cuts.map((c) => c.option_id);
        let cutOptionsMap: Record<string, OptionRow> = {};
        if (cutOptionIds.length > 0) {
          const { data: cutOptionRows } = await client
            .from("options")
            .select("id, payload")
            .in("id", cutOptionIds);
          for (const row of (cutOptionRows as OptionRow[] | null) ?? []) {
            cutOptionsMap[row.id] = row;
          }
        }

        if (cancelled) return;
        const view = shapeVerdictView({
          verdict,
          winningOption,
          cuts,
          cutOptions: cutOptionsMap,
          votes: (voteRows as VoteSummaryRow[] | null) ?? [],
          memberCount: members.length,
        });
        if (view) setPhase({ kind: "verdict", view });
      } catch {
        // Realtime will retry — don't surface a transient error here.
      }
    }
    void loadVerdict();
    return () => {
      cancelled = true;
    };
  }, [members.length, roomId, roomStatus]);

  // ────────────────────────────────────────────────────────────────
  // Quiz handlers.
  // ────────────────────────────────────────────────────────────────

  const handleToggleVeto = useCallback((chip: string) => {
    setQ1Vetoes((prev) => toggleVeto(prev, chip));
  }, []);

  const handleAdvance = useCallback(
    (nextStep: 1 | 2 | 3 | 4 | 5) => {
      setPhase({ kind: "quiz", step: nextStep });
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!userId) return;
    setPhase({ kind: "submitting" });
    try {
      const row: VoteRow = buildVoteRow({
        roomId,
        userId,
        q1Vetoes,
        q2Budget,
        q3WalkMinutes: q3Walk,
        q4Vibe,
        q5Regret: q5Ratings,
      });
      const client = getSupabaseClient();
      const { error } = await client.from("votes").insert(row);
      // 23505 (duplicate key) — the user already submitted in a prior
      // session. Surface waiting either way.
      if (error && !isUniqueViolation(error)) {
        throw error;
      }
      setAnsweredIds((prev) => {
        if (prev.has(userId)) return prev;
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
      setPhase({ kind: "waiting" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit your vote.";
      setPhase({ kind: "error", message });
    }
  }, [q1Vetoes, q2Budget, q3Walk, q4Vibe, q5Ratings, roomId, userId]);

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  const memberViews = useMemo<WaitingMemberView[]>(() => {
    return members.map((m, i) => ({
      id: m.user_id,
      initial: `${i + 1}`, // Anonymous — no display-name source on web.
      answered: answeredIds.has(m.user_id),
      isSelf: m.user_id === userId,
    }));
  }, [answeredIds, members, userId]);

  if (phase.kind === "booting" || phase.kind === "joining") {
    return (
      <FullScreenMessage
        eyebrow="Joining"
        body="Connecting you to the room…"
      />
    );
  }

  if (phase.kind === "error") {
    return (
      <FullScreenMessage
        eyebrow="Couldn't join"
        body={phase.message}
      />
    );
  }

  if (phase.kind === "quiz") {
    switch (phase.step) {
      case 1:
        return (
          <QuizQ1Vetoes
            selected={q1Vetoes}
            onToggle={handleToggleVeto}
            onAdvance={() => handleAdvance(2)}
          />
        );
      case 2:
        return (
          <QuizQ2Budget
            tier={q2Budget}
            onSelect={(tier) => setQ2Budget(tier)}
            onAdvance={() => handleAdvance(3)}
          />
        );
      case 3:
        return (
          <QuizQ3Distance
            value={q3Walk}
            onSelect={(walk) => setQ3Walk(walk)}
            onAdvance={() => handleAdvance(4)}
          />
        );
      case 4:
        return (
          <QuizQ4Vibe
            value={q4Vibe}
            onSelect={(idx) => setQ4Vibe(idx)}
            onAdvance={() => handleAdvance(5)}
          />
        );
      case 5:
        return (
          <QuizQ5Regret
            candidates={DUMMY_CANDIDATES}
            ratings={q5Ratings}
            onRate={(id, score) =>
              setQ5Ratings((prev) => ({ ...prev, [id]: score }))
            }
            onSubmit={handleSubmit}
          />
        );
    }
  }

  if (phase.kind === "submitting") {
    return (
      <FullScreenMessage
        eyebrow="Submitting"
        body="Locking in your answers…"
      />
    );
  }

  if (phase.kind === "waiting") {
    return (
      <WaitingScreen
        members={memberViews}
        secondsRemaining={secondsRemaining}
        outstandingName={undefined}
        // sg-03 / TB-02 (v1.1): web-fallback invitees are always
        // anonymous per ADR 0007 — `ensureAnonSession` only ever mints
        // anonymous sessions on the browser. If/when web Apple sign-in
        // ever lands, this flag flips off for those users and the CTA
        // suppresses itself.
        isAnonymous={true}
        onDownloadApp={() => {
          void emitDownloadCtaEvent({ roomId, userId });
          // Open in a new tab so the user keeps their place in S04 —
          // the verdict still computes for the room they voted in.
          if (typeof window !== "undefined") {
            window.open(APP_STORE_URL, "_blank", "noopener,noreferrer");
          }
        }}
      />
    );
  }

  // phase.kind === "verdict"
  return <VerdictReadOnly view={phase.view} />;
}

function FullScreenMessage({
  eyebrow,
  body,
}: {
  eyebrow: string;
  body: string;
}) {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background:
          "linear-gradient(180deg, var(--g1) 0%, var(--g2) 32%, var(--g3) 66%, var(--g4) 100%)",
        color: "var(--paper)",
        fontFamily: "var(--ff-display)",
        padding: "var(--sp-6)",
        textAlign: "center",
      }}
    >
      <div>
        <p
          style={{
            fontFamily: "var(--ff-body)",
            fontWeight: 700,
            fontSize: "var(--fz-eyebrow)",
            letterSpacing: "var(--tr-eyebrow)",
            textTransform: "uppercase",
            opacity: 0.78,
            marginBottom: "var(--sp-3)",
          }}
        >
          {eyebrow}
        </p>
        <p
          style={{
            fontFamily: "var(--ff-body)",
            fontWeight: 600,
            fontSize: "var(--fz-body)",
            margin: 0,
            opacity: 0.86,
          }}
        >
          {body}
        </p>
      </div>
    </main>
  );
}

// sg-03 / TB-02 (v1.1) — emit the `waiting_download_cta_tapped` event
// into the Supabase `events` table per ADR 0005. Fire-and-forget: a
// telemetry write must not block the App Store navigation. Errors are
// swallowed (a missing telemetry row is recoverable; a stuck CTA is
// not) — Supabase logs surface the failure if it ever matters.
//
// Mirrors the ADR 0005 vocabulary used by iOS `TelemetryWriter`: an
// `events` row with `event_type`, `room_id`, `user_id`, and an empty
// `properties` payload. The web client doesn't share TelemetryWriter
// because the iOS version is `@MainActor`-bound and consumes the
// SwiftUI app's `SupabaseClient`; the web equivalent is a one-line
// PostgREST insert.
async function emitDownloadCtaEvent({
  roomId,
  userId,
}: {
  roomId: string;
  userId: string | null;
}): Promise<void> {
  try {
    const client = getSupabaseClient();
    await client.from("events").insert({
      event_type: "waiting_download_cta_tapped",
      room_id: roomId,
      user_id: userId,
      properties: {},
    });
  } catch {
    // Swallow — telemetry must never block the App Store handoff.
  }
}

// Lightweight duplicate-key detection for the votes insert. Mirrors
// iOS `QuizCoordinator.isUniqueViolation`.
function isUniqueViolation(error: unknown): boolean {
  if (!error) return false;
  const description = JSON.stringify(error);
  return (
    description.includes("23505") ||
    description.includes("duplicate key value")
  );
}
