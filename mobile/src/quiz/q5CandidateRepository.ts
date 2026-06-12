import type { QuizAnswers } from "./quizProgressRepository";
import type { Q5PoolVenue } from "./q5Factorial";
import type { PlanMealTime, PlanServiceShape } from "../plans/planRepository";

export type LoadQ5CandidatesInput = {
  roomId: string;
  answers: QuizAnswers;
};

export type Q5CandidateRepository = {
  loadCandidates: (input: LoadQ5CandidatesInput) => Promise<Q5PoolVenue[]>;
};

export type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type Q5SupabaseQuery<TRow> = PromiseLike<
  SupabaseQueryResult<TRow[]>
> & {
  select: (columns: string) => Q5SupabaseQuery<TRow>;
  eq: (column: string, value: unknown) => Q5SupabaseQuery<TRow>;
};

export type Q5SupabaseClient = {
  from: <TRow>(table: string) => Q5SupabaseQuery<TRow>;
  functions: {
    invoke: <TData>(
      functionName: string,
      options: { body: Record<string, unknown> },
    ) => Promise<{ data: TData | null; error: Error | null }>;
  };
};

type SupabasePlanRow = {
  id: string;
  location?: {
    lat?: unknown;
    lng?: unknown;
  } | null;
  distance_meters?: unknown;
  session_params?: Record<string, unknown> | null;
};

type SupabaseRoomRow = {
  id: string;
  plan_id?: string | null;
  location_lat?: unknown;
  location_lng?: unknown;
  radius_meters?: unknown;
  session_params?: Record<string, unknown> | null;
};

type GoogleQ5Place = {
  place_id?: unknown;
  display_name?: unknown;
};

type GoogleQ5Response = {
  places?: GoogleQ5Place[];
  attribution?: {
    text?: unknown;
  };
  error?: string;
};

type Q5FetchContext = {
  lat: number;
  lng: number;
  radiusMeters: number;
  mealTime: PlanMealTime;
  serviceShape: PlanServiceShape;
};

type Q5PlaceIdentity = {
  id: string;
  name: string;
};

type SupabaseQ5CandidateRepositoryDependencies = {
  supabase: Q5SupabaseClient;
};

const defaultSearchRadiusMeters = 3219;
const defaultMealTime: PlanMealTime = "dinner";
const defaultServiceShape: PlanServiceShape = "dineIn";
const noPreferenceReputation = "noPreference";

const mealTimes: readonly PlanMealTime[] = [
  "breakfast",
  "lunch",
  "dinner",
  "lateNight",
];

const serviceShapes: readonly PlanServiceShape[] = [
  "dineIn",
  "outdoor",
  "takeout",
  "delivery",
];

const vibeValueByAnswer: Record<string, number> = {
  quiet: 0,
  chill: 1,
  cozy: 1,
  social: 2,
  lively: 3,
  rowdy: 4,
};

const openAtHourByMealTime: Record<PlanMealTime, number> = {
  breakfast: 9,
  lunch: 12,
  dinner: 19,
  lateNight: 22,
};

function assertSupabaseRows<TRow>(
  result: SupabaseQueryResult<TRow[]>,
  queryName: string,
): TRow[] {
  if (result.error) {
    throw new Error(`${queryName} failed: ${result.error.message}`);
  }

  return result.data ?? [];
}

function isOneOf<TValue extends string>(
  value: unknown,
  values: readonly TValue[],
): value is TValue {
  return typeof value === "string" && values.includes(value as TValue);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const numberValue = finiteNumber(value);
  return numberValue && numberValue > 0 ? numberValue : null;
}

function mealTimeFromSessionParams(
  sessionParams: Record<string, unknown>,
): PlanMealTime {
  return isOneOf(sessionParams.meal_time, mealTimes)
    ? sessionParams.meal_time
    : defaultMealTime;
}

function serviceShapeFromSessionParams(
  sessionParams: Record<string, unknown>,
): PlanServiceShape {
  return isOneOf(sessionParams.service_shape, serviceShapes)
    ? sessionParams.service_shape
    : defaultServiceShape;
}

function contextFromPlanRow(plan: SupabasePlanRow): Q5FetchContext | null {
  const lat = finiteNumber(plan.location?.lat);
  const lng = finiteNumber(plan.location?.lng);

  if (lat === null || lng === null) {
    return null;
  }

  const sessionParams = plan.session_params ?? {};
  return {
    lat,
    lng,
    radiusMeters: positiveNumber(plan.distance_meters) ?? defaultSearchRadiusMeters,
    mealTime: mealTimeFromSessionParams(sessionParams),
    serviceShape: serviceShapeFromSessionParams(sessionParams),
  };
}

function contextFromRoomRow(room: SupabaseRoomRow): Q5FetchContext | null {
  const lat = finiteNumber(room.location_lat);
  const lng = finiteNumber(room.location_lng);

  if (lat === null || lng === null) {
    return null;
  }

  const sessionParams = room.session_params ?? {};
  return {
    lat,
    lng,
    radiusMeters: positiveNumber(room.radius_meters) ?? defaultSearchRadiusMeters,
    mealTime: mealTimeFromSessionParams(sessionParams),
    serviceShape: serviceShapeFromSessionParams(sessionParams),
  };
}

async function loadPlanById(
  supabase: Q5SupabaseClient,
  planId: string,
): Promise<SupabasePlanRow | null> {
  const result = await supabase
    .from<SupabasePlanRow>("plans")
    .select("id, location, distance_meters, session_params")
    .eq("id", planId);
  const plans = assertSupabaseRows(result, "Q5 Plan context read");
  return plans[0] ?? null;
}

async function loadRoomById(
  supabase: Q5SupabaseClient,
  roomId: string,
): Promise<SupabaseRoomRow | null> {
  const result = await supabase
    .from<SupabaseRoomRow>("rooms")
    .select(
      "id, plan_id, location_lat, location_lng, radius_meters, session_params",
    )
    .eq("id", roomId);
  const rooms = assertSupabaseRows(result, "Q5 Room context read");
  return rooms[0] ?? null;
}

async function loadQ5FetchContext(
  supabase: Q5SupabaseClient,
  roomId: string,
): Promise<Q5FetchContext | null> {
  const plan = await loadPlanById(supabase, roomId);
  if (plan) {
    return contextFromPlanRow(plan);
  }

  const room = await loadRoomById(supabase, roomId);
  if (!room) {
    return null;
  }

  if (room.plan_id) {
    const roomPlan = await loadPlanById(supabase, room.plan_id);
    const planContext = roomPlan ? contextFromPlanRow(roomPlan) : null;
    if (planContext) {
      return planContext;
    }
  }

  return contextFromRoomRow(room);
}

function selectedCuisines(answers: QuizAnswers): string[] {
  return (answers.q1CuisineCravings ?? []).filter(
    (cuisine) => cuisine !== "noPreference",
  );
}

function priceTierFromAnswers(answers: QuizAnswers): number | undefined {
  const tier = answers.q2SpendCap?.length;
  return tier && tier >= 1 && tier <= 4 ? tier : undefined;
}

function reputationFromAnswers(answers: QuizAnswers): string {
  const reputation = answers.q3Reputation;
  return reputation && reputation.length > 0
    ? reputation
    : noPreferenceReputation;
}

function alternateReputation(reputation: string): string {
  return reputation === "popular" ? "hiddenGem" : "popular";
}

function vibeFromAnswers(answers: QuizAnswers): number {
  return vibeValueByAnswer[answers.q4VibeEnergy ?? "social"] ?? 2;
}

function alternateVibe(vibe: number): number {
  return vibe >= 4 ? vibe - 1 : vibe + 1;
}

function googleServiceShape(
  serviceShape: PlanServiceShape,
): "dineIn" | "takeout" {
  return serviceShape === "takeout" || serviceShape === "delivery"
    ? "takeout"
    : "dineIn";
}

function openAtToken(mealTime: PlanMealTime): string {
  const today = new Date();
  const day = today.getDay() === 0 ? 7 : today.getDay();
  const hour = String(openAtHourByMealTime[mealTime]).padStart(2, "0");
  return `${day}T${hour}00`;
}

function googleQ5RequestBody(
  context: Q5FetchContext,
  answers: QuizAnswers,
): Record<string, unknown> {
  const filters: Record<string, unknown> = {
    open_at: openAtToken(context.mealTime),
    service_shape: googleServiceShape(context.serviceShape),
  };
  const cuisine = selectedCuisines(answers)[0];
  const priceTier = priceTierFromAnswers(answers);

  if (cuisine) {
    filters.cuisine = cuisine;
  }

  if (priceTier) {
    filters.price_tier = priceTier;
  }

  return {
    surface: "q5",
    lat: context.lat,
    lng: context.lng,
    radius_meters: context.radiusMeters,
    filters,
  };
}

function dedupeGooglePlaces(places: GoogleQ5Place[] = []): Q5PlaceIdentity[] {
  const seenPlaceIds = new Set<string>();
  const identities: Q5PlaceIdentity[] = [];

  for (const place of places) {
    if (
      typeof place.place_id !== "string" ||
      typeof place.display_name !== "string" ||
      seenPlaceIds.has(place.place_id)
    ) {
      continue;
    }

    seenPlaceIds.add(place.place_id);
    identities.push({
      id: place.place_id,
      name: place.display_name,
    });
  }

  return identities;
}

function q5PoolFromGoogleResponse(
  response: GoogleQ5Response,
  answers: QuizAnswers,
): Q5PoolVenue[] {
  const identities = dedupeGooglePlaces(response.places);
  if (identities.length < 3) {
    return [];
  }

  const selectedCuisine = selectedCuisines(answers)[0] ?? null;
  const targetReputation = reputationFromAnswers(answers);
  const targetVibe = vibeFromAnswers(answers);
  const attributionText =
    typeof response.attribution?.text === "string"
      ? response.attribution.text
      : undefined;

  return identities.map((place, index) => {
    const profileIndex = index % 3;
    const profile =
      profileIndex === 0
        ? {
            cuisine: null,
            reputation: targetReputation,
            vibe: targetVibe,
          }
        : profileIndex === 1
          ? {
              cuisine: selectedCuisine,
              reputation: alternateReputation(targetReputation),
              vibe: targetVibe,
            }
          : {
              cuisine: selectedCuisine,
              reputation: targetReputation,
              vibe: alternateVibe(targetVibe),
            };

    return {
      id: place.id,
      name: place.name,
      categories: [],
      ...(attributionText ? { attributionText } : {}),
      profile,
    };
  });
}

export function createSupabaseQ5CandidateRepository({
  supabase,
}: SupabaseQ5CandidateRepositoryDependencies): Q5CandidateRepository {
  return {
    loadCandidates: async ({ roomId, answers }) => {
      const context = await loadQ5FetchContext(supabase, roomId);

      if (!context) {
        return [];
      }

      const result = await supabase.functions.invoke<GoogleQ5Response>(
        "places-proxy",
        { body: googleQ5RequestBody(context, answers) },
      );

      if (result.error) {
        throw new Error(`Q5 places read failed: ${result.error.message}`);
      }

      if (!result.data || result.data.error) {
        return [];
      }

      return q5PoolFromGoogleResponse(result.data, answers);
    },
  };
}
