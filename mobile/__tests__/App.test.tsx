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
import { emptyPlanListSnapshot } from "../src/plans/planRepository";

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
      visibleRoute: "Plans",
      visibleBody: "Thursday dinner with the crew",
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
    expect(screen.getByText("Plans")).toBeOnTheScreen();

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
      expect(screen.getByText("Plans")).toBeOnTheScreen();
    });
  });

  it("renders fake Plan list buckets and routes row taps to placeholders", () => {
    const linkedAppleState: AppStateRouterState = {
      auth: "linkedApple",
      pendingDeepLinkUrl: null,
      activePlanPhase: null,
      settingsOpen: false,
    };
    const renderPlanList = () =>
      render(
        <App initialRouterState={linkedAppleState} />,
      );

    const planList = renderPlanList();

    expect(screen.getAllByText("Created")).toHaveLength(2);
    expect(screen.getAllByText("Joined")).toHaveLength(2);
    expect(screen.getAllByText("Decided")).toHaveLength(2);
    expect(screen.getAllByText("History")).toHaveLength(2);
    expect(screen.getByText("Thursday dinner with the crew")).toBeOnTheScreen();
    expect(screen.getByText("Morgan's birthday")).toBeOnTheScreen();
    expect(screen.getByText("Date night fallback")).toBeOnTheScreen();
    expect(screen.getByText("Taco crawl")).toBeOnTheScreen();

    fireEvent.press(
      screen.getByLabelText("Open Created Plan Thursday dinner with the crew"),
    );
    expect(screen.getByText("Search area")).toBeOnTheScreen();
    planList.unmount();

    const joinedPlanList = renderPlanList();
    fireEvent.press(
      screen.getByLabelText("Open Joined Plan Morgan's birthday"),
    );
    expect(screen.getByText("Quiz placeholder")).toBeOnTheScreen();
    joinedPlanList.unmount();

    const decidedPlanList = renderPlanList();
    fireEvent.press(
      screen.getByLabelText("Open Decided Plan Date night fallback"),
    );
    expect(screen.getByText("Verdict placeholder")).toBeOnTheScreen();
    decidedPlanList.unmount();

    renderPlanList();
    fireEvent.press(screen.getByLabelText("Open History Plan Taco crawl"));
    expect(screen.getByText("Verdict placeholder")).toBeOnTheScreen();
  });

  it("renders an empty Plan list with a create-Plan entry path", () => {
    render(
      <App
        initialRouterState={{
          auth: "linkedApple",
          pendingDeepLinkUrl: null,
          activePlanPhase: null,
          settingsOpen: false,
        }}
        planRepository={{
          listPlans: () => emptyPlanListSnapshot,
        }}
      />,
    );

    expect(screen.getByText("No Plans yet")).toBeOnTheScreen();
    expect(screen.getByLabelText("Create a Plan")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Create a Plan"));
    expect(screen.getByText("Search area")).toBeOnTheScreen();
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
