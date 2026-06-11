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

export type PlanRepository = {
  listPlans: () => Promise<PlanListSnapshot>;
  savePlan: (plan: PlanSetup) => Promise<PlanSetup & { id: string }>;
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
  insert: (row: Record<string, unknown>) => PlanSupabaseMutation<TRow>;
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

export const fakePlanRepository: PlanRepository = {
  listPlans: async () => ({
    created: [
      {
        id: "created-thursday-dinner",
        title: "Thursday dinner with the crew",
        subtitle: "Pending setup - Search area missing",
        badge: "Created",
        routeTarget: "pending",
        setup: {
          id: "created-thursday-dinner",
          name: "Thursday dinner with the crew",
          participantScope: "group",
          searchArea: null,
          mealTime: "dinner",
          serviceShape: "dineIn",
        },
      },
    ],
    joined: [
      {
        id: "joined-morgan-birthday",
        title: "Morgan's birthday",
        subtitle: "Quiz in progress - 2 people waiting",
        badge: "Joined",
        routeTarget: "joined",
      },
    ],
    decided: [
      {
        id: "decided-date-night",
        roomId: "room-decided-date-night",
        title: "Date night fallback",
        subtitle: "Live verdict - Reroll still open",
        badge: "Decided",
        routeTarget: "decided",
      },
    ],
    history: [
      {
        id: "history-taco-crawl",
        roomId: "room-history-taco-crawl",
        title: "Taco crawl",
        subtitle: "Closed verdict - Read-only",
        badge: "History",
        routeTarget: "history",
      },
    ],
  }),
  savePlan: async (plan) => ({
    ...plan,
    id: plan.id ?? "fake-saved-plan",
  }),
  deletePlan: async () => undefined,
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

function pendingJoinedItem(plan: SupabasePlanRow): PlanListItem {
  return {
    id: plan.id,
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

      return {
        created: sortByNewest(
          plans.filter(
            (plan) =>
              plan.status === "pending" && isPlanCreatedByUser(plan, userId),
          ),
          (plan) => plan.created_at,
        ).map(pendingCreatedItem),
        joined: sortByNewest(
          plans.filter(
            (plan) => plan.status === "pending" && joinedPlanIds.has(plan.id),
          ),
          (plan) => plan.created_at,
        ).map(pendingJoinedItem),
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
    savePlan: async (plan) => {
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
