// GetToIt web — Session orchestrator.
//
// Client component mounted at `/s/<sessionId>`. Owns the entire web
// session lifecycle:
//
//   1. Anonymous sign-in (idempotent).
//   2. Insert the caller as a `members` row (idempotent — the unique
//      (room_id, user_id) primary key swallows retries).
//   3. Drive the quiz-redesign 5-question quiz; on Q4 -> Q5 request the
//      server-assigned Q5 card set; submit the `votes` row.
//   4. Subscribe to Realtime so the Waiting + Verdict surfaces stay in
//      lockstep with the mobile app.
//   5. Once `rooms.status === 'verdict_ready'` (or the broadcast
//      arrives), fetch the verdict + Plan-state display data and render
//      the read-only S05 surface.
//
// tb-WF-10 — the quiz is brought to quiz-redesign parity: scenario questions
// (Q1 cuisine craving, Q3 reputation), the generic `q1`..`q5` jsonb
// votes (via the shared `votes-wire.ts` contract), server-assigned
// Google Q5 cards (replacing the retired `DUMMY_CANDIDATES`), and the
// Q5 strict-factorial probe with the `no-results` honest-degradation
// path. A resume into Q5 (the user re-clicked the link past Q4)
// re-fires the Q5 card-set request so the rater has cards.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildVoteRow,
  QUIZ_DEFAULTS,
  REPUTATION_NO_PREFERENCE,
  toggleCuisine,
  toggleCuisineNoPreference,
  type CuisineSelection,
  type VoteRow,
} from "../lib/quiz";

import {
  buildQ5Ratings,
  seedRatings,
  type QuizCandidate,
} from "../lib/candidate-fetch";

import {
  shapeVerdictView,
  type VerdictRow,
  type VerdictView,
} from "../lib/verdict";

import { APP_STORE_URL } from "../lib/app-store";
import { mintClaimCode } from "../lib/claim-code";
import { ensureAnonSession, getSupabaseClient } from "../lib/supabase";
import { readRoomPlanState, writeQuizProgress } from "../lib/invitee-shell";
import type { QuizProgressState } from "../lib/quiz-progress";

import { LeaveConfirmSheet } from "./InviteShellSurfaces";
import {
  QuizQ1Cuisine,
  QuizQ2Budget,
  QuizQ3Reputation,
  QuizQ4Vibe,
  QuizQ5,
  type Q5State,
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
type VotesPresenceRow = { room_id: string; user_id: string };
type RoomsRow = {
  id: string;
  status: string;
  deadline_at: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_tz: string | null;
  radius_meters: number | null;
  session_params: { meal_time?: string } | null;
};

const POSTGRES_CHANGE_INSERT = "INSERT" as const;

type Q5CardSetResponse =
  | {
      status: "assigned";
      cards: Array<{
        googlePlaceId: string;
        displayName: string;
        axisReceipt: { droppedAxis: QuizCandidate["droppedAxis"] };
      }>;
    }
  | { status: "no_results" };

type Q5CardSetFetchResult = {
  candidates: QuizCandidate[];
  source: "fetched" | "no-results";
};

export function SessionRoom({
  roomId,
  initialProgress,
  onLeave,
}: {
  roomId: string;
  /** tb-WF-12 (web-01 §B) — the web invitee's in-flight quiz state, as
   *  read off `members.quiz_progress` by the shell on a re-click. When
   *  present, boot hydrates the quiz answers and resumes at
   *  `lastIndex` instead of restarting at Q1. Absent on the `/s/`
   *  session route and on a fresh first-landing. */
  initialProgress?: QuizProgressState;
  /** tb-WF-12 (web-01 §E) — when provided, the Q1–Q5 quiz chrome
   *  carries a `Leave` affordance; confirming it calls this handler.
   *  The shell drops the `members` row and routes to the "you left
   *  this plan" terminal. Absent off the web invitee shell. */
  onLeave?: () => Promise<void> | void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "booting" });
  const [userId, setUserId] = useState<string | null>(null);

  // Quiz state — quiz redesign. Seeded from `initialProgress` when the shell
  // handed a resume payload (web-01 §B); otherwise the quiz defaults.
  const [cuisine, setCuisine] = useState<CuisineSelection>(() => ({
    cuisines: new Set(initialProgress?.cuisines ?? []),
    noPreference: initialProgress?.noPreference ?? false,
  }));
  const [budget, setBudget] = useState<number>(
    initialProgress?.budget ?? QUIZ_DEFAULTS.budget,
  );
  const [reputation, setReputation] = useState<string>(
    initialProgress?.reputation ?? QUIZ_DEFAULTS.reputation,
  );
  const [vibe, setVibe] = useState<number>(
    initialProgress?.vibe ?? QUIZ_DEFAULTS.vibe,
  );

  // §E — the leave-confirm sheet open state + in-flight flag.
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // The resume payload is read once by the shell and is stable for the
  // life of this mount; a ref keeps it out of the boot effect's deps.
  const initialProgressRef = useRef(initialProgress);

  // Q5 candidate-fetch state.
  const [q5State, setQ5State] = useState<Q5State>("loading");
  const [candidates, setCandidates] = useState<QuizCandidate[]>([]);
  const [q5Ratings, setQ5Ratings] = useState<Record<string, number>>({});

  // The in-flight Q5 card-set fetch, so a resume / re-render folds into
  // the running fetch instead of firing the Edge Function twice.
  const fetchPromiseRef = useRef<Promise<Q5CardSetFetchResult> | null>(null);

  // Realtime + room state.
  const [members, setMembers] = useState<MembersRow[]>([]);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(() => new Set());
  const [roomStatus, setRoomStatus] = useState<string>("open");
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // bug-20 — a monotonic re-fetch signal for the §C verdict live-update.
  // An initiator reroll re-runs the verdict in place: room status stays
  // `verdict_ready`, so a `verdict_ready` rebroadcast (or a `rooms`
  // UPDATE that keeps the status decided) sets `roomStatus` to its
  // current value and React bails — the verdict-fetch effect, keyed on
  // room id / status / user id, would never re-fire. The broadcast +
  // UPDATE handlers bump this counter instead; the counter always
  // changes, so folding it into the effect's deps re-runs the fetch on
  // every rebroadcast. It starts at 0 and the effect's status guard
  // still gates the first load, so there is no double-fetch on mount.
  const [verdictRefetchSignal, setVerdictRefetchSignal] = useState(0);

  const channelRef = useRef<ReturnType<
    ReturnType<typeof getSupabaseClient>["channel"]
  > | null>(null);

  // ----------------------------------------------------------------
  // Boot — anon auth + member insert + initial fetches + Realtime.
  // ----------------------------------------------------------------
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
          throw memberErr;
        }

        // Hydrate the avatar row + answered set + room context.
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
              .select(
                "id, status, deadline_at, location_lat, location_lng, " +
                  "location_tz, radius_meters, session_params",
              )
              .eq("id", roomId)
              .limit(1),
          ]);
        if (cancelled) return;
        setMembers((memberRows as MembersRow[] | null) ?? []);
        setAnsweredIds(
          new Set(
            ((voteRows as VotesPresenceRow[] | null) ?? []).map(
              (v) => v.user_id,
            ),
          ),
        );
        const room = (roomRows as RoomsRow[] | null)?.[0];
        if (room) {
          setRoomStatus(room.status);
          setDeadlineAt(room.deadline_at);
        }

        // Realtime — broadcast (verdict_ready) + postgres_changes.
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
              const row = payload.new as VotesPresenceRow;
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
              // bug-20 — a `rooms` UPDATE that keeps the room decided
              // (an in-place reroll fires as an UPDATE that does not
              // move the status off `verdict_ready` / `locked`) must
              // still re-fetch the §C verdict; the status set above is
              // a no-op so the effect deps would not change on their
              // own. Bump the re-fetch signal.
              if (row.status === "verdict_ready" || row.status === "locked") {
                setVerdictRefetchSignal((n) => n + 1);
              }
            },
          )
          .on("broadcast", { event: "verdict_ready" }, () => {
            setRoomStatus("verdict_ready");
            // bug-20 — the rebroadcast re-sets `roomStatus` to its
            // current value on an in-place reroll, so React bails and
            // the verdict-fetch effect's deps do not change. Bump the
            // monotonic re-fetch signal so the §C card live-updates.
            setVerdictRefetchSignal((n) => n + 1);
          });

        channel.subscribe();
        channelRef.current = channel;

        // Did the caller already vote on a prior visit? Skip ahead to
        // Waiting/Verdict (idempotent — votes has a unique PK). This is
        // the web-01 §B "already voted ? Waiting" resume case.
        if (
          ((voteRows as VotesPresenceRow[] | null) ?? []).some(
            (v) => v.user_id === uid,
          )
        ) {
          setPhase({ kind: "waiting" });
        } else if (
          room?.status === "verdict_ready" ||
          room?.status === "locked"
        ) {
          // Verdict already shipped; treat the user as a late-joiner.
          // web-01 §B "verdict ? Verdict" resume case.
          setPhase({ kind: "waiting" });
        } else {
          // web-01 §B mid-quiz resume — start on the last-answered
          // question the shell read off `members.quiz_progress`. A
          // fresh first-landing has `initialProgress` absent / at
          // `lastIndex` 1, so this still starts at Q1 for new
          // invitees. `clampStep` guards a malformed payload.
          setPhase({
            kind: "quiz",
            step: clampStep(initialProgressRef.current?.lastIndex),
          });
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

  // Fetch the verdict when the room flips to verdict_ready — and
  // re-fetch on every subsequent `verdict_ready` rebroadcast.
  //
  // bug-20 — `web-01-invitee-shell` §C "Live update": while the §C
  // verdict card is open, an initiator reroll that changes the verdict
  // must live-update the card. A reroll re-runs the verdict in place,
  // so `roomStatus` stays `verdict_ready` — folding `verdictRefetchSignal`
  // (bumped by the broadcast / UPDATE handlers) into the deps re-runs
  // this effect on every rebroadcast. The re-fetch flows through the
  // existing shaping path, so a reroll that swaps the default and
  // no-survivor variants updates the card across both. The venue-name
  // cross-fade is already wired in `WebVerdictCard` (a keyed re-mount +
  // a 320ms `var(--ease-out)` animation) and plays automatically once
  // the rendered venue name changes.
  //
  // bug-17 — the web invitee verdict surface conforms to the locked
  // `web-01-invitee-shell` §C: plan name + verdict venue only. So the
  // verdict read needs just two things — the verdict `method` (default
  // vs `no_survivor`) and the plan name + winning venue name. It no
  // longer loads `option_cuts` or `votes`: §C carries no receipts and
  // no per-axis cuts.
  //
  // `plans` carries a creator-only SELECT policy, so a web invitee
  // cannot read `plans.name` directly. `readRoomPlanState` resolves the
  // plan name + verdict place name through the joiner-readable
  // `plans_decided_for_user` / `plans_history_for_user` RPCs — the same
  // path the `/join/<roomId>` shell uses for its §C decided card.
  useEffect(() => {
    if (
      roomStatus !== "verdict_ready" &&
      roomStatus !== "locked"
    ) {
      return;
    }
    if (!userId) return;
    let cancelled = false;
    async function loadVerdict() {
      try {
        const client = getSupabaseClient();
        const [{ data: verdictRows }, planState] = await Promise.all([
          client
            .from("verdicts")
            .select("id, room_id, option_id, computed_at, method, rule_text")
            .eq("room_id", roomId)
            .limit(1),
          readRoomPlanState(client, roomId, userId as string),
        ]);
        const verdict = (verdictRows as VerdictRow[] | null)?.[0];
        if (!verdict) return;

        // The joiner RPC inlines the plan name + the winning venue
        // name. A room with no linked Plan (a pre-workflow-overhaul
        // leftover) resolves `open` — fall back to an empty plan name;
        // §C still renders a venue-only card.
        const planName =
          planState.kind === "decided" ? planState.planName : "";
        const verdictPlaceName =
          planState.kind === "decided" ? planState.verdictPlaceName : "";

        if (cancelled) return;
        const view = shapeVerdictView({
          verdict,
          planName,
          verdictPlaceName,
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
  }, [roomId, roomStatus, userId, verdictRefetchSignal]);

  // ----------------------------------------------------------------
  // Q5 card-set fetch.
  // ----------------------------------------------------------------

  /** Request the server-assigned Q5 card set and fold its result into
   *  Q5 state. Idempotent within a session — a fetch already in flight
   *  (or resolved) is reused rather than re-firing the Edge Function.
   *
   *  This runs both on the Q4 -> Q5 advance AND on a resume that lands
   *  the user directly on Q5 (the issue's resume-into-Q5 requirement):
   *  Q5 cannot render the rater without cards, so the fetch must fire
   *  whenever Q5 is entered, regardless of how. */
  const startCandidateFetch = useCallback(() => {
    if (fetchPromiseRef.current) return; // already running / resolved
    setQ5State("loading");
    const promise = fetchQ5CardSet(roomId);
    fetchPromiseRef.current = promise;
    void promise.then((result) => {
      setCandidates(result.candidates);
      setQ5Ratings(seedRatings(result.candidates));
      setQ5State(result.source === "fetched" ? "default" : "no-results");
    }).catch(() => {
      setCandidates([]);
      setQ5Ratings({});
      setQ5State("no-results");
    });
  }, [roomId]);

  // When the quiz lands on Q5 — by advancing OR by resume — request
  // the card set if it has not already loaded.
  useEffect(() => {
    if (phase.kind === "quiz" && phase.step === 5) {
      startCandidateFetch();
    }
  }, [phase, startCandidateFetch]);

  // ----------------------------------------------------------------
  // Quiz handlers.
  // ----------------------------------------------------------------

  // Snapshot the current quiz answers into a `quiz_progress` payload.
  // Used on every advance so a re-clicking invitee resumes with their
  // prior answers intact (web-01 §B, decision doc §Q5).
  const snapshotProgress = useCallback(
    (lastIndex: number): QuizProgressState => ({
      lastIndex,
      cuisines: cuisine.noPreference
        ? []
        : Array.from(cuisine.cuisines).sort(),
      noPreference: cuisine.noPreference,
      budget,
      reputation,
      vibe,
    }),
    [budget, cuisine, reputation, vibe],
  );

  const handleAdvance = useCallback(
    (nextStep: 1 | 2 | 3 | 4 | 5) => {
      setPhase({ kind: "quiz", step: nextStep });
      // Persist the in-flight progress so a re-click resumes here.
      // Best-effort (`writeQuizProgress` swallows failures) — the
      // advance must never block on the round-trip.
      void writeQuizProgress(
        getSupabaseClient(),
        roomId,
        snapshotProgress(nextStep),
      );
    },
    [roomId, snapshotProgress],
  );

  const handleSubmit = useCallback(async () => {
    if (!userId) return;
    setPhase({ kind: "submitting" });
    try {
      const client = getSupabaseClient();

      const row: VoteRow = buildVoteRow({
        roomId,
        userId,
        cuisines: cuisine.cuisines,
        noPreference: cuisine.noPreference,
        budget,
        reputation,
        vibe,
        // The factorial probe — one `{ droppedAxis, score }` entry per
        // card. Empty on the no-results path (no cards were shown).
        q5Ratings: buildQ5Ratings(candidates, q5Ratings),
      });
      const { error } = await client.from("votes").insert(row);
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
  }, [budget, candidates, cuisine, q5Ratings, reputation, roomId, userId, vibe]);

  // ----------------------------------------------------------------
  // §E — Leave (web-01 §E, decision doc §Q7).
  // ----------------------------------------------------------------

  /** Confirm the leave: drop the `members` row via the shell's
   *  `onLeave` handler. On a rejected delete the sheet stays open with
   *  the error swallowed silently — the invitee can retry or dismiss;
   *  routing to the terminal as if the leave succeeded would be a lie. */
  const handleLeaveConfirm = useCallback(async () => {
    if (!onLeave || leaving) return;
    setLeaving(true);
    try {
      await onLeave();
      // On success the shell unmounts this `SessionRoom` for the
      // "you left this plan" terminal — no local phase change needed.
    } catch {
      // Delete failed — keep the invitee on the quiz with the sheet
      // open. `leaving` resets so they can retry or dismiss.
    } finally {
      setLeaving(false);
    }
  }, [leaving, onLeave]);

  // The Q1–Q5 chrome only gets a `Leave` affordance when the shell
  // wired `onLeave` (the web invitee shell). Off that host it is
  // omitted — the `/s/` session route has no leave verb.
  const quizLeaveHandler = onLeave
    ? () => setLeaveConfirmOpen(true)
    : undefined;

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  const memberViews = useMemo<WaitingMemberView[]>(() => {
    return members.map((m, i) => ({
      id: m.user_id,
      initial: `${i + 1}`,
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
    let screen: JSX.Element | null = null;
    switch (phase.step) {
      case 1:
        screen = (
          <QuizQ1Cuisine
            selection={cuisine}
            onToggleCuisine={(id) =>
              setCuisine((prev) => toggleCuisine(prev, id))
            }
            onToggleNoPreference={() =>
              setCuisine((prev) => toggleCuisineNoPreference(prev))
            }
            onAdvance={() => handleAdvance(2)}
            onLeave={quizLeaveHandler}
          />
        );
        break;
      case 2:
        screen = (
          <QuizQ2Budget
            tier={budget}
            onSelect={(tier) => setBudget(tier)}
            onAdvance={() => handleAdvance(3)}
            onLeave={quizLeaveHandler}
          />
        );
        break;
      case 3:
        screen = (
          <QuizQ3Reputation
            value={reputation}
            onSelect={(id) => setReputation(id)}
            onAdvance={() => handleAdvance(4)}
            onLeave={quizLeaveHandler}
          />
        );
        break;
      case 4:
        screen = (
          <QuizQ4Vibe
            value={vibe}
            onSelect={(idx) => setVibe(idx)}
            onAdvance={() => handleAdvance(5)}
            onLeave={quizLeaveHandler}
          />
        );
        break;
      case 5:
        screen = (
          <QuizQ5
            state={q5State}
            candidates={candidates}
            ratings={q5Ratings}
            onRate={(id, score) =>
              setQ5Ratings((prev) => ({ ...prev, [id]: score }))
            }
            onSubmit={handleSubmit}
            onLeave={quizLeaveHandler}
          />
        );
        break;
    }
    return (
      <>
        {screen}
        {/* §E — the leave-confirm sheet overlays the quiz when the
            chrome `Leave` affordance is tapped. The web invitee shell
            is the only host that wires `onLeave`. */}
        {leaveConfirmOpen ? (
          <LeaveConfirmSheet
            leaving={leaving}
            onConfirm={handleLeaveConfirm}
            onDismiss={() => {
              if (leaving) return;
              setLeaveConfirmOpen(false);
            }}
          />
        ) : null}
      </>
    );
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
    const appStoreUrl = APP_STORE_URL;

    return (
      <WaitingScreen
        members={memberViews}
        secondsRemaining={secondsRemaining}
        outstandingName={undefined}
        isAnonymous={true}
        onDownloadApp={
          appStoreUrl
            ? () => {
                void emitDownloadCtaEvent({ roomId, userId });
                if (typeof window !== "undefined") {
                  window.open(appStoreUrl, "_blank", "noopener,noreferrer");
                }
              }
            : undefined
        }
        // sg-WF-8 / tb-WF-13 — the "Getting the app?" claim-code mint
        // affordance. The web invitee on the Waiting screen has a real
        // membership + a stable anonymous identity worth carrying over;
        // tapping the affordance lazily mints a single-use code via the
        // `mint-claim-code` Edge Function. `mintClaimCode` reads its own
        // refresh token off the live session — no args needed here.
        onMintClaimCode={() => mintClaimCode()}
      />
    );
  }

  // phase.kind === "verdict" — the web-01 §C read-only verdict card.
  // sg-WF-8 / tb-WF-13 — the "Getting the app?" claim-code mint line.
  // §C requires it on the verdict card: a returning invitee of a
  // decided Plan lands on §C, not Waiting, so a Waiting-only affordance
  // would strand them (bug-17 grill Q3). `mintClaimCode` reads its own
  // refresh token off the live session — no args needed here.
  return (
    <VerdictReadOnly
      view={phase.view}
      onMintClaimCode={() => mintClaimCode()}
    />
  );
}

async function fetchQ5CardSet(roomId: string): Promise<Q5CardSetFetchResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke<Q5CardSetResponse>(
    "q5-card-set",
    { body: { room_id: roomId } },
  );
  if (error || !data || data.status === "no_results") {
    return { candidates: [], source: "no-results" };
  }

  return {
    source: "fetched",
    candidates: data.cards.map((card) => ({
      id: card.googlePlaceId,
      name: card.displayName,
      meta: "",
      droppedAxis: card.axisReceipt.droppedAxis,
    })),
  };
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

// sg-03 / TB-02 (quiz redesign) — emit the `waiting_download_cta_tapped` event
// into the Supabase `events` table per ADR 0005. Fire-and-forget.
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

/** Clamp a resume `lastIndex` into the 1..5 quiz-step range. A missing
 *  / malformed payload resumes at Q1 — `quiz_progress` is a resume
 *  convenience, never a verdict input, so a bad value costs a re-walk,
 *  never an error. */
function clampStep(value: number | undefined): 1 | 2 | 3 | 4 | 5 {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  const clamped = Math.min(5, Math.max(1, Math.round(value)));
  return clamped as 1 | 2 | 3 | 4 | 5;
}

// Lightweight duplicate-key detection for the votes insert. Mirrors
// Legacy Swift `QuizCoordinator.isUniqueViolation`; active app lives in `mobile/`.
function isUniqueViolation(error: unknown): boolean {
  if (!error) return false;
  const description = JSON.stringify(error);
  return (
    description.includes("23505") ||
    description.includes("duplicate key value")
  );
}

export { REPUTATION_NO_PREFERENCE };
