export type PlanListRouteTarget = "pending" | "joined" | "decided" | "history";

export type PlanListItem = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  routeTarget: PlanListRouteTarget;
};

export type PlanListSnapshot = {
  created: PlanListItem[];
  joined: PlanListItem[];
  decided: PlanListItem[];
  history: PlanListItem[];
};

export type PlanRepository = {
  listPlans: () => Promise<PlanListSnapshot>;
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

export type PlanSupabaseClient = {
  from: <TRow>(table: string) => PlanSupabaseQuery<TRow>;
};

type SupabasePlanStatus = "pending" | "decided-active" | "decided-expired";

type SupabasePlanRow = {
  id: string;
  creator_id: string;
  name: string;
  status: SupabasePlanStatus;
  created_at: string;
  verdict_fired_at: string | null;
  expired_at: string | null;
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
        title: "Date night fallback",
        subtitle: "Live verdict - Reroll still open",
        badge: "Decided",
        routeTarget: "decided",
      },
    ],
    history: [
      {
        id: "history-taco-crawl",
        title: "Taco crawl",
        subtitle: "Closed verdict - Read-only",
        badge: "History",
        routeTarget: "history",
      },
    ],
  }),
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

function isPlanJoinedByUser(
  plan: SupabasePlanRow,
  joinedPlanIds: Set<string>,
): boolean {
  return joinedPlanIds.has(plan.id);
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

function pendingCreatedItem(plan: SupabasePlanRow): PlanListItem {
  return {
    id: plan.id,
    title: plan.name,
    subtitle: "Pending setup",
    badge: "Created",
    routeTarget: "pending",
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
  joinedPlanIds: Set<string>,
): PlanListItem {
  return {
    id: plan.id,
    title: plan.name,
    subtitle: "Live verdict",
    badge: isPlanJoinedByUser(plan, joinedPlanIds) ? "Joined" : "Decided",
    routeTarget: "decided",
  };
}

function historyItem(
  plan: SupabasePlanRow,
  joinedPlanIds: Set<string>,
): PlanListItem {
  return {
    id: plan.id,
    title: plan.name,
    subtitle: "Closed verdict",
    badge: isPlanJoinedByUser(plan, joinedPlanIds) ? "Joined" : "History",
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

      const plansResult = await supabase
        .from<SupabasePlanRow>("plans")
        .select(
          "id, creator_id, name, status, created_at, verdict_fired_at, expired_at",
        )
        .order("created_at", { ascending: false });
      const plans = assertSupabaseRows(plansResult, "Plans read").filter(
        (plan) =>
          isPlanCreatedByUser(plan, userId) || joinedPlanIds.has(plan.id),
      );

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
        ).map((plan) => decidedItem(plan, joinedPlanIds)),
        history: sortByNewest(
          plans.filter((plan) => plan.status === "decided-expired"),
          (plan) => plan.expired_at,
        ).map((plan) => historyItem(plan, joinedPlanIds)),
      };
    },
  };
}
