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
      return { ...state, activePlanPhase: "setup", settingsOpen: false };
    case "startQuiz":
      return { ...state, activePlanPhase: "quiz", settingsOpen: false };
    case "waitForVerdict":
      return { ...state, activePlanPhase: "waiting", settingsOpen: false };
    case "showVerdict":
      return { ...state, activePlanPhase: "verdict", settingsOpen: false };
    case "returnToPlans":
      return { ...state, activePlanPhase: null, settingsOpen: false };
  }
}

export function routeForAppState(state: AppStateRouterState): AppRoute {
  if (state.auth !== "signedIn") {
    return { name: "signInGate" };
  }

  if (state.pendingDeepLinkUrl) {
    return { name: "deepLink" };
  }

  if (state.activePlanPhase === "quiz") {
    return { name: "quiz" };
  }

  if (state.activePlanPhase === "waiting") {
    return { name: "waiting" };
  }

  if (state.activePlanPhase === "verdict") {
    return { name: "verdict" };
  }

  if (state.settingsOpen) {
    return { name: "settings" };
  }

  if (state.activePlanPhase === "setup") {
    return { name: "setup" };
  }

  return { name: "planList" };
}
