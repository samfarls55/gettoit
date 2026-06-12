import type { SearchArea } from "../searchArea/searchArea";

export type PlanListRouteTarget = "pending" | "joined" | "decided" | "history";

export type PlanParticipantScope = "solo" | "duo" | "group";

export type PlanMealTime = "breakfast" | "lunch" | "dinner" | "lateNight";

export type PlanServiceShape =
  | "dineIn"
  | "outdoor"
  | "takeout"
  | "delivery";

export type PlanSetup = {
  id?: string;
  name: string;
  participantScope: PlanParticipantScope;
  searchArea: SearchArea | null;
  mealTime: PlanMealTime;
  serviceShape: PlanServiceShape;
};

const metersPerMile = 1609.344;
const defaultSearchRadiusMeters = 3219;
const defaultParticipantScope: PlanParticipantScope = "group";
const defaultMealTime: PlanMealTime = "dinner";
const defaultServiceShape: PlanServiceShape = "dineIn";

const participantScopes: readonly PlanParticipantScope[] = [
  "solo",
  "duo",
  "group",
];

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

export type PlanListItem = {
  id: string;
  roomId?: string;
  title: string;
  subtitle: string;
  badge: string;
  routeTarget: PlanListRouteTarget;
  setup?: PlanSetup;
};

export type PlanListSnapshot = {
  created: PlanListItem[];
  joined: PlanListItem[];
  decided: PlanListItem[];
  history: PlanListItem[];
};

export type SavedPlanSetup = PlanSetup & { id: string };

export type LaunchedPlanSetup = SavedPlanSetup & { roomId: string };

export type PlanRepository = {
  listPlans: () => Promise<PlanListSnapshot>;
  savePlan: (plan: PlanSetup) => Promise<SavedPlanSetup>;
  launchPlan: (plan: PlanSetup) => Promise<LaunchedPlanSetup>;
  deletePlan: (input: { planId: string }) => Promise<void>;
};

export type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type PlanSupabaseQuery<TRow> = PromiseLike<
  SupabaseQueryResult<TRow[]>
> & {
  select: (columns: string) => PlanSupabaseQuery<TRow>;
  eq: (column: string, value: unknown) => PlanSupabaseQuery<TRow>;
  neq: (column: string, value: unknown) => PlanSupabaseQuery<TRow>;
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => PlanSupabaseQuery<TRow>;
};

export type PlanSupabaseMutation<TRow> = PromiseLike<
  SupabaseQueryResult<TRow>
> & {
  eq: (column: string, value: unknown) => PlanSupabaseMutation<TRow>;
  select: (columns: string) => PlanSupabaseMutation<TRow>;
  single: () => PlanSupabaseMutation<TRow>;
};

export type PlanSupabaseTable<TRow> = PlanSupabaseQuery<TRow> & {
  delete: () => PlanSupabaseMutation<TRow>;
  insert: (
    row: Record<string, unknown> | Array<Record<string, unknown>>,
  ) => PlanSupabaseMutation<TRow>;
  update: (row: Record<string, unknown>) => PlanSupabaseMutation<TRow>;
};

export type PlanSupabaseClient = {
  from: <TRow>(table: string) => PlanSupabaseTable<TRow>;
};

type SupabasePlanStatus = "pending" | "decided-active" | "decided-expired";

type SupabasePlanRow = {
  id: string;
  creator_id: string;
  name: string;
  scope?: PlanParticipantScope;
  location?: SupabasePlanLocation | null;
  session_params?: Record<string, unknown> | null;
  distance_meters?: number;
  status: SupabasePlanStatus;
  created_at: string;
  verdict_fired_at: string | null;
  expired_at: string | null;
};

type SupabasePlanLocation = {
  lat?: number;
  lng?: number;
  name?: string;
  source?: string;
};

type SupabaseMemberRow = {
  room_id: string;
  role: string;
  quiz_progress: Record<string, unknown>;
};

type SupabaseRoomRow = {
  id: string;
  plan_id: string | null;
};

type SupabaseRoomMemberRow = {
  room_id: string;
  user_id: string;
  role: string;
};

export type SupabasePlanRepositoryDependencies = {
  supabase: PlanSupabaseClient;
  userId: string;
};

export const emptyPlanListSnapshot: PlanListSnapshot = {
  created: [],
  joined: [],
  decided: [],
  history: [],
};

export function hasPlans(snapshot: PlanListSnapshot): boolean {
  return Object.values(snapshot).some((plans) => plans.length > 0);
}

function assertSupabaseRows<TRow>(
  result: SupabaseQueryResult<TRow[]>,
  queryName: string,
): TRow[] {
  if (result.error) {
    throw new Error(`${queryName} failed: ${result.error.message}`);
  }

  return result.data ?? [];
}

function sortByNewest(
  plans: SupabasePlanRow[],
  getSortKey: (plan: SupabasePlanRow) => string | null,
): SupabasePlanRow[] {
  return [...plans].sort((left, right) => {
    const leftTime = getSortKey(left) ?? left.created_at;
    const rightTime = getSortKey(right) ?? right.created_at;

    return rightTime.localeCompare(leftTime);
  });
}

function isPlanCreatedByUser(plan: SupabasePlanRow, userId: string): boolean {
  return plan.creator_id === userId;
}

function joinedPlanIdForRoom(
  room: SupabaseRoomRow,
  joinedRoomIds: Set<string>,
): string | null {
  if (!joinedRoomIds.has(room.id)) {
    return null;
  }

  return room.plan_id;
}

function roomIdByPlanId(rooms: SupabaseRoomRow[]): Map<string, string> {
  const byPlanId = new Map<string, string>();
  for (const room of rooms) {
    if (room.plan_id) {
      byPlanId.set(room.plan_id, room.id);
    }
  }
  return byPlanId;
}

function isOneOf<TValue extends string>(
  value: unknown,
  values: readonly TValue[],
): value is TValue {
  return typeof value === "string" && values.includes(value as TValue);
}

function participantScopeFromPlanRow(plan: SupabasePlanRow): PlanParticipantScope {
  return isOneOf(plan.scope, participantScopes)
    ? plan.scope
    : defaultParticipantScope;
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

function milesToMeters(radiusMiles: number): number {
  return Math.round(radiusMiles * metersPerMile);
}

function metersToMiles(distanceMeters: number): number {
  return Math.round((distanceMeters / metersPerMile) * 10) / 10;
}

function searchAreaFromPlanRow(plan: SupabasePlanRow): SearchArea | null {
  const location = plan.location;
  const locationLat = location?.lat;
  const locationLng = location?.lng;
  const locationName = location?.name;

  if (
    typeof locationLat !== "number" ||
    typeof locationLng !== "number" ||
    typeof locationName !== "string"
  ) {
    return null;
  }

  return {
    center: {
      latitude: locationLat,
      longitude: locationLng,
      label: locationName,
    },
    radiusMiles: metersToMiles(
      plan.distance_meters ?? defaultSearchRadiusMeters,
    ),
  };
}

function setupFromPlanRow(plan: SupabasePlanRow): PlanSetup {
  const sessionParams = plan.session_params ?? {};
  return {
    id: plan.id,
    name: plan.name,
    participantScope: participantScopeFromPlanRow(plan),
    searchArea: searchAreaFromPlanRow(plan),
    mealTime: mealTimeFromSessionParams(sessionParams),
    serviceShape: serviceShapeFromSessionParams(sessionParams),
  };
}

function planWriteRow(plan: PlanSetup, userId: string): Record<string, unknown> {
  const row: Record<string, unknown> = {
    creator_id: userId,
    name: plan.name.trim(),
    scope: plan.participantScope,
    location: plan.searchArea
      ? {
          lat: plan.searchArea.center.latitude,
          lng: plan.searchArea.center.longitude,
          name: plan.searchArea.center.label,
          source: "manual",
        }
      : null,
    session_params: {
      meal_time: plan.mealTime,
      group_context: plan.participantScope,
      service_shape: plan.serviceShape,
    },
    status: "pending",
  };

  if (plan.searchArea) {
    row.distance_meters = milesToMeters(plan.searchArea.radiusMiles);
  }

  return row;
}

function roomWriteRow(
  plan: SavedPlanSetup,
  userId: string,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    creator_user_id: userId,
    plan_id: plan.id,
    status: "open",
    radius_meters: plan.searchArea
      ? milesToMeters(plan.searchArea.radiusMiles)
      : defaultSearchRadiusMeters,
    session_params: {
      meal_time: plan.mealTime,
      group_context: plan.participantScope,
      service_shape: plan.serviceShape,
    },
  };

  if (plan.searchArea) {
    row.location_name = plan.searchArea.center.label;
    row.location_lat = plan.searchArea.center.latitude;
    row.location_lng = plan.searchArea.center.longitude;
    row.location_source = "manual";
  }

  return row;
}

function pendingCreatedItem(plan: SupabasePlanRow): PlanListItem {
  return {
    id: plan.id,
    title: plan.name,
    subtitle: "Pending setup",
    badge: "Created",
    routeTarget: "pending",
    setup: setupFromPlanRow(plan),
  };
}

function pendingJoinedItem(
  plan: SupabasePlanRow,
  roomId: string | undefined,
): PlanListItem {
  return {
    id: plan.id,
    ...(roomId ? { roomId } : {}),
    title: plan.name,
    subtitle: "Quiz in progress",
    badge: "Joined",
    routeTarget: "joined",
  };
}

function decidedItem(
  plan: SupabasePlanRow,
  isJoinedByUser: boolean,
  roomId: string | undefined,
): PlanListItem {
  return {
    id: plan.id,
    ...(roomId ? { roomId } : {}),
    title: plan.name,
    subtitle: "Live verdict",
    badge: isJoinedByUser ? "Joined" : "Decided",
    routeTarget: "decided",
  };
}

function historyItem(
  plan: SupabasePlanRow,
  isJoinedByUser: boolean,
  roomId: string | undefined,
): PlanListItem {
  return {
    id: plan.id,
    ...(roomId ? { roomId } : {}),
    title: plan.name,
    subtitle: "Closed verdict",
    badge: isJoinedByUser ? "Joined" : "History",
    routeTarget: "history",
  };
}

export function createSupabasePlanRepository({
  supabase,
  userId,
}: SupabasePlanRepositoryDependencies): PlanRepository {
  const savePlan = async (plan: PlanSetup): Promise<SavedPlanSetup> => {
    const row = planWriteRow(plan, userId);
    const mutation = plan.id
      ? supabase.from<SupabasePlanRow>("plans").update(row).eq("id", plan.id)
      : supabase.from<SupabasePlanRow>("plans").insert(row);
    const result = await mutation
      .select(
        "id, creator_id, name, scope, location, session_params, distance_meters, status, created_at, verdict_fired_at, expired_at",
      )
      .single();

    if (result.error) {
      throw new Error(`Plan save failed: ${result.error.message}`);
    }

    if (!result.data) {
      throw new Error("Plan save failed: no row returned");
    }

    return {
      ...setupFromPlanRow(result.data),
      id: result.data.id,
    };
  };

  const roomIdForLaunchedPlan = async (
    plan: SavedPlanSetup,
  ): Promise<string> => {
    const existingRoomResult = await supabase
      .from<SupabaseRoomRow>("rooms")
      .select("id, plan_id")
      .eq("plan_id", plan.id);
    const existingRoom = assertSupabaseRows(
      existingRoomResult,
      "Plan room read",
    )[0];

    if (existingRoom) {
      return existingRoom.id;
    }

    const roomResult = await supabase
      .from<SupabaseRoomRow>("rooms")
      .insert(roomWriteRow(plan, userId))
      .select("id, plan_id")
      .single();

    if (roomResult.error) {
      throw new Error(`Plan room create failed: ${roomResult.error.message}`);
    }

    if (!roomResult.data) {
      throw new Error("Plan room create failed: no row returned");
    }

    const memberResult = await supabase
      .from<SupabaseRoomMemberRow>("members")
      .insert({
        room_id: roomResult.data.id,
        user_id: userId,
        role: "owner",
      });

    if (memberResult.error) {
      throw new Error(`Plan owner membership failed: ${memberResult.error.message}`);
    }

    return roomResult.data.id;
  };

  return {
    listPlans: async () => {
      const membersResult = await supabase
        .from<SupabaseMemberRow>("members")
        .select("room_id, role, quiz_progress")
        .eq("user_id", userId)
        .neq("role", "owner");
      const memberships = assertSupabaseRows(
        membersResult,
        "Plan memberships read",
      );
      const joinedRoomIds = new Set(
        memberships.map((membership) => membership.room_id),
      );

      const roomsResult = await supabase
        .from<SupabaseRoomRow>("rooms")
        .select("id, plan_id");
      const rooms = assertSupabaseRows(roomsResult, "Plan rooms read");
      const joinedPlanIds = new Set(
        rooms
          .map((room) => joinedPlanIdForRoom(room, joinedRoomIds))
          .filter((planId): planId is string => planId !== null),
      );
      const roomsByPlanId = roomIdByPlanId(rooms);

      const plansResult = await supabase
        .from<SupabasePlanRow>("plans")
        .select(
          "id, creator_id, name, scope, location, session_params, distance_meters, status, created_at, verdict_fired_at, expired_at",
        )
        .order("created_at", { ascending: false });
      const plans = assertSupabaseRows(plansResult, "Plans read").filter(
        (plan) =>
          isPlanCreatedByUser(plan, userId) || joinedPlanIds.has(plan.id),
      );
      const isJoinedByUser = (plan: SupabasePlanRow) =>
        joinedPlanIds.has(plan.id);
      const isLaunchedByUser = (plan: SupabasePlanRow) =>
        isPlanCreatedByUser(plan, userId) && roomsByPlanId.has(plan.id);
      const isActiveForUser = (plan: SupabasePlanRow) =>
        joinedPlanIds.has(plan.id) || isLaunchedByUser(plan);

      return {
        created: sortByNewest(
          plans.filter(
            (plan) =>
              plan.status === "pending" &&
              isPlanCreatedByUser(plan, userId) &&
              !roomsByPlanId.has(plan.id),
          ),
          (plan) => plan.created_at,
        ).map(pendingCreatedItem),
        joined: sortByNewest(
          plans.filter(
            (plan) => plan.status === "pending" && isActiveForUser(plan),
          ),
          (plan) => plan.created_at,
        ).map((plan) => pendingJoinedItem(plan, roomsByPlanId.get(plan.id))),
        decided: sortByNewest(
          plans.filter((plan) => plan.status === "decided-active"),
          (plan) => plan.verdict_fired_at,
        ).map((plan) =>
          decidedItem(plan, isJoinedByUser(plan), roomsByPlanId.get(plan.id))
        ),
        history: sortByNewest(
          plans.filter((plan) => plan.status === "decided-expired"),
          (plan) => plan.expired_at,
        ).map((plan) =>
          historyItem(plan, isJoinedByUser(plan), roomsByPlanId.get(plan.id))
        ),
      };
    },
    savePlan,
    launchPlan: async (plan) => {
      const savedPlan = await savePlan(plan);
      const roomId = await roomIdForLaunchedPlan(savedPlan);

      return { ...savedPlan, roomId };
    },
    deletePlan: async ({ planId }) => {
      const result = await supabase
        .from<SupabasePlanRow>("plans")
        .delete()
        .eq("id", planId);

      if (result.error) {
        throw new Error(`Plan delete failed: ${result.error.message}`);
      }
    },
  };
}
