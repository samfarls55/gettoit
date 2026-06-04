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
import type { PlanRepository } from "../src/plans/planRepository";
import { emptyPlanListSnapshot } from "../src/plans/planRepository";
import type {
  QuizProgress,
  QuizProgressRepository,
} from "../src/quiz/quizProgressRepository";

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

const linkedApplePlanListState: AppStateRouterState = {
  auth: "linkedApple",
  pendingDeepLinkUrl: null,
  activePlanPhase: null,
  settingsOpen: false,
};

const committedSearchArea = {
  center: {
    latitude: 40.7128,
    longitude: -74.006,
    label: "Lower Manhattan",
  },
  radiusMiles: 2,
};

function makeWritablePlanRepository(): PlanRepository {
  return {
    listPlans: async () => ({
      ...emptyPlanListSnapshot,
      created: [
        {
          id: "pending-brunch",
          title: "Brunch plan",
          subtitle: "Pending setup",
          badge: "Created",
          routeTarget: "pending",
          setup: {
            id: "pending-brunch",
            name: "Brunch plan",
            participantScope: "duo",
            searchArea: committedSearchArea,
            mealTime: "lunch",
            serviceShape: "outdoor",
          },
        },
      ],
      joined: [
        {
          id: "joined-morgan-birthday",
          title: "Morgan's birthday",
          subtitle: "Quiz in progress",
          badge: "Joined",
          routeTarget: "joined",
        },
      ],
    }),
    savePlan: jest.fn(async (plan) => ({
      ...plan,
      id: plan.id ?? "saved-plan",
    })),
  };
}

function makeQuizProgressRepository(
  initialProgress: QuizProgress | null = null,
): QuizProgressRepository {
  let progress = initialProgress;

  return {
    loadProgress: jest.fn(async () => progress),
    saveProgress: jest.fn(async (nextProgress) => {
      progress = nextProgress;
    }),
    exitPlan: jest.fn(async () => undefined),
  };
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
      visibleRoute: "Start a new plan",
      visibleBody: "Set search area",
    },
    {
      name: "active quizzes route to Quiz",
      state: {
        auth: "linkedApple",
        pendingDeepLinkUrl: null,
        activePlanPhase: "quiz",
        settingsOpen: false,
      },
      visibleRoute: "Q1",
      visibleBody: "What sounds good tonight?",
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
    render(
      <App
        initialRouterState={state}
        quizProgressRepository={makeQuizProgressRepository()}
      />,
    );

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

  it("renders fake Plan list buckets", async () => {
    render(<App initialRouterState={linkedApplePlanListState} />);

    await waitFor(() => {
      expect(screen.getByText("Thursday dinner with the crew")).toBeOnTheScreen();
    });

    expect(screen.getAllByText("Created")).toHaveLength(2);
    expect(screen.getAllByText("Joined")).toHaveLength(2);
    expect(screen.getAllByText("Decided")).toHaveLength(2);
    expect(screen.getAllByText("History")).toHaveLength(2);
    expect(screen.getByText("Morgan's birthday")).toBeOnTheScreen();
    expect(screen.getByText("Date night fallback")).toBeOnTheScreen();
    expect(screen.getByText("Taco crawl")).toBeOnTheScreen();
  });

  it.each([
    ["Open Created Plan Thursday dinner with the crew", "Edit your plan"],
    ["Open Joined Plan Morgan's birthday", "Q1"],
    ["Open Decided Plan Date night fallback", "Verdict placeholder"],
    ["Open History Plan Taco crawl", "Verdict placeholder"],
  ])("routes %s to %s", async (accessibilityLabel, visibleRoute) => {
    render(
      <App
        initialRouterState={linkedApplePlanListState}
        quizProgressRepository={makeQuizProgressRepository()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(accessibilityLabel)).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText(accessibilityLabel));
    expect(screen.getByText(visibleRoute)).toBeOnTheScreen();
  });

  it("routes Plan list solo create actions to matching Setup mode", async () => {
    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={{
          listPlans: async () => emptyPlanListSnapshot,
          savePlan: jest.fn(),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No Plans yet")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Create solo Plan"));

    expect(screen.getByText("Start a new plan")).toBeOnTheScreen();
    expect(screen.getByText("Just me")).toBeOnTheScreen();
    expect(screen.getByText("Start the quiz")).toBeOnTheScreen();
  });

  it("routes Plan list group create actions to matching Setup mode", async () => {
    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={{
          listPlans: async () => emptyPlanListSnapshot,
          savePlan: jest.fn(),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No Plans yet")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Create group Plan"));

    expect(screen.getByText("Start a new plan")).toBeOnTheScreen();
    expect(screen.getByText("A group")).toBeOnTheScreen();
    expect(screen.getByText("Drop the invite link")).toBeOnTheScreen();
  });

  it("hydrates edit Setup from a pending Plan", async () => {
    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={makeWritablePlanRepository()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Open Created Plan Brunch plan")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Open Created Plan Brunch plan"));

    expect(screen.getByText("Edit your plan")).toBeOnTheScreen();
    expect(screen.getByDisplayValue("Brunch plan")).toBeOnTheScreen();
    expect(screen.getByText("Lower Manhattan")).toBeOnTheScreen();
    expect(screen.getByText("Search area - 2.0 mi")).toBeOnTheScreen();
    expect(screen.getByText("Two of us")).toBeOnTheScreen();
    expect(screen.getByText("Lunch")).toBeOnTheScreen();
    expect(screen.getByText("Outdoor seating")).toBeOnTheScreen();
  });

  it("blocks launch until a Search area is committed", async () => {
    const repository = makeWritablePlanRepository();

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={repository}
        quizProgressRepository={makeQuizProgressRepository()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Create group Plan")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Create group Plan"));
    fireEvent.changeText(screen.getByLabelText("Name this plan"), "Dinner crew");
    fireEvent.press(screen.getByText("Drop the invite link"));

    expect(screen.getByText("Set search area before launch.")).toBeOnTheScreen();
    expect(repository.savePlan).not.toHaveBeenCalled();
  });

  it("saves a pending Plan and returns to the Plan list", async () => {
    const repository = makeWritablePlanRepository();

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={repository}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Create solo Plan")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Create solo Plan"));
    fireEvent.changeText(screen.getByLabelText("Name this plan"), "Solo ramen");
    fireEvent.press(screen.getByText("Set search area"));
    fireEvent.press(screen.getByText("USE THIS AREA"));
    fireEvent.press(screen.getByText("SAVE FOR LATER"));

    await waitFor(() => {
      expect(repository.savePlan).toHaveBeenCalledWith({
        name: "Solo ramen",
        participantScope: "solo",
        searchArea: {
          center: {
            latitude: 37.7749,
            longitude: -122.4194,
            label: "San Francisco",
          },
          radiusMiles: 2,
        },
        mealTime: "dinner",
        serviceShape: "dineIn",
      });
      expect(screen.getByText("Plans")).toBeOnTheScreen();
    });
  });

  it("writes edit changes and routes launch outcomes", async () => {
    const repository = makeWritablePlanRepository();

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={repository}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Open Created Plan Brunch plan")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Open Created Plan Brunch plan"));
    fireEvent.changeText(screen.getByLabelText("Name this plan"), "Brunch reset");
    fireEvent.press(screen.getByText("Just me"));
    fireEvent.press(screen.getByText("Start the quiz"));

    await waitFor(() => {
      expect(repository.savePlan).toHaveBeenCalledWith({
        id: "pending-brunch",
        name: "Brunch reset",
        participantScope: "solo",
        searchArea: committedSearchArea,
        mealTime: "lunch",
        serviceShape: "outdoor",
      });
      expect(screen.getByText("Q1")).toBeOnTheScreen();
    });
  });

  it("runs Q1-Q4 quiz navigation with persistence, back, and leave", async () => {
    const quizProgressRepository = makeQuizProgressRepository();

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={makeWritablePlanRepository()}
        quizProgressRepository={quizProgressRepository}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Open Joined Plan Morgan's birthday")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Open Joined Plan Morgan's birthday"));
    await waitFor(() => {
      expect(screen.getByText("Q1")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("Italian"));
    fireEvent.press(screen.getByText("Mexican"));
    fireEvent.press(screen.getByText("Save cravings"));

    await waitFor(() => {
      expect(quizProgressRepository.saveProgress).toHaveBeenLastCalledWith({
        roomId: "joined-morgan-birthday",
        currentQuestion: "q2",
        answers: {
          q1CuisineCravings: ["italian", "mexican"],
        },
      });
      expect(screen.getByText("Q2")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("$$"));
    fireEvent.press(screen.getByText("Save spend"));
    await waitFor(() => {
      expect(screen.getByText("Q3")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("Back"));
    expect(screen.getByText("Q2")).toBeOnTheScreen();
    expect(screen.getByLabelText("Spend cap $$ selected")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Save spend"));
    fireEvent.press(screen.getByText("Hidden gem"));
    fireEvent.press(screen.getByText("Save reputation"));
    await waitFor(() => {
      expect(screen.getByText("Q4")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("SOCIAL"));
    fireEvent.press(screen.getByText("Save vibe"));
    await waitFor(() => {
      expect(quizProgressRepository.saveProgress).toHaveBeenLastCalledWith({
        roomId: "joined-morgan-birthday",
        currentQuestion: "q4",
        answers: {
          q1CuisineCravings: ["italian", "mexican"],
          q2SpendCap: "$$",
          q3Reputation: "hiddenGem",
          q4VibeEnergy: "social",
        },
      });
    });

    fireEvent.press(screen.getByText("Leave"));
    expect(screen.getByText("Leave this plan?")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Confirm leave Plan"));

    await waitFor(() => {
      expect(quizProgressRepository.exitPlan).toHaveBeenCalledWith({
        roomId: "joined-morgan-birthday",
      });
      expect(screen.getByText("Plans")).toBeOnTheScreen();
    });
  });

  it("resumes quiz progress and preserves prior answers", async () => {
    const resumedRepository = makeQuizProgressRepository({
      roomId: "joined-morgan-birthday",
      currentQuestion: "q3",
      answers: {
        q1CuisineCravings: ["italian"],
        q2SpendCap: "$$$",
      },
    });

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={makeWritablePlanRepository()}
        quizProgressRepository={resumedRepository}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Open Joined Plan Morgan's birthday")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Open Joined Plan Morgan's birthday"));
    await waitFor(() => {
      expect(screen.getByText("Q3")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("Back"));
    expect(screen.getByLabelText("Spend cap $$$ selected")).toBeOnTheScreen();
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
