import type { InviteRouteResolution } from "../invites/inviteLinks";

export type AuthState = "idle" | "anonymous" | "linkedApple";

export type ActivePlanPhase =
  | "join"
  | "setup"
  | "quiz"
  | "waiting"
  | "verdict"
  | "readOnlyVerdict";

export type AppRouteName =
  | "signInGate"
  | "planList"
  | "join"
  | "setup"
  | "quiz"
  | "waiting"
  | "verdict"
  | "readOnlyVerdict"
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
  | { type: "appleSignInSucceeded" }
  | { type: "claimCodeRedeemed" }
  | { type: "authSignedOut" }
  | { type: "deepLinkOpened"; url: string }
  | { type: "deepLinkHandled" }
  | { type: "deepLinkResolved"; resolution: InviteRouteResolution }
  | { type: "openSettings" }
  | { type: "closeSettings" }
  | { type: "openSetup" }
  | { type: "startQuiz" }
  | { type: "waitForVerdict" }
  | { type: "showVerdict" }
  | { type: "showReadOnlyVerdict" }
  | { type: "returnToPlans" };

export const initialAppStateRouterState: AppStateRouterState = {
  auth: "idle",
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

function phaseForInviteResolution(
  resolution: InviteRouteResolution,
): ActivePlanPhase | null {
  switch (resolution.kind) {
    case "join":
      return "join";
    case "quiz":
      return "quiz";
    case "waiting":
      return "waiting";
    case "verdict":
      return "readOnlyVerdict";
    case "invalid":
    case "stale":
      return null;
  }
}

export function appStateRouterReducer(
  state: AppStateRouterState,
  event: AppStateRouterEvent,
): AppStateRouterState {
  switch (event.type) {
    case "appleSignInSucceeded":
      return { ...state, auth: "linkedApple" };
    case "claimCodeRedeemed":
      return { ...state, auth: "anonymous" };
    case "authSignedOut":
      return {
        ...initialAppStateRouterState,
        pendingDeepLinkUrl: state.pendingDeepLinkUrl,
      };
    case "deepLinkOpened":
      return { ...state, pendingDeepLinkUrl: event.url };
    case "deepLinkHandled":
      return { ...state, pendingDeepLinkUrl: null };
    case "deepLinkResolved":
      return stateWithActivePlanPhase(
        { ...state, pendingDeepLinkUrl: null },
        phaseForInviteResolution(event.resolution),
      );
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
    case "showReadOnlyVerdict":
      return stateWithActivePlanPhase(state, "readOnlyVerdict");
    case "returnToPlans":
      return stateWithActivePlanPhase(state, null);
  }
}

export function routeForAppState(state: AppStateRouterState): AppRoute {
  if (state.auth !== "linkedApple") {
    return { name: "signInGate" };
  }

  if (state.pendingDeepLinkUrl) {
    return { name: "deepLink" };
  }

  switch (state.activePlanPhase) {
    case "join":
      return { name: "join" };
    case "quiz":
      return { name: "quiz" };
    case "waiting":
      return { name: "waiting" };
    case "verdict":
      return { name: "verdict" };
    case "readOnlyVerdict":
      return { name: "readOnlyVerdict" };
    case "setup":
      return { name: state.settingsOpen ? "settings" : "setup" };
    case null:
      return { name: state.settingsOpen ? "settings" : "planList" };
  }
}
