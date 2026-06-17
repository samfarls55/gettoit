import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.43.4";
import type {
  GoogleAttributionPayload,
  GoogleQ5Response,
} from "../_shared/places-proxy-core.ts";
import type {
  Q5CardSetPoolCandidate,
  Q5MemberProbeProfile,
} from "../_shared/q5-card-set.ts";
import {
  handleRequest,
  type Q5CardSetDataAdapter,
  type Q5PoolFetchInput,
  type Q5RoomMemberContext,
  type QuizAnswers,
} from "./handler.ts";

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type RoomRow = {
  id?: unknown;
  plan_id?: unknown;
  location_lat?: unknown;
  location_lng?: unknown;
  radius_meters?: unknown;
  session_params?: Record<string, unknown> | null;
};

type MemberRow = {
  room_id?: unknown;
  user_id?: unknown;
  quiz_progress?: Record<string, unknown> | null;
  rooms?: RoomRow | RoomRow[] | null;
};

const defaultSearchRadiusMeters = 3219;
const defaultMealTime = "dinner";
const defaultServiceShape = "dineIn";
const openAtHourByMealTime: Record<string, number> = {
  breakfast: 9,
  lunch: 12,
  dinner: 19,
  lateNight: 22,
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const numberValue = finiteNumber(value);
  return numberValue !== null && numberValue > 0 ? numberValue : null;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value.filter((entry): entry is string =>
    typeof entry === "string"
  );
  return strings.length > 0 ? strings : undefined;
}

function answersFromProgress(
  progress: Record<string, unknown> | null | undefined,
): QuizAnswers {
  const answers = progress?.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return {};
  }
  const stored = answers as Record<string, unknown>;
  const q1CuisineCravings = stringArray(stored.q1CuisineCravings);
  return {
    ...(q1CuisineCravings ? { q1CuisineCravings } : {}),
    ...(typeof stored.q2SpendCap === "string"
      ? { q2SpendCap: stored.q2SpendCap }
      : {}),
    ...(typeof stored.q3Reputation === "string"
      ? { q3Reputation: stored.q3Reputation }
      : {}),
    ...(typeof stored.q4VibeEnergy === "string"
      ? { q4VibeEnergy: stored.q4VibeEnergy }
      : {}),
  };
}

function roomFromMemberRow(row: MemberRow): RoomRow | null {
  if (Array.isArray(row.rooms)) {
    return row.rooms[0] ?? null;
  }
  return row.rooms ?? null;
}

function openAtToken(mealTime: string): string {
  const today = new Date();
  const day = today.getDay() === 0 ? 7 : today.getDay();
  const hour = String(
    openAtHourByMealTime[mealTime] ?? openAtHourByMealTime[defaultMealTime],
  ).padStart(2, "0");
  return `${day}T${hour}00`;
}

function placesProxyRequestFromRoom(
  room: RoomRow,
  answers: QuizAnswers,
): Record<string, unknown> | undefined {
  const lat = finiteNumber(room.location_lat);
  const lng = finiteNumber(room.location_lng);
  if (lat === null || lng === null) {
    return undefined;
  }

  const sessionParams = room.session_params ?? {};
  const mealTime = typeof sessionParams.meal_time === "string"
    ? sessionParams.meal_time
    : defaultMealTime;
  const serviceShape = typeof sessionParams.service_shape === "string"
    ? sessionParams.service_shape
    : defaultServiceShape;
  const cuisine = answers.q1CuisineCravings?.find((entry) =>
    entry !== "noPreference"
  );
  const priceTier = answers.q2SpendCap?.length;
  const filters: Record<string, unknown> = {
    open_at: openAtToken(mealTime),
    service_shape: serviceShape === "takeout" || serviceShape === "delivery"
      ? "takeout"
      : "dineIn",
  };

  if (cuisine) {
    filters.cuisine = cuisine;
  }
  if (priceTier && priceTier >= 1 && priceTier <= 4) {
    filters.price_tier = priceTier;
  }

  return {
    surface: "q5",
    lat,
    lng,
    radius_meters: positiveNumber(room.radius_meters) ??
      defaultSearchRadiusMeters,
    filters,
  };
}

function googleAttribution(
  response: GoogleQ5Response,
): GoogleAttributionPayload {
  return response.attribution ?? {
    provider: "google",
    render: "text",
    text: "Powered by Google",
  };
}

function q5PoolFromGoogleResponse(
  response: GoogleQ5Response,
  profile: Q5MemberProbeProfile,
): Q5CardSetPoolCandidate[] {
  const seenPlaceIds = new Set<string>();
  const selectedCuisine = profile.cuisines[0] ?? null;
  const secondSelectedCuisine = profile.cuisines[1] ?? selectedCuisine;
  const targetCrowdApproval = profile.crowdApproval === "no_preference"
    ? "popular"
    : profile.crowdApproval;
  const alternateCrowdApproval = targetCrowdApproval === "popular"
    ? "hidden_gem"
    : "popular";
  const alternateVibe = profile.vibe >= 4 ? profile.vibe - 1 : profile.vibe + 1;
  const attribution = googleAttribution(response);
  const pool: Q5CardSetPoolCandidate[] = [];

  for (const place of response.places ?? []) {
    if (
      typeof place.place_id !== "string" ||
      typeof place.display_name !== "string" ||
      seenPlaceIds.has(place.place_id)
    ) {
      continue;
    }
    seenPlaceIds.add(place.place_id);

    const profileIndex = pool.length % 3;
    let candidateProfile: Q5CardSetPoolCandidate["profile"];
    if (profileIndex === 0) {
      candidateProfile = {
        cuisine: null,
        crowdApproval: targetCrowdApproval,
        vibe: profile.vibe,
      };
    } else if (profileIndex === 1) {
      candidateProfile = {
        cuisine: selectedCuisine,
        crowdApproval: alternateCrowdApproval,
        vibe: profile.vibe,
      };
    } else {
      candidateProfile = {
        cuisine: secondSelectedCuisine,
        crowdApproval: targetCrowdApproval,
        vibe: alternateVibe,
      };
    }

    pool.push({
      googlePlaceId: place.place_id,
      displayName: place.display_name,
      attribution,
      profile: candidateProfile,
    });
  }

  return pool;
}

function buildDataAdapter(
  env: Required<Env>,
  client: SupabaseClient,
): Q5CardSetDataAdapter {
  return {
    async fetchRoomMember(roomId, userId): Promise<Q5RoomMemberContext | null> {
      const { data, error } = await client
        .from("members")
        .select(
          "room_id, user_id, quiz_progress, rooms!inner(id, plan_id, location_lat, location_lng, radius_meters, session_params)",
        )
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("q5-card-set member read failed:", error.message);
        return null;
      }
      if (!data) {
        return null;
      }

      const row = data as MemberRow;
      const room = roomFromMemberRow(row);
      const answers = answersFromProgress(row.quiz_progress);
      return {
        roomId,
        memberId: userId,
        parametersLocked: Boolean(room?.plan_id),
        answers,
        ...(room
          ? { placesProxyRequest: placesProxyRequestFromRoom(room, answers) }
          : {}),
      };
    },

    async fetchQ5Pool(input: Q5PoolFetchInput) {
      if (!input.placesProxyRequest) {
        return [];
      }

      const response = await fetch(
        `${env.SUPABASE_URL}/functions/v1/places-proxy`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input.placesProxyRequest),
        },
      );
      if (!response.ok) {
        throw new Error(`Q5 places proxy failed: ${response.status}`);
      }

      const body = await response.json() as GoogleQ5Response & {
        error?: string;
      };
      if (body.error) {
        throw new Error(`Q5 places proxy failed: ${body.error}`);
      }

      return q5PoolFromGoogleResponse(body, input.profile);
    },
  };
}

function env(): Env {
  return {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

Deno.serve((req) => {
  const runtimeEnv = env();
  if (!runtimeEnv.SUPABASE_URL || !runtimeEnv.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("q5-card-set Supabase credentials are not set");
    return jsonResponse({ error: "q5_card_set_misconfigured" }, {
      status: 500,
    });
  }

  const requiredEnv = runtimeEnv as Required<Env>;
  const client = createClient(
    requiredEnv.SUPABASE_URL,
    requiredEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  return handleRequest(req, {
    getUserId: async (bearerToken) => {
      const { data, error } = await client.auth.getUser(bearerToken);
      if (error) {
        return null;
      }
      return data.user?.id ?? null;
    },
    data: buildDataAdapter(requiredEnv, client),
  });
});
