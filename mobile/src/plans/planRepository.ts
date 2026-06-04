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
  listPlans: () => PlanListSnapshot;
};

export const emptyPlanListSnapshot: PlanListSnapshot = {
  created: [],
  joined: [],
  decided: [],
  history: [],
};

export function hasPlans(snapshot: PlanListSnapshot): boolean {
  return (
    snapshot.created.length > 0 ||
    snapshot.joined.length > 0 ||
    snapshot.decided.length > 0 ||
    snapshot.history.length > 0
  );
}

export const fakePlanRepository: PlanRepository = {
  listPlans: () => ({
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
