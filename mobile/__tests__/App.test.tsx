import { useReducer } from "react";
import { Button, View } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

import App, { MobileAppShell } from "../App";
import { mobileTokens } from "../src/design/tokens";
import type { AppStateRouterState } from "../src/navigation/appStateRouter";
import {
  appStateRouterReducer,
  initialAppStateRouterState,
} from "../src/navigation/appStateRouter";

function EventRouterHarness() {
  const [routerState, dispatch] = useReducer(
    appStateRouterReducer,
    initialAppStateRouterState,
  );

  return (
    <View>
      <MobileAppShell routerState={routerState} />
      <Button
        title="Sign in"
        onPress={() => dispatch({ type: "authSignedIn" })}
      />
      <Button
        title="Open invite link"
        onPress={() =>
          dispatch({
            type: "deepLinkOpened",
            url: "https://gettoit.example/join/abc",
          })
        }
      />
    </View>
  );
}

describe("App", () => {
  it("routes unauthenticated launches to the sign-in gate", () => {
    render(<App />);

    expect(screen.getByText("GetToIt")).toBeOnTheScreen();
    expect(screen.getByText("Sign in gate")).toBeOnTheScreen();
    expect(screen.getByText("Sign in with Apple to continue.")).toBeOnTheScreen();
    expect(mobileTokens.color.sun).toBe("#FFD23F");
  });

  it.each<{
    name: string;
    state: AppStateRouterState;
    visibleRoute: string;
    visibleBody: string;
  }>([
    {
      name: "signed-in members land on the Plan list",
      state: {
        auth: "signedIn",
        pendingDeepLinkUrl: null,
        activePlanPhase: null,
        settingsOpen: false,
      },
      visibleRoute: "Plan list",
      visibleBody: "Your Plans will appear here.",
    },
    {
      name: "deep links route to the resolver before active Plan work",
      state: {
        auth: "signedIn",
        pendingDeepLinkUrl: "https://gettoit.example/join/abc",
        activePlanPhase: "quiz",
        settingsOpen: false,
      },
      visibleRoute: "Deep-link placeholder",
      visibleBody: "Resolving invite link.",
    },
    {
      name: "setup Plans route to Setup",
      state: {
        auth: "signedIn",
        pendingDeepLinkUrl: null,
        activePlanPhase: "setup",
        settingsOpen: false,
      },
      visibleRoute: "Setup placeholder",
      visibleBody: "Plan setup starts here.",
    },
    {
      name: "active quizzes route to Quiz",
      state: {
        auth: "signedIn",
        pendingDeepLinkUrl: null,
        activePlanPhase: "quiz",
        settingsOpen: false,
      },
      visibleRoute: "Quiz placeholder",
      visibleBody: "Answer Plan questions here.",
    },
    {
      name: "waiting Plans route to Waiting",
      state: {
        auth: "signedIn",
        pendingDeepLinkUrl: null,
        activePlanPhase: "waiting",
        settingsOpen: false,
      },
      visibleRoute: "Waiting placeholder",
      visibleBody: "Waiting for the group verdict.",
    },
    {
      name: "decided Plans route to Verdict",
      state: {
        auth: "signedIn",
        pendingDeepLinkUrl: null,
        activePlanPhase: "verdict",
        settingsOpen: false,
      },
      visibleRoute: "Verdict placeholder",
      visibleBody: "The Plan verdict appears here.",
    },
    {
      name: "settings can cover the signed-in Plan list",
      state: {
        auth: "signedIn",
        pendingDeepLinkUrl: null,
        activePlanPhase: null,
        settingsOpen: true,
      },
      visibleRoute: "Settings placeholder",
      visibleBody: "Account settings live here.",
    },
  ])("$name", ({ state, visibleRoute, visibleBody }) => {
    render(<App initialRouterState={state} />);

    expect(screen.getByText(visibleRoute)).toBeOnTheScreen();
    expect(screen.getByText(visibleBody)).toBeOnTheScreen();
  });

  it("routes visible auth and deep-link event outcomes", () => {
    render(<EventRouterHarness />);

    expect(screen.getByText("Sign in gate")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Sign in"));
    expect(screen.getByText("Plan list")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Open invite link"));
    expect(screen.getByText("Deep-link placeholder")).toBeOnTheScreen();
  });
});
