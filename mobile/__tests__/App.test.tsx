import { useReducer } from "react";
import { Button, View } from "react-native";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

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
        onPress={() => dispatch({ type: "appleSignInSucceeded" })}
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
  it.each<AppStateRouterState["auth"]>(["idle", "anonymous"])(
    "routes %s auth launches to the sign-in gate",
    (auth) => {
      render(
        <App
          initialRouterState={{
            auth,
            pendingDeepLinkUrl: null,
            activePlanPhase: null,
            settingsOpen: false,
          }}
        />,
      );

      expect(screen.getByText("Tonight's session")).toBeOnTheScreen();
      expect(screen.getByText("Pick up where you left off")).toBeOnTheScreen();
      expect(screen.getByLabelText("Voted on the web?")).toBeOnTheScreen();
      expect(screen.getByLabelText("Sign in with Apple")).toBeOnTheScreen();
      expect(screen.getByText("Save my taste profile")).toBeOnTheScreen();
    },
  );

  it("uses the design-system token adapter", () => {
    expect(mobileTokens.color.sun).toBe("#FFD23F");
  });

  it.each<{
    name: string;
    state: AppStateRouterState;
    visibleRoute: string;
    visibleBody: string;
  }>([
    {
      name: "Linked-Apple members land on the Plan list",
      state: {
        auth: "linkedApple",
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
        auth: "linkedApple",
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
        auth: "linkedApple",
        pendingDeepLinkUrl: null,
        activePlanPhase: "setup",
        settingsOpen: false,
      },
      visibleRoute: "Search area",
      visibleBody: "USE THIS AREA",
    },
    {
      name: "active quizzes route to Quiz",
      state: {
        auth: "linkedApple",
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
        auth: "linkedApple",
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
        auth: "linkedApple",
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
        auth: "linkedApple",
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

    expect(screen.getByText("Pick up where you left off")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Sign in"));
    expect(screen.getByText("Plan list")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Open invite link"));
    expect(screen.getByText("Deep-link placeholder")).toBeOnTheScreen();
  });

  it("routes to the signed-in landing after a successful mocked Apple sign-in", async () => {
    const signInWithApple = jest.fn().mockResolvedValue(undefined);

    render(
      <App
        authBoundary={{
          signInWithApple,
          redeemClaimCode: jest.fn(),
        }}
      />,
    );

    fireEvent.press(screen.getByLabelText("Sign in with Apple"));

    await waitFor(() => {
      expect(signInWithApple).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Plan list")).toBeOnTheScreen();
    });
  });

  it("reveals Account claim before Apple sign-in and handles claim-code success", async () => {
    const redeemClaimCode = jest.fn().mockResolvedValue(undefined);

    render(
      <App
        authBoundary={{
          signInWithApple: jest.fn(),
          redeemClaimCode,
        }}
      />,
    );

    const appleButton = screen.getByLabelText("Sign in with Apple");
    fireEvent.press(screen.getByLabelText("Voted on the web?"));
    fireEvent.changeText(screen.getByLabelText("Claim code"), " claim-123 ");
    fireEvent.press(screen.getByLabelText("Bring my Plans over"));

    await waitFor(() => {
      expect(redeemClaimCode).toHaveBeenCalledWith("claim-123");
      expect(
        screen.getByText("Web Plans ready. Sign in with Apple to finish."),
      ).toBeOnTheScreen();
      expect(appleButton).toBeOnTheScreen();
    });
  });

  it("keeps S00a open when a mocked claim-code redeem fails", async () => {
    const redeemClaimCode = jest
      .fn()
      .mockRejectedValue(new Error("expired claim code"));

    render(
      <App
        authBoundary={{
          signInWithApple: jest.fn(),
          redeemClaimCode,
        }}
      />,
    );

    fireEvent.press(screen.getByLabelText("Voted on the web?"));
    fireEvent.changeText(screen.getByLabelText("Claim code"), "expired");
    fireEvent.press(screen.getByLabelText("Bring my Plans over"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "That code didn't work. Generate a fresh one from your web link.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Sign in with Apple")).toBeOnTheScreen();
    });
  });
});
