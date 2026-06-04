export type AuthState = "signedOut" | "signedIn";

export type ActivePlanPhase = "setup" | "quiz" | "waiting" | "verdict";

export type AppRouteName =
  | "signInGate"
  | "planList"
  | "setup"
  | "quiz"
  | "waiting"
  | "verdict"
  | "settings"
  | "deepLink";

export type AppRoute = {
  name: AppRouteName;
};

export type AppStateRouterState = {
  auth: AuthState;
  pendingDeepLinkUrl: string | null;
  activePlanPhase: ActivePlanPhase | null;
  settingsOpen: boolean;
};

export type AppStateRouterEvent =
  | { type: "authSignedIn" }
  | { type: "authSignedOut" }
  | { type: "deepLinkOpened"; url: string }
  | { type: "deepLinkHandled" }
  | { type: "openSettings" }
  | { type: "closeSettings" }
  | { type: "openSetup" }
  | { type: "startQuiz" }
  | { type: "waitForVerdict" }
  | { type: "showVerdict" }
  | { type: "returnToPlans" };

export const initialAppStateRouterState: AppStateRouterState = {
  auth: "signedOut",
  pendingDeepLinkUrl: null,
  activePlanPhase: null,
  settingsOpen: false,
};

function stateWithActivePlanPhase(
  state: AppStateRouterState,
  activePlanPhase: ActivePlanPhase | null,
): AppStateRouterState {
  return { ...state, activePlanPhase, settingsOpen: false };
}

export function appStateRouterReducer(
  state: AppStateRouterState,
  event: AppStateRouterEvent,
): AppStateRouterState {
  switch (event.type) {
    case "authSignedIn":
      return { ...state, auth: "signedIn" };
    case "authSignedOut":
      return {
        ...initialAppStateRouterState,
        pendingDeepLinkUrl: state.pendingDeepLinkUrl,
      };
    case "deepLinkOpened":
      return { ...state, pendingDeepLinkUrl: event.url };
    case "deepLinkHandled":
      return { ...state, pendingDeepLinkUrl: null };
    case "openSettings":
      return { ...state, settingsOpen: true };
    case "closeSettings":
      return { ...state, settingsOpen: false };
    case "openSetup":
      return stateWithActivePlanPhase(state, "setup");
    case "startQuiz":
      return stateWithActivePlanPhase(state, "quiz");
    case "waitForVerdict":
      return stateWithActivePlanPhase(state, "waiting");
    case "showVerdict":
      return stateWithActivePlanPhase(state, "verdict");
    case "returnToPlans":
      return stateWithActivePlanPhase(state, null);
  }
}

export function routeForAppState(state: AppStateRouterState): AppRoute {
  if (state.auth !== "signedIn") {
    return { name: "signInGate" };
  }

  if (state.pendingDeepLinkUrl) {
    return { name: "deepLink" };
  }

  switch (state.activePlanPhase) {
    case "quiz":
      return { name: "quiz" };
    case "waiting":
      return { name: "waiting" };
    case "verdict":
      return { name: "verdict" };
    case "setup":
      return { name: state.settingsOpen ? "settings" : "setup" };
    case null:
      return { name: state.settingsOpen ? "settings" : "planList" };
  }
}
