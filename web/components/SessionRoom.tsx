// GetToIt web — Session orchestrator.
//
// Client component mounted at `/s/<sessionId>`. Owns the entire web
// session lifecycle:
//
//   1. Anonymous sign-in (idempotent).
//   2. Insert the caller as a `members` row (idempotent — the unique
//      (room_id, user_id) primary key swallows retries).
//   3. Drive the v1.1 5-question quiz; on Q4 -> Q5 fire the per-member
//      Foursquare candidate fetch; submit the `votes` row.
//   4. Subscribe to Realtime so the Waiting + Verdict surfaces stay in
//      lockstep with iOS.
//   5. Once `rooms.status === 'verdict_ready'` (or the broadcast
//      arrives), fetch the verdict + cuts + receipts and render the
//      read-only S05 surface.
//
// tb-WF-10 — the quiz is brought to v1.1 parity: scenario questions
// (Q1 cuisine craving, Q3 reputation), the generic `q1`..`q5` jsonb
// votes (via the shared `votes-wire.ts` contract), the real per-member
// candidate fetch (replacing the retired `DUMMY_CANDIDATES`), and the
// Q5 strict-factorial probe with the `no-results` honest-degradation
// path. A resume into Q5 (the user re-clicked the link past Q4)
// re-fires the per-member fetch so the rater has cards.

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
  fetchMemberCandidates,
  seedRatings,
  type CandidateFetchResult,
  type MealTime,
  type PlacesProxyCaller,
  type PlacesProxyRequest,
  type PlacesProxyResponse,
  type QuizCandidate,
  type SessionFetchContext,
} from "../lib/candidate-fetch";

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
/** The candidate-pool radius default — matches `rooms.radius_meters`'s
 *  column default (≈ 2.0 mi) so a room with a NULL radius still fetches. */
const DEFAULT_RADIUS_METERS = 3219;

const VALID_MEAL_TIMES: ReadonlySet<string> = new Set([
  "breakfast",
  "lunch",
  "dinner",
  "late_night",
]);

/** Read the session meal time off `rooms.session_params`, falling back
 *  to `dinner` (the iOS `SessionParameters.default`) when the column is
 *  NULL or carries an unknown value. */
function readMealTime(params: RoomsRow["session_params"]): MealTime {
  const raw = params?.meal_time;
  return typeof raw === "string" && VALID_MEAL_TIMES.has(raw)
    ? (raw as MealTime)
    : "dinner";
}

export function SessionRoom({ roomId }: { roomId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "booting" });
  const [userId, setUserId] = useState<string | null>(null);

  // Quiz state — v1.1.
  const [cuisine, setCuisine] = useState<CuisineSelection>(() => ({
    cuisines: new Set(),
    noPreference: false,
  }));
  const [budget, setBudget] = useState<number>(QUIZ_DEFAULTS.budget);
  const [reputation, setReputation] = useState<string>(
    QUIZ_DEFAULTS.reputation,
  );
  const [vibe, setVibe] = useState<number>(QUIZ_DEFAULTS.vibe);

  // Q5 candidate-fetch state.
  const [q5State, setQ5State] = useState<Q5State>("loading");
  const [candidates, setCandidates] = useState<QuizCandidate[]>([]);
  const [q5Ratings, setQ5Ratings] = useState<Record<string, number>>({});

  // The room context for the per-member fetch — set once on boot.
  const fetchContextRef = useRef<SessionFetchContext | null>(null);
  // The in-flight per-member fetch, so a resume / re-render folds into
  // the running fetch instead of firing the N+1 calls twice.
  const fetchPromiseRef = useRef<Promise<CandidateFetchResult> | null>(null);

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
          // The room context drives the per-member Foursquare fetch on
          // the Q4 -> Q5 transition.
          fetchContextRef.current = {
            lat: room.location_lat,
            lng: room.location_lng,
            radiusMeters: room.radius_meters ?? DEFAULT_RADIUS_METERS,
            timeZone: room.location_tz ?? "UTC",
            mealTime: readMealTime(room.session_params),
          };
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

        if (verdict.method === "no_survivor") {
          if (cancelled) return;
          const view = shapeVerdictView({
            verdict,
            winningOption: null,
            cuts: [],
            cutOptions: {},
            votes: [],
            memberCount: members.length,
          });
          if (view) setPhase({ kind: "verdict", view });
          return;
        }

        const [
          { data: optionRows },
          { data: cutRows },
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
        ]);

        const winningOption = (optionRows as OptionRow[] | null)?.[0] ?? null;
        const cuts = (cutRows as CutRow[] | null) ?? [];

        const cutOptionIds = cuts.map((c) => c.option_id);
        const cutOptionsMap: Record<string, OptionRow> = {};
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
          // The receipt list is shaped from `members`; the verdict-engine
          // mapping layer owns vote interpretation. tb-WF-10 leaves the
          // read-side receipts as-is — see the issue's Adjacencies.
          votes: [] as VoteSummaryRow[],
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
  // Q5 per-member candidate fetch.
  // ────────────────────────────────────────────────────────────────

  /** Fire the per-member Foursquare fetch and fold its result into the
   *  Q5 state. Idempotent within a session — a fetch already in flight
   *  (or resolved) is reused rather than re-firing the N+1 calls.
   *
   *  This runs both on the Q4 -> Q5 advance AND on a resume that lands
   *  the user directly on Q5 (the issue's resume-into-Q5 requirement):
   *  Q5 cannot render the rater without cards, so the fetch must fire
   *  whenever Q5 is entered, regardless of how. */
  const startCandidateFetch = useCallback(() => {
    if (fetchPromiseRef.current) return; // already running / resolved
    const context = fetchContextRef.current;
    if (!context) {
      // No room context (a stale routing) — honest degradation.
      setQ5State("no-results");
      setCandidates([]);
      setQ5Ratings({});
      return;
    }
    setQ5State("loading");
    const promise = fetchMemberCandidates({
      member: {
        cuisines: cuisine.noPreference
          ? []
          : Array.from(cuisine.cuisines).sort(),
        reputation,
        vibe,
      },
      budgetTier: budget,
      context,
      caller: makePlacesProxyCaller(),
    });
    fetchPromiseRef.current = promise;
    void promise.then((result) => {
      setCandidates(result.candidates);
      setQ5Ratings(seedRatings(result.candidates));
      setQ5State(result.source === "fetched" ? "default" : "no-results");
    });
  }, [budget, cuisine, reputation, vibe]);

  // When the quiz lands on Q5 — by advancing OR by resume — fire the
  // per-member fetch if it has not already run.
  useEffect(() => {
    if (phase.kind === "quiz" && phase.step === 5) {
      startCandidateFetch();
    }
  }, [phase, startCandidateFetch]);

  // ────────────────────────────────────────────────────────────────
  // Quiz handlers.
  // ────────────────────────────────────────────────────────────────

  const handleAdvance = useCallback((nextStep: 1 | 2 | 3 | 4 | 5) => {
    setPhase({ kind: "quiz", step: nextStep });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!userId) return;
    setPhase({ kind: "submitting" });
    try {
      const client = getSupabaseClient();

      // Gate the verdict-firing `votes` write on the candidate fetch —
      // the raw fetched union must land in `member_fetches` before the
      // verdict can union it into `options` (mirrors iOS `submit()`).
      const fetchResult = await (fetchPromiseRef.current ??
        Promise.resolve<CandidateFetchResult>({
          candidates: [],
          source: "no-results",
          rawFetch: [],
        }));

      // Persist the member's raw fetched union into `member_fetches` so
      // `compute-verdict` can union it into the room's `options` pool.
      // Best-effort: a failed persist must not strand the member — the
      // verdict still fires, just without this member's pool
      // contribution. The row is written even when the fetch was empty
      // (a real "this member fetched nothing" record).
      try {
        await client.from("member_fetches").upsert(
          {
            room_id: roomId,
            user_id: userId,
            payload: fetchResult.rawFetch,
          },
          { onConflict: "room_id,user_id" },
        );
      } catch {
        // Swallow — the member still reaches the verdict.
      }

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

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

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
    switch (phase.step) {
      case 1:
        return (
          <QuizQ1Cuisine
            selection={cuisine}
            onToggleCuisine={(id) =>
              setCuisine((prev) => toggleCuisine(prev, id))
            }
            onToggleNoPreference={() =>
              setCuisine((prev) => toggleCuisineNoPreference(prev))
            }
            onAdvance={() => handleAdvance(2)}
          />
        );
      case 2:
        return (
          <QuizQ2Budget
            tier={budget}
            onSelect={(tier) => setBudget(tier)}
            onAdvance={() => handleAdvance(3)}
          />
        );
      case 3:
        return (
          <QuizQ3Reputation
            value={reputation}
            onSelect={(id) => setReputation(id)}
            onAdvance={() => handleAdvance(4)}
          />
        );
      case 4:
        return (
          <QuizQ4Vibe
            value={vibe}
            onSelect={(idx) => setVibe(idx)}
            onAdvance={() => handleAdvance(5)}
          />
        );
      case 5:
        return (
          <QuizQ5
            state={q5State}
            candidates={candidates}
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
        isAnonymous={true}
        onDownloadApp={() => {
          void emitDownloadCtaEvent({ roomId, userId });
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

/** Build a `PlacesProxyCaller` over the deployed `places-proxy` Edge
 *  Function. The web client has no MapKit fallback (ADR 0002), so a
 *  non-2xx / thrown call resolves to an empty, thin response — the
 *  fetch then degrades to the Q5 no-results path. */
function makePlacesProxyCaller(): PlacesProxyCaller {
  return async (req: PlacesProxyRequest): Promise<PlacesProxyResponse> => {
    const client = getSupabaseClient();
    const { data, error } = await client.functions.invoke<PlacesProxyResponse>(
      "places-proxy",
      { body: req },
    );
    if (error || !data) {
      return { places: [], is_thin: true, error: "places_proxy_unreachable" };
    }
    return {
      places: Array.isArray(data.places) ? data.places : [],
      is_thin: data.is_thin ?? true,
      error: data.error,
    };
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

// sg-03 / TB-02 (v1.1) — emit the `waiting_download_cta_tapped` event
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

export { REPUTATION_NO_PREFERENCE };
