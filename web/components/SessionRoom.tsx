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

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import {
  buildVoteRow,
  QUIZ_DEFAULTS,
  REPUTATION_NO_PREFERENCE,
  toggleCuisine,
  toggleCuisineNoPreference,
  type CuisineSelection,
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

type QuizStep = Extract<Phase, { kind: "quiz" }>["step"];

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

type SupabaseClient = ReturnType<typeof getSupabaseClient>;
type RoomChannel = ReturnType<SupabaseClient["channel"]>;

type QuizFormState = {
  cuisine: CuisineSelection;
  budget: number;
  reputation: string;
  vibe: number;
};

type QuizFormAction =
  | { type: "toggle-cuisine"; id: string }
  | { type: "toggle-no-preference" }
  | { type: "budget"; value: 1 | 2 | 3 | 4 }
  | { type: "reputation"; value: string }
  | { type: "vibe"; value: number };

type Q5Model = {
  state: Q5State;
  candidates: QuizCandidate[];
  ratings: Record<string, number>;
};

type Q5Action =
  | { type: "loading" }
  | { type: "loaded"; result: Q5CardSetFetchResult }
  | { type: "rate"; id: string; score: number };

type RoomRuntimeState = {
  members: MembersRow[];
  answeredIds: Set<string>;
  deadlineAt: string | null;
};

type RoomRuntimeAction =
  | {
      type: "seed";
      members: MembersRow[];
      votes: VotesPresenceRow[];
      deadlineAt: string | null;
    }
  | { type: "member-inserted"; row: MembersRow }
  | { type: "vote-inserted"; row: VotesPresenceRow }
  | { type: "deadline"; deadlineAt: string | null };

type LeaveState = {
  confirmOpen: boolean;
  leaving: boolean;
};

type LeaveAction =
  | { type: "open" }
  | { type: "dismiss" }
  | { type: "leaving"; value: boolean };

const initialQ5Model: Q5Model = {
  state: "loading",
  candidates: [],
  ratings: {},
};

const initialRoomRuntime: RoomRuntimeState = {
  members: [],
  answeredIds: new Set(),
  deadlineAt: null,
};

const initialLeaveState: LeaveState = {
  confirmOpen: false,
  leaving: false,
};

const fullScreenMainStyle: CSSProperties = {
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
};

const fullScreenEyebrowStyle: CSSProperties = {
  fontFamily: "var(--ff-body)",
  fontWeight: 700,
  fontSize: "var(--fz-eyebrow)",
  letterSpacing: "var(--tr-eyebrow)",
  textTransform: "uppercase",
  opacity: 0.78,
  marginBottom: "var(--sp-3)",
};

const fullScreenBodyStyle: CSSProperties = {
  fontFamily: "var(--ff-body)",
  fontWeight: 600,
  fontSize: "var(--fz-body)",
  margin: 0,
  opacity: 0.86,
  overflowWrap: "anywhere",
};

const fullScreenContentStyle: CSSProperties = {
  width: "100%",
  maxWidth: 360,
};

function createQuizFormState(
  initialProgress?: QuizProgressState,
): QuizFormState {
  return {
    cuisine: {
      cuisines: new Set(initialProgress?.cuisines ?? []),
      noPreference: initialProgress?.noPreference ?? false,
    },
    budget: initialProgress?.budget ?? QUIZ_DEFAULTS.budget,
    reputation: initialProgress?.reputation ?? QUIZ_DEFAULTS.reputation,
    vibe: initialProgress?.vibe ?? QUIZ_DEFAULTS.vibe,
  };
}

function quizFormReducer(
  state: QuizFormState,
  action: QuizFormAction,
): QuizFormState {
  switch (action.type) {
    case "toggle-cuisine":
      return { ...state, cuisine: toggleCuisine(state.cuisine, action.id) };
    case "toggle-no-preference":
      return {
        ...state,
        cuisine: toggleCuisineNoPreference(state.cuisine),
      };
    case "budget":
      return { ...state, budget: action.value };
    case "reputation":
      return { ...state, reputation: action.value };
    case "vibe":
      return { ...state, vibe: action.value };
  }
}

function q5Reducer(state: Q5Model, action: Q5Action): Q5Model {
  switch (action.type) {
    case "loading":
      return { ...state, state: "loading" };
    case "loaded":
      if (action.result.source === "no-results") {
        return { state: "no-results", candidates: [], ratings: {} };
      }
      return {
        state: "default",
        candidates: action.result.candidates,
        ratings: seedRatings(action.result.candidates),
      };
    case "rate":
      return {
        ...state,
        ratings: { ...state.ratings, [action.id]: action.score },
      };
  }
}

function roomRuntimeReducer(
  state: RoomRuntimeState,
  action: RoomRuntimeAction,
): RoomRuntimeState {
  switch (action.type) {
    case "seed":
      return {
        members: action.members,
        answeredIds: new Set(action.votes.map((v) => v.user_id)),
        deadlineAt: action.deadlineAt,
      };
    case "member-inserted":
      if (state.members.some((m) => m.user_id === action.row.user_id)) {
        return state;
      }
      return { ...state, members: [...state.members, action.row] };
    case "vote-inserted": {
      if (state.answeredIds.has(action.row.user_id)) return state;
      const answeredIds = new Set(state.answeredIds);
      answeredIds.add(action.row.user_id);
      return { ...state, answeredIds };
    }
    case "deadline":
      return { ...state, deadlineAt: action.deadlineAt };
  }
}

function leaveReducer(state: LeaveState, action: LeaveAction): LeaveState {
  switch (action.type) {
    case "open":
      return { ...state, confirmOpen: true };
    case "dismiss":
      return state.leaving ? state : { ...state, confirmOpen: false };
    case "leaving":
      return { ...state, leaving: action.value };
  }
}

function isDecidedStatus(status: string | undefined): boolean {
  return status === "verdict_ready" || status === "locked";
}

async function loadVerdictView(
  client: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<VerdictView | null> {
  const [{ data: verdictRows }, planState] = await Promise.all([
    client
      .from("verdicts")
      .select("id, room_id, option_id, computed_at, method, rule_text")
      .eq("room_id", roomId)
      .limit(1),
    readRoomPlanState(client, roomId, userId),
  ]);
  const verdict = (verdictRows as VerdictRow[] | null)?.[0];
  if (!verdict) return null;

  const planName = planState.kind === "decided" ? planState.planName : "";
  const verdictPlaceName =
    planState.kind === "decided" ? planState.verdictPlaceName : "";

  return shapeVerdictView({
    verdict,
    planName,
    verdictPlaceName,
  });
}

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
  const userIdRef = useRef<string | null>(null);

  // Quiz state — quiz redesign. Seeded from `initialProgress` when the shell
  // handed a resume payload (web-01 §B); otherwise the quiz defaults.
  const [quiz, dispatchQuiz] = useReducer(
    quizFormReducer,
    initialProgress,
    createQuizFormState,
  );

  // §E — the leave-confirm sheet open state + in-flight flag.
  const [leaveState, dispatchLeave] = useReducer(
    leaveReducer,
    initialLeaveState,
  );

  // The resume payload is read once by the shell and is stable for the
  // life of this mount; a ref keeps it out of the boot effect's deps.
  const initialProgressRef = useRef(initialProgress);

  // Q5 candidate-fetch state.
  const [q5, dispatchQ5] = useReducer(q5Reducer, initialQ5Model);

  // Realtime + room state.
  const [roomRuntime, dispatchRoomRuntime] = useReducer(
    roomRuntimeReducer,
    initialRoomRuntime,
  );

  const channelRef = useRef<RoomChannel | null>(null);

  const loadAndShowVerdict = useVerdictLoader(roomId, userIdRef, setPhase);
  const startCandidateFetch = useQ5CandidateFetch(roomId, dispatchQ5);

  useSessionRoomBoot({
    roomId,
    channelRef,
    userIdRef,
    initialProgressRef,
    loadAndShowVerdict,
    setPhase,
    startCandidateFetch,
    dispatchRoomRuntime,
  });

  const secondsRemaining = useDeadlineCountdown(roomRuntime.deadlineAt);

  // ----------------------------------------------------------------
  // Quiz handlers.
  // ----------------------------------------------------------------

  // Snapshot the current quiz answers into a `quiz_progress` payload.
  // Used on every advance so a re-clicking invitee resumes with their
  // prior answers intact (web-01 §B, decision doc §Q5).
  const snapshotProgress = useCallback(
    (lastIndex: number): QuizProgressState => ({
      lastIndex,
      cuisines: quiz.cuisine.noPreference
        ? []
        : Array.from(quiz.cuisine.cuisines).sort(),
      noPreference: quiz.cuisine.noPreference,
      budget: quiz.budget,
      reputation: quiz.reputation,
      vibe: quiz.vibe,
    }),
    [quiz],
  );

  const handleAdvance = useCallback(
    (nextStep: 1 | 2 | 3 | 4 | 5) => {
      if (nextStep === 5) startCandidateFetch();
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
    [roomId, snapshotProgress, startCandidateFetch],
  );

  const handleSubmit = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    setPhase({ kind: "submitting" });
    try {
      const client = getSupabaseClient();

      const row = buildVoteRow({
        roomId,
        userId,
        cuisines: quiz.cuisine.cuisines,
        noPreference: quiz.cuisine.noPreference,
        budget: quiz.budget,
        reputation: quiz.reputation,
        vibe: quiz.vibe,
        // The factorial probe — one `{ droppedAxis, score }` entry per
        // card. Empty on the no-results path (no cards were shown).
        q5Ratings: buildQ5Ratings(q5.candidates, q5.ratings),
      });
      const { error } = await client.rpc("votes_submit_self", {
        p_room_id: row.room_id,
        p_q1: row.q1,
        p_q2: row.q2,
        p_q3: row.q3,
        p_q4: row.q4,
        p_q5: row.q5,
      });
      if (error) {
        throw error;
      }
      dispatchRoomRuntime({
        type: "vote-inserted",
        row: { room_id: roomId, user_id: userId },
      });
      setPhase({ kind: "waiting" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit your vote.";
      setPhase({ kind: "error", message });
    }
  }, [q5, quiz, roomId]);

  // ----------------------------------------------------------------
  // §E — Leave (web-01 §E, decision doc §Q7).
  // ----------------------------------------------------------------

  /** Confirm the leave: drop the `members` row via the shell's
   *  `onLeave` handler. On a rejected delete the sheet stays open with
   *  the error swallowed silently — the invitee can retry or dismiss;
   *  routing to the terminal as if the leave succeeded would be a lie. */
  const handleLeaveConfirm = useCallback(async () => {
    if (!onLeave || leaveState.leaving) return;
    dispatchLeave({ type: "leaving", value: true });
    try {
      await onLeave();
      // On success the shell unmounts this `SessionRoom` for the
      // "you left this plan" terminal — no local phase change needed.
    } catch {
      // Delete failed — keep the invitee on the quiz with the sheet
      // open. `leaving` resets so they can retry or dismiss.
    } finally {
      dispatchLeave({ type: "leaving", value: false });
    }
  }, [leaveState.leaving, onLeave]);

  // The Q1–Q5 chrome only gets a `Leave` affordance when the shell
  // wired `onLeave` (the web invitee shell). Off that host it is
  // omitted — the `/s/` session route has no leave verb.
  const quizLeaveHandler = onLeave
    ? () => dispatchLeave({ type: "open" })
    : undefined;

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  const memberViews = useWaitingMemberViews(roomRuntime, userIdRef);

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
    return (
      <SessionQuizScreens
        step={phase.step}
        quiz={quiz}
        q5={q5}
        leaveConfirmOpen={leaveState.confirmOpen}
        leaving={leaveState.leaving}
        onToggleCuisine={(id) =>
          dispatchQuiz({ type: "toggle-cuisine", id })
        }
        onToggleNoPreference={() =>
          dispatchQuiz({ type: "toggle-no-preference" })
        }
        onSelectBudget={(value) =>
          dispatchQuiz({ type: "budget", value })
        }
        onSelectReputation={(value) =>
          dispatchQuiz({ type: "reputation", value })
        }
        onSelectVibe={(value) => dispatchQuiz({ type: "vibe", value })}
        onRateQ5={(id, score) => dispatchQ5({ type: "rate", id, score })}
        onAdvance={handleAdvance}
        onSubmit={handleSubmit}
        onLeave={quizLeaveHandler}
        onConfirmLeave={handleLeaveConfirm}
        onDismissLeave={() => dispatchLeave({ type: "dismiss" })}
      />
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
                void emitDownloadCtaEvent({ roomId });
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

function useVerdictLoader(
  roomId: string,
  userIdRef: MutableRefObject<string | null>,
  setPhase: Dispatch<SetStateAction<Phase>>,
) {
  return useCallback(
    async (client: SupabaseClient) => {
      const userId = userIdRef.current;
      if (!userId) return;
      try {
        const view = await loadVerdictView(client, roomId, userId);
        if (view) setPhase({ kind: "verdict", view });
      } catch {
        // Realtime will retry — don't surface a transient error here.
      }
    },
    [roomId, setPhase, userIdRef],
  );
}

function useQ5CandidateFetch(
  roomId: string,
  dispatchQ5: Dispatch<Q5Action>,
) {
  const fetchPromiseRef = useRef<Promise<Q5CardSetFetchResult> | null>(null);

  return useCallback(() => {
    if (fetchPromiseRef.current) return; // already running / resolved
    dispatchQ5({ type: "loading" });
    const promise = fetchQ5CardSet(roomId);
    fetchPromiseRef.current = promise;
    void promise
      .then((result) => {
        dispatchQ5({ type: "loaded", result });
      })
      .catch(() => {
        dispatchQ5({
          type: "loaded",
          result: { candidates: [], source: "no-results" },
        });
      });
  }, [dispatchQ5, roomId]);
}

function useDeadlineCountdown(deadlineAt: string | null): number | null {
  const now = useSecondClock();

  return useMemo(() => {
    if (!deadlineAt) return null;
    const target = new Date(deadlineAt).getTime();
    return Math.max(0, Math.floor((target - now) / 1000));
  }, [deadlineAt, now]);
}

function useSecondClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);

    function tick() {
      setNow(Date.now());
    }
  }, []);

  return now;
}

function useWaitingMemberViews(
  roomRuntime: RoomRuntimeState,
  userIdRef: MutableRefObject<string | null>,
): WaitingMemberView[] {
  return useMemo(() => {
    const userId = userIdRef.current;
    return roomRuntime.members.map((m, i) => ({
      id: m.user_id,
      initial: `${i + 1}`,
      answered: roomRuntime.answeredIds.has(m.user_id),
      isSelf: m.user_id === userId,
    }));
  }, [roomRuntime, userIdRef]);
}

function useSessionRoomBoot({
  roomId,
  channelRef,
  userIdRef,
  initialProgressRef,
  loadAndShowVerdict,
  setPhase,
  startCandidateFetch,
  dispatchRoomRuntime,
}: {
  roomId: string;
  channelRef: MutableRefObject<RoomChannel | null>;
  userIdRef: MutableRefObject<string | null>;
  initialProgressRef: MutableRefObject<QuizProgressState | undefined>;
  loadAndShowVerdict: (client: SupabaseClient) => Promise<void>;
  setPhase: Dispatch<SetStateAction<Phase>>;
  startCandidateFetch: () => void;
  dispatchRoomRuntime: Dispatch<RoomRuntimeAction>;
}) {
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        setPhase({ kind: "joining" });
        const uid = await ensureAnonSession();
        if (cancelled) return;
        userIdRef.current = uid;

        const client = getSupabaseClient();

        // Member join is idempotent; the RPC pins user_id and role server-side.
        const { error: memberErr } = await client.rpc("members_join_self", {
          p_room_id: roomId,
        });
        if (memberErr) {
          throw memberErr;
        }

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
        const memberRowsTyped = (memberRows as MembersRow[] | null) ?? [];
        const voteRowsTyped = (voteRows as VotesPresenceRow[] | null) ?? [];
        const room = (roomRows as RoomsRow[] | null)?.[0];
        dispatchRoomRuntime({
          type: "seed",
          members: memberRowsTyped,
          votes: voteRowsTyped,
          deadlineAt: room?.deadline_at ?? null,
        });

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
              dispatchRoomRuntime({ type: "member-inserted", row });
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
              dispatchRoomRuntime({ type: "vote-inserted", row });
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
              dispatchRoomRuntime({
                type: "deadline",
                deadlineAt: row.deadline_at,
              });
              if (isDecidedStatus(row.status)) {
                void loadAndShowVerdict(client);
              }
            },
          )
          .on("broadcast", { event: "verdict_ready" }, () => {
            void loadAndShowVerdict(client);
          });

        channel.subscribe();
        channelRef.current = channel;

        if (isDecidedStatus(room?.status)) {
          const view = await loadVerdictView(client, roomId, uid);
          if (cancelled) return;
          setPhase(view ? { kind: "verdict", view } : { kind: "waiting" });
        } else if (voteRowsTyped.some((v) => v.user_id === uid)) {
          setPhase({ kind: "waiting" });
        } else {
          const step = clampStep(initialProgressRef.current?.lastIndex);
          if (step === 5) startCandidateFetch();
          setPhase({ kind: "quiz", step });
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
  }, [
    channelRef,
    dispatchRoomRuntime,
    initialProgressRef,
    loadAndShowVerdict,
    roomId,
    setPhase,
    startCandidateFetch,
    userIdRef,
  ]);
}

function SessionQuizScreens({
  step,
  quiz,
  q5,
  leaveConfirmOpen,
  leaving,
  onToggleCuisine,
  onToggleNoPreference,
  onSelectBudget,
  onSelectReputation,
  onSelectVibe,
  onRateQ5,
  onAdvance,
  onSubmit,
  onLeave,
  onConfirmLeave,
  onDismissLeave,
}: {
  step: QuizStep;
  quiz: QuizFormState;
  q5: Q5Model;
  leaveConfirmOpen: boolean;
  leaving: boolean;
  onToggleCuisine: (id: string) => void;
  onToggleNoPreference: () => void;
  onSelectBudget: (value: 1 | 2 | 3 | 4) => void;
  onSelectReputation: (value: string) => void;
  onSelectVibe: (value: number) => void;
  onRateQ5: (id: string, score: number) => void;
  onAdvance: (nextStep: QuizStep) => void;
  onSubmit: () => void;
  onLeave?: () => void;
  onConfirmLeave: () => void;
  onDismissLeave: () => void;
}) {
  let screen: JSX.Element | null = null;
  switch (step) {
    case 1:
      screen = (
        <QuizQ1Cuisine
          selection={quiz.cuisine}
          onToggleCuisine={onToggleCuisine}
          onToggleNoPreference={onToggleNoPreference}
          onAdvance={() => onAdvance(2)}
          onLeave={onLeave}
        />
      );
      break;
    case 2:
      screen = (
        <QuizQ2Budget
          tier={quiz.budget}
          onSelect={onSelectBudget}
          onAdvance={() => onAdvance(3)}
          onLeave={onLeave}
        />
      );
      break;
    case 3:
      screen = (
        <QuizQ3Reputation
          value={quiz.reputation}
          onSelect={onSelectReputation}
          onAdvance={() => onAdvance(4)}
          onLeave={onLeave}
        />
      );
      break;
    case 4:
      screen = (
        <QuizQ4Vibe
          value={quiz.vibe}
          onSelect={onSelectVibe}
          onAdvance={() => onAdvance(5)}
          onLeave={onLeave}
        />
      );
      break;
    case 5:
      screen = (
        <QuizQ5
          state={q5.state}
          candidates={q5.candidates}
          ratings={q5.ratings}
          onRate={onRateQ5}
          onSubmit={onSubmit}
          onLeave={onLeave}
        />
      );
      break;
  }

  return (
    <>
      {screen}
      {leaveConfirmOpen ? (
        <LeaveConfirmSheet
          leaving={leaving}
          onConfirm={onConfirmLeave}
          onDismiss={onDismissLeave}
        />
      ) : null}
    </>
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
    <main style={fullScreenMainStyle}>
      <div style={fullScreenContentStyle}>
        <p style={fullScreenEyebrowStyle}>
          {eyebrow}
        </p>
        <p style={fullScreenBodyStyle}>
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
}: {
  roomId: string;
}): Promise<void> {
  try {
    const client = getSupabaseClient();
    await client.rpc("events_insert_self", {
      p_event_type: "waiting_download_cta_tapped",
      p_room_id: roomId,
      p_properties: {},
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

export { REPUTATION_NO_PREFERENCE };
