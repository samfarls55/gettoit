import { useReducer } from "react";
import { Button, Platform, View } from "react-native";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import App, { MobileAppShell } from "../App";
import { mobileTokens } from "../src/design/tokens";
import type { InviteRouteResolution } from "../src/invites/inviteLinks";
import type { AppStateRouterState } from "../src/navigation/appStateRouter";
import {
  appStateRouterReducer,
  initialAppStateRouterState,
} from "../src/navigation/appStateRouter";
import type {
  PlanListSnapshot,
  PlanRepository,
} from "../src/plans/planRepository";
import { emptyPlanListSnapshot } from "../src/plans/planRepository";
import {
  nativePlanRepository,
  nativeQ5CandidateRepository,
  nativeQuizProgressRepository,
  nativeQuizSubmissionRepository,
  nativeVerdictRepository,
  nativeWaitingRepository,
} from "../src/native/nativeRuntime";
import type {
  QuizProgress,
  QuizProgressRepository,
} from "../src/quiz/quizProgressRepository";
import type { QuizSubmissionRepository } from "../src/quiz/quizSubmissionRepository";
import type {
  WaitingRepository,
  WaitingSnapshot,
} from "../src/waiting/waitingRepository";
import type {
  VerdictRepository,
  VerdictViewModel,
} from "../src/verdict/verdictRepository";

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
  let snapshot: PlanListSnapshot = {
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
  };

  return {
    listPlans: async () => snapshot,
    savePlan: jest.fn(async (plan) => ({
      ...plan,
      id: plan.id ?? "saved-plan",
    })),
    launchPlan: jest.fn(async (plan) => ({
      ...plan,
      id: plan.id ?? "saved-plan",
      roomId: "saved-room",
    })),
    deletePlan: jest.fn(async ({ planId }) => {
      snapshot = {
        ...snapshot,
        created: snapshot.created.filter((plan) => plan.id !== planId),
      };
    }),
  };
}

function makeRoutedPlanRepository(): PlanRepository {
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
          id: "joined-birthday",
          title: "Birthday dinner",
          subtitle: "Quiz in progress",
          badge: "Joined",
          routeTarget: "joined",
        },
      ],
      decided: [
        {
          id: "decided-sushi",
          roomId: "room-decided-sushi",
          title: "Sushi night",
          subtitle: "Live verdict",
          badge: "Decided",
          routeTarget: "decided",
        },
      ],
      history: [
        {
          id: "history-noodles",
          roomId: "room-history-noodles",
          title: "Noodle crawl",
          subtitle: "Closed verdict",
          badge: "History",
          routeTarget: "history",
        },
      ],
    }),
    savePlan: jest.fn(async (plan) => ({
      ...plan,
      id: plan.id ?? "saved-plan",
    })),
    launchPlan: jest.fn(async (plan) => ({
      ...plan,
      id: plan.id ?? "saved-plan",
      roomId: "saved-room",
    })),
    deletePlan: jest.fn(async () => undefined),
  };
}

function makeEmptyPlanRepository(): PlanRepository {
  return {
    listPlans: async () => emptyPlanListSnapshot,
    savePlan: jest.fn(),
    launchPlan: jest.fn(),
    deletePlan: jest.fn(),
  };
}

function makeAuthBoundary(overrides = {}) {
  return {
    deleteCurrentAccount: jest.fn().mockResolvedValue(undefined),
    signInWithApple: jest.fn().mockResolvedValue(undefined),
    signInWithDevPassword: jest.fn().mockResolvedValue(undefined),
    redeemClaimCode: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeInviteBoundary(
  resolution: InviteRouteResolution = { kind: "join", roomId: "open-room" },
) {
  return {
    createGroupInviteLink: jest
      .fn()
      .mockResolvedValue("https://gettoit.example/join/saved-room"),
    resolveInviteLink: jest.fn().mockResolvedValue(resolution),
    shareInviteLink: jest.fn().mockResolvedValue(undefined),
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

function makeQuizSubmissionRepository(): QuizSubmissionRepository {
  return {
    submitQuiz: jest.fn(async () => undefined),
  };
}

const waitingSnapshot: WaitingSnapshot = {
  roomId: "waiting-room",
  status: "waiting",
  members: [
    { id: "ava", displayName: "Ava", quizSubmitted: true },
    { id: "morgan", displayName: "Morgan", quizSubmitted: false },
  ],
};

function makeWaitingRepository(
  snapshot: WaitingSnapshot = waitingSnapshot,
  fireResult: WaitingSnapshot = {
    ...waitingSnapshot,
    status: "verdictReady",
  },
): WaitingRepository {
  return {
    loadSnapshot: jest.fn(async () => snapshot),
    fireVerdict: jest.fn(async () => fireResult),
  };
}

function makeVerdictRepository(
  verdict: VerdictViewModel = {
    kind: "live",
    roomId: "active-room",
    flavor: "group",
    placeName: "Pico's Taqueria",
    formattedAddress: "1 Main St",
    googleMapsUri: "https://maps.google.example/picos",
    attributionText: "Powered by Google",
    ruleText: "Best fit for the table.",
    timeBadge: { time: "7:00 PM", audience: "All 2 of you" },
    receipts: [{ id: "ava", name: "Ava", action: "wanted social" }],
    primaryActionLabel: "I'm in",
    reroll: {
      burnsRemaining: 3,
      ineligibleReason: null,
      isEligible: true,
      windowClosesAt: null,
    },
  },
): VerdictRepository {
  return {
    loadVerdict: jest.fn(async ({ roomId, flavor }) => {
      if (verdict.kind === "noSurvivor") {
        return { ...verdict, roomId };
      }
      if (verdict.kind === "history") {
        return { ...verdict, roomId };
      }

      return {
        ...verdict,
        roomId,
        flavor,
        timeBadge:
          flavor === "solo"
            ? { time: verdict.timeBadge.time, audience: "" }
            : verdict.timeBadge,
        receipts: flavor === "solo" ? [] : verdict.receipts,
        primaryActionLabel:
          flavor === "solo" ? "Save taste profile" : verdict.primaryActionLabel,
      };
    }),
    loadHistoryVerdict: jest.fn(async ({ roomId }) => ({
      kind: "history" as const,
      roomId,
      planName: "Taco crawl",
      decidedAtLabel: "Decided Jun 4",
      display: {
        status: "available" as const,
        placeName: "Pico's Taqueria",
        formattedAddress: "1 Main St",
        googleMapsUri: "https://maps.google.example/picos",
        attributionText: "Powered by Google",
      },
    })),
    reroll: jest.fn(async () => undefined),
  };
}

describe("App", () => {
  beforeEach(() => {
    jest
      .spyOn(nativePlanRepository, "listPlans")
      .mockResolvedValue(emptyPlanListSnapshot);
    jest
      .spyOn(nativePlanRepository, "savePlan")
      .mockImplementation(async (plan) => ({
        ...plan,
        id: plan.id ?? "saved-plan",
      }));
    jest
      .spyOn(nativePlanRepository, "launchPlan")
      .mockImplementation(async (plan) => ({
        ...plan,
        id: plan.id ?? "saved-plan",
        roomId: "saved-room",
      }));
    jest
      .spyOn(nativePlanRepository, "deletePlan")
      .mockResolvedValue(undefined);
    jest
      .spyOn(nativeQ5CandidateRepository, "loadCandidates")
      .mockResolvedValue([]);
    jest
      .spyOn(nativeQuizProgressRepository, "loadProgress")
      .mockResolvedValue(null);
    jest
      .spyOn(nativeQuizProgressRepository, "saveProgress")
      .mockResolvedValue(undefined);
    jest
      .spyOn(nativeQuizProgressRepository, "exitPlan")
      .mockResolvedValue(undefined);
    jest
      .spyOn(nativeQuizSubmissionRepository, "submitQuiz")
      .mockResolvedValue(undefined);
    jest
      .spyOn(nativeWaitingRepository, "loadSnapshot")
      .mockResolvedValue(waitingSnapshot);
    jest
      .spyOn(nativeWaitingRepository, "fireVerdict")
      .mockResolvedValue({ ...waitingSnapshot, status: "verdictReady" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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

      expect(screen.getByLabelText("GetToIt logo")).toBeOnTheScreen();
      expect(screen.getByText("Decide Dinner.\nGet To It.")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Save your taste profile and turn group indecision into a locked pick.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Voted on the web?")).toBeOnTheScreen();
      expect(screen.getByLabelText("Sign in with Apple")).toBeOnTheScreen();
      expect(screen.getByText("Continue with Apple")).toBeOnTheScreen();
    },
  );

  it("uses the mobile token adapter", () => {
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
      visibleRoute: "Resolving invite link",
      visibleBody: "Checking this Plan link.",
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
      visibleRoute: "Waiting for the group",
      visibleBody: "The verdict opens as soon as voting closes.",
    },
    {
      name: "decided Plans route to Verdict",
      state: {
        auth: "linkedApple",
        pendingDeepLinkUrl: null,
        activePlanPhase: "verdict",
        settingsOpen: false,
      },
      visibleRoute: "Live verdict",
      visibleBody: "PICO'S\nTAQUERIA",
    },
    {
      name: "settings can cover the signed-in Plan list",
      state: {
        auth: "linkedApple",
        pendingDeepLinkUrl: null,
        activePlanPhase: null,
        settingsOpen: true,
      },
      visibleRoute: "Just one thing here for now.",
      visibleBody: "Delete my data",
    },
  ])("$name", async ({ state, visibleRoute, visibleBody }) => {
    render(
      <MobileAppShell
        routerState={state}
        verdictRepository={makeVerdictRepository()}
        waitingRepository={makeWaitingRepository()}
      />,
    );

    if (state.activePlanPhase === "verdict") {
      await waitFor(() => {
        expect(screen.getByText(visibleRoute)).toBeOnTheScreen();
        expect(screen.getByText(visibleBody)).toBeOnTheScreen();
      });
      return;
    }

    expect(screen.getByText(visibleRoute)).toBeOnTheScreen();
    expect(screen.getByText(visibleBody)).toBeOnTheScreen();
    if (state.activePlanPhase === "waiting") {
      await waitFor(() => {
        expect(screen.getByText("Ava")).toBeOnTheScreen();
      });
    }
  });

  it("routes visible auth and deep-link event outcomes", () => {
    render(<EventRouterHarness />);

    expect(screen.getByText("Decide Dinner.\nGet To It.")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Sign in"));
    expect(screen.getByText("Plans")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Open invite link"));
    expect(screen.getByText("Resolving invite link")).toBeOnTheScreen();
  });

  it("routes to the signed-in landing after a successful mocked Apple sign-in", async () => {
    const signInWithApple = jest.fn().mockResolvedValue(undefined);

    render(
      <App
        authBoundary={makeAuthBoundary({ signInWithApple })}
      />,
    );

    fireEvent.press(screen.getByLabelText("Sign in with Apple"));

    await waitFor(() => {
      expect(signInWithApple).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Plans")).toBeOnTheScreen();
    });
  });

  it("enables flagged Expo web dev password sign-in", async () => {
    const originalFlag = process.env.EXPO_PUBLIC_ENABLE_WEB_DEV_LOGIN;
    const originalPlatform = Platform.OS;
    const signInWithDevPassword = jest.fn().mockResolvedValue(undefined);

    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });
    process.env.EXPO_PUBLIC_ENABLE_WEB_DEV_LOGIN = "1";

    try {
      render(
        <App
          authBoundary={makeAuthBoundary({ signInWithDevPassword })}
        />,
      );

      fireEvent.changeText(
        screen.getByLabelText("Dev login email"),
        "dev@example.com",
      );
      fireEvent.changeText(
        screen.getByLabelText("Dev login password"),
        "test-password",
      );
      fireEvent.press(screen.getByLabelText("Sign in for web testing"));

      await waitFor(() => {
        expect(signInWithDevPassword).toHaveBeenCalledWith({
          email: "dev@example.com",
          password: "test-password",
        });
        expect(screen.getByText("Plans")).toBeOnTheScreen();
      });
    } finally {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: originalPlatform,
      });
      if (originalFlag === undefined) {
        delete process.env.EXPO_PUBLIC_ENABLE_WEB_DEV_LOGIN;
      } else {
        process.env.EXPO_PUBLIC_ENABLE_WEB_DEV_LOGIN = originalFlag;
      }
    }
  });

  it("uses the native Plan repository by default", async () => {
    jest.spyOn(nativePlanRepository, "listPlans").mockResolvedValue({
      ...emptyPlanListSnapshot,
      created: [
        {
          id: "runtime-plan",
          title: "Runtime dinner",
          subtitle: "Pending setup",
          badge: "Created",
          routeTarget: "pending",
        },
      ],
    });

    render(<App initialRouterState={linkedApplePlanListState} />);

    await waitFor(() => {
      expect(nativePlanRepository.listPlans).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Runtime dinner")).toBeOnTheScreen();
    });

  });

  it("uses the native Verdict repository by default", async () => {
    const loadVerdict = jest
      .spyOn(nativeVerdictRepository, "loadVerdict")
      .mockResolvedValue({
        kind: "live",
        roomId: "active-room",
        flavor: "group",
        placeName: "Runtime Dumpling House",
        formattedAddress: "9 Real St",
        googleMapsUri: "https://maps.google.example/runtime",
        attributionText: "Powered by Google",
        ruleText: "Best fit for the table.",
        timeBadge: { time: "7:00 PM", audience: "All 2 of you" },
        receipts: [{ id: "ava", name: "Ava", action: "wanted social" }],
        primaryActionLabel: "I'm in",
        reroll: {
          burnsRemaining: 3,
          ineligibleReason: null,
          isEligible: true,
          windowClosesAt: null,
        },
      });

    render(
      <App
        initialRouterState={{
          ...linkedApplePlanListState,
          activePlanPhase: "verdict",
        }}
      />,
    );

    await waitFor(() => {
      expect(loadVerdict).toHaveBeenCalledWith({
        roomId: "active-room",
        flavor: "group",
      });
      expect(screen.getByText("RUNTIME\nDUMPLING\nHOUSE")).toBeOnTheScreen();
    });

    expect(screen.queryByText("PICO'S\nTAQUERIA")).toBeNull();
  });

  it("shows a retry state when verdict loading fails", async () => {
    const recoveredVerdict: VerdictViewModel = {
      kind: "live",
      roomId: "active-room",
      flavor: "group",
      placeName: "Recovered Dumplings",
      formattedAddress: "10 Main St",
      googleMapsUri: "https://maps.google.example/recovered",
      attributionText: "Powered by Google",
      ruleText: "Best fit.",
      timeBadge: { time: "7:00 PM", audience: "All 2 of you" },
      receipts: [],
      primaryActionLabel: "I'm in",
      reroll: {
        burnsRemaining: 3,
        ineligibleReason: null,
        isEligible: true,
        windowClosesAt: null,
      },
    };
    const verdictRepository: VerdictRepository = {
      loadVerdict: jest
        .fn()
        .mockRejectedValueOnce(new Error("verdict not ready"))
        .mockResolvedValueOnce(recoveredVerdict),
      loadHistoryVerdict: jest.fn(),
      reroll: jest.fn(),
    };

    render(
      <MobileAppShell
        routerState={{
          ...linkedApplePlanListState,
          activePlanPhase: "verdict",
        }}
        verdictRepository={verdictRepository}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Verdict unavailable")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("Try again"));

    await waitFor(() => {
      expect(verdictRepository.loadVerdict).toHaveBeenCalledTimes(2);
      expect(screen.getByText("RECOVERED\nDUMPLINGS")).toBeOnTheScreen();
    });
  });

  it("renders injected Plan list buckets", async () => {
    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={makeRoutedPlanRepository()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Brunch plan")).toBeOnTheScreen();
    });

    expect(screen.getAllByText("Created")).toHaveLength(2);
    expect(screen.getAllByText("Joined")).toHaveLength(2);
    expect(screen.getAllByText("Decided")).toHaveLength(2);
    expect(screen.getAllByText("History")).toHaveLength(2);
    expect(screen.getByText("Birthday dinner")).toBeOnTheScreen();
    expect(screen.getByText("Sushi night")).toBeOnTheScreen();
    expect(screen.getByText("Noodle crawl")).toBeOnTheScreen();
  });

  it("deletes a Created Plan after confirmation and keeps joined Plans", async () => {
    const repository = makeWritablePlanRepository();

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={repository}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Brunch plan")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Delete Created Plan Brunch plan"));
    expect(screen.getByText("Delete Brunch plan?")).toBeOnTheScreen();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Confirm delete Plan Brunch plan"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(repository.deletePlan).toHaveBeenCalledWith({
        planId: "pending-brunch",
      });
      expect(screen.queryByLabelText("Open Created Plan Brunch plan")).toBeNull();
      expect(screen.getByText("Morgan's birthday")).toBeOnTheScreen();
      expect(screen.getByText("Plan deleted.")).toBeOnTheScreen();
    });
  });

  it("opens Settings from the Plan list and closes back to Plans", async () => {
    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={makeEmptyPlanRepository()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Open Settings")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Open Settings"));
    expect(screen.getByText("Just one thing here for now.")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Close Settings"));

    await waitFor(() => {
      expect(screen.getByText("No Plans yet")).toBeOnTheScreen();
    });
  });

  it("routes account delete from Settings back to S00a", async () => {
    const deleteCurrentAccount = jest.fn().mockResolvedValue(undefined);

    render(
      <App
        authBoundary={makeAuthBoundary({ deleteCurrentAccount })}
        initialRouterState={linkedApplePlanListState}
        planRepository={makeEmptyPlanRepository()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Open Settings")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Open Settings"));
    fireEvent.press(screen.getByText("Delete my data"));
    fireEvent.press(screen.getByLabelText("Confirm delete account"));

    await waitFor(() => {
      expect(deleteCurrentAccount).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Decide Dinner.\nGet To It.")).toBeOnTheScreen();
    });
  });

  it("routes sign out from Settings back to S00a", async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);

    render(
      <App
        authBoundary={makeAuthBoundary({ signOut })}
        initialRouterState={linkedApplePlanListState}
        planRepository={makeEmptyPlanRepository()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Open Settings")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Open Settings"));
    fireEvent.press(screen.getByText("Sign out"));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Decide Dinner.\nGet To It.")).toBeOnTheScreen();
    });
  });

  it.each([
    ["Open Created Plan Brunch plan", "Edit your plan"],
    ["Open Joined Plan Birthday dinner", "Q1"],
    ["Open Decided Plan Sushi night", "Live verdict"],
    ["Open History Plan Noodle crawl", "Verdict record"],
  ])("routes %s to %s", async (accessibilityLabel, visibleRoute) => {
    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={makeRoutedPlanRepository()}
        quizProgressRepository={makeQuizProgressRepository()}
        verdictRepository={makeVerdictRepository()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(accessibilityLabel)).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText(accessibilityLabel));

    await waitFor(() => {
      expect(screen.getByText(visibleRoute)).toBeOnTheScreen();
    });
  });

  it("routes History Plans to read-only verdict without live actions", async () => {
    const verdictRepository = makeVerdictRepository();

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={makeRoutedPlanRepository()}
        verdictRepository={verdictRepository}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Open History Plan Noodle crawl")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Open History Plan Noodle crawl"));

    await waitFor(() => {
      expect(verdictRepository.loadHistoryVerdict).toHaveBeenCalledWith({
        roomId: "room-history-noodles",
        flavor: "group",
      });
      expect(screen.getByText("Verdict record")).toBeOnTheScreen();
      expect(screen.getByText("PICO'S\nTAQUERIA")).toBeOnTheScreen();
      expect(screen.queryByText("I'm in")).toBeNull();
      expect(screen.queryByText("Reroll")).toBeNull();
      expect(screen.getByText("Start a new decision")).toBeOnTheScreen();
    });
  });

  it("routes Plan list solo create actions to matching Setup mode", async () => {
    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={makeEmptyPlanRepository()}
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
        planRepository={makeEmptyPlanRepository()}
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
    expect(repository.launchPlan).not.toHaveBeenCalled();
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
      expect(repository.launchPlan).toHaveBeenCalledWith({
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

  it("shares a group invite link after launching Setup", async () => {
    const repository = makeWritablePlanRepository();
    const inviteBoundary = makeInviteBoundary();

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        inviteBoundary={inviteBoundary}
        planRepository={repository}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Create group Plan")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Create group Plan"));
    fireEvent.changeText(screen.getByLabelText("Name this plan"), "Dinner crew");
    fireEvent.press(screen.getByText("Set search area"));
    fireEvent.press(screen.getByText("USE THIS AREA"));
    fireEvent.press(screen.getByText("Drop the invite link"));

    await waitFor(() => {
      expect(inviteBoundary.createGroupInviteLink).toHaveBeenCalledWith(
        expect.objectContaining({ id: "saved-plan", name: "Dinner crew" }),
      );
      expect(inviteBoundary.shareInviteLink).toHaveBeenCalledWith(
        "https://gettoit.example/join/saved-room",
      );
      expect(screen.getByText("Waiting for the group")).toBeOnTheScreen();
      expect(screen.getByText("Ava")).toBeOnTheScreen();
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
        currentQuestion: "q5",
        answers: {
          q1CuisineCravings: ["italian", "mexican"],
          q2SpendCap: "$$",
          q3Reputation: "hiddenGem",
          q4VibeEnergy: "social",
        },
      });
      expect(screen.getByText("Q5")).toBeOnTheScreen();
    });
    expect(nativeQ5CandidateRepository.loadCandidates).toHaveBeenCalledWith({
      roomId: "joined-morgan-birthday",
      answers: {
        q1CuisineCravings: ["italian", "mexican"],
        q2SpendCap: "$$",
        q3Reputation: "hiddenGem",
        q4VibeEnergy: "social",
      },
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

  it("routes Q5 submit into Waiting for a group flow", async () => {
    const quizSubmissionRepository = makeQuizSubmissionRepository();

    render(
      <App
        initialRouterState={{
          ...linkedApplePlanListState,
          activePlanPhase: "quiz",
        }}
        q5CandidateRepository={{ loadCandidates: jest.fn(async () => []) }}
        quizProgressRepository={makeQuizProgressRepository({
          roomId: "active-room",
          currentQuestion: "q5",
          answers: {
            q1CuisineCravings: ["italian"],
            q2SpendCap: "$$",
            q3Reputation: "popular",
            q4VibeEnergy: "social",
          },
        })}
        quizSubmissionRepository={quizSubmissionRepository}
        waitingRepository={makeWaitingRepository()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No spots to rate near you.")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("Head to the verdict"));

    await waitFor(() => {
      expect(quizSubmissionRepository.submitQuiz).toHaveBeenCalledWith({
        roomId: "active-room",
        answers: {
          q1CuisineCravings: ["italian"],
          q2SpendCap: "$$",
          q3Reputation: "popular",
          q4VibeEnergy: "social",
          q5Ratings: {},
        },
        q5Candidates: [],
      });
      expect(screen.getByText("Waiting for the group")).toBeOnTheScreen();
      expect(screen.getByText("Ava")).toBeOnTheScreen();
    });
  });

  it("renders Waiting member progress and lets the initiator close voting", async () => {
    const waitingRepository = makeWaitingRepository();

    render(
      <App
        initialRouterState={{
          ...linkedApplePlanListState,
          activePlanPhase: "waiting",
        }}
        verdictRepository={makeVerdictRepository()}
        waitingRepository={waitingRepository}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Waiting for the group")).toBeOnTheScreen();
      expect(screen.getByText("Ava")).toBeOnTheScreen();
      expect(screen.getByText("Submitted")).toBeOnTheScreen();
      expect(screen.getByText("Morgan")).toBeOnTheScreen();
      expect(screen.getByText("Still answering")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("Close voting"));

    await waitFor(() => {
      expect(waitingRepository.fireVerdict).toHaveBeenCalledWith({
        roomId: "active-room",
      });
      expect(screen.getByText("Live verdict")).toBeOnTheScreen();
    });
  });

  it("routes verdict-ready Waiting snapshots to the live verdict", async () => {
    render(
      <App
        initialRouterState={{
          ...linkedApplePlanListState,
          activePlanPhase: "waiting",
        }}
        verdictRepository={makeVerdictRepository()}
        waitingRepository={makeWaitingRepository({
          ...waitingSnapshot,
          status: "verdictReady",
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Live verdict")).toBeOnTheScreen();
    });
  });

  it("routes solo Q5 submit to the solo live verdict flavor", async () => {
    const quizSubmissionRepository = makeQuizSubmissionRepository();
    const verdictRepository = makeVerdictRepository();

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        planRepository={{
          listPlans: async () => emptyPlanListSnapshot,
          savePlan: jest.fn(async (plan) => ({
            ...plan,
            id: "solo-plan",
          })),
          launchPlan: jest.fn(async (plan) => ({
            ...plan,
            id: "solo-plan",
            roomId: "solo-room",
          })),
          deletePlan: jest.fn(),
        }}
        q5CandidateRepository={{ loadCandidates: jest.fn(async () => []) }}
        quizProgressRepository={makeQuizProgressRepository({
          roomId: "solo-plan",
          currentQuestion: "q5",
          answers: {
            q1CuisineCravings: ["ramen"],
            q2SpendCap: "$$",
            q3Reputation: "hiddenGem",
            q4VibeEnergy: "cozy",
          },
        })}
        quizSubmissionRepository={quizSubmissionRepository}
        verdictRepository={verdictRepository}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Create solo Plan")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Create solo Plan"));
    fireEvent.changeText(screen.getByLabelText("Name this plan"), "Solo ramen");
    fireEvent.press(screen.getByText("Set search area"));
    fireEvent.press(screen.getByText("USE THIS AREA"));
    fireEvent.press(screen.getByText("Start the quiz"));

    await waitFor(() => {
      expect(screen.getByText("No spots to rate near you.")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("Head to the verdict"));

    await waitFor(() => {
      expect(verdictRepository.loadVerdict).toHaveBeenCalledWith({
        roomId: "solo-room",
        flavor: "solo",
      });
      expect(screen.getByText("Solo verdict")).toBeOnTheScreen();
      expect(screen.queryByText("Member receipts")).toBeNull();
      expect(screen.getByText("Save taste profile")).toBeOnTheScreen();
    });
  });

  it("routes no-survivor verdicts through the verdict surface", async () => {
    const verdictRepository = makeVerdictRepository({
      kind: "noSurvivor",
      roomId: "active-room",
    });

    render(
      <App
        initialRouterState={{
          ...linkedApplePlanListState,
          activePlanPhase: "verdict",
        }}
        verdictRepository={verdictRepository}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No spot fits tonight")).toBeOnTheScreen();
    });

    expect(
      screen.getByText("Start a new Plan with a wider search area."),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText("Widen search area")).toBeNull();
  });

  it("returns to Plans with feedback when Waiting sees a session-ended state", async () => {
    render(
      <App
        initialRouterState={{
          ...linkedApplePlanListState,
          activePlanPhase: "waiting",
        }}
        planRepository={makeEmptyPlanRepository()}
        waitingRepository={makeWaitingRepository({
          ...waitingSnapshot,
          status: "sessionEnded",
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Session ended. Back to Plans.")).toBeOnTheScreen();
      expect(screen.getByText("No Plans yet")).toBeOnTheScreen();
    });
  });

  it("routes a cold-start invite link to the join screen", async () => {
    const inviteBoundary = makeInviteBoundary({ kind: "join", roomId: "open-room" });

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        inviteBoundary={inviteBoundary}
        nativeLinkBoundary={{
          getInitialUrl: jest
            .fn()
            .mockResolvedValue("https://gettoit.example/join/open-room"),
          subscribe: jest.fn(() => () => undefined),
        }}
        planRepository={makeEmptyPlanRepository()}
      />,
    );

    await waitFor(() => {
      expect(inviteBoundary.resolveInviteLink).toHaveBeenCalledWith(
        "https://gettoit.example/join/open-room",
      );
      expect(screen.getByText("Join Plan")).toBeOnTheScreen();
    });
  });

  it("routes a cold-start decided invite link to read-only verdict", async () => {
    const inviteBoundary = makeInviteBoundary({
      kind: "verdict",
      roomId: "decided-room",
    });
    const verdictRepository = makeVerdictRepository();

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        inviteBoundary={inviteBoundary}
        nativeLinkBoundary={{
          getInitialUrl: jest
            .fn()
            .mockResolvedValue("https://gettoit.example/join/decided-room"),
          subscribe: jest.fn(() => () => undefined),
        }}
        planRepository={makeEmptyPlanRepository()}
        verdictRepository={verdictRepository}
      />,
    );

    await waitFor(() => {
      expect(inviteBoundary.resolveInviteLink).toHaveBeenCalledWith(
        "https://gettoit.example/join/decided-room",
      );
      expect(verdictRepository.loadHistoryVerdict).toHaveBeenCalledWith({
        roomId: "decided-room",
        flavor: "group",
      });
      expect(screen.getByText("Verdict record")).toBeOnTheScreen();
      expect(screen.queryByText("I'm in")).toBeNull();
      expect(screen.queryByText("Reroll")).toBeNull();
    });
  });

  it("routes a warm invite link event to Waiting", async () => {
    const inviteBoundary = makeInviteBoundary({
      kind: "waiting",
      roomId: "waiting-room",
    });
    let listener: ((url: string) => void) | null = null;

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        inviteBoundary={inviteBoundary}
        nativeLinkBoundary={{
          getInitialUrl: jest.fn().mockResolvedValue(null),
          subscribe: jest.fn((nextListener) => {
            listener = nextListener;
            return () => undefined;
          }),
        }}
        planRepository={makeEmptyPlanRepository()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No Plans yet")).toBeOnTheScreen();
    });

    await act(async () => {
      listener?.("https://gettoit.example/join/waiting-room");
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(inviteBoundary.resolveInviteLink).toHaveBeenCalledWith(
        "https://gettoit.example/join/waiting-room",
      );
      expect(screen.getByText("Waiting for the group")).toBeOnTheScreen();
      expect(screen.getByText("Ava")).toBeOnTheScreen();
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

  it("routes a cold-start invite link to the join screen", async () => {
    const inviteBoundary = makeInviteBoundary({ kind: "join", roomId: "open-room" });

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        inviteBoundary={inviteBoundary}
        nativeLinkBoundary={{
          getInitialUrl: jest
            .fn()
            .mockResolvedValue("https://gettoit.example/join/open-room"),
          subscribe: jest.fn(() => () => undefined),
        }}
        planRepository={makeEmptyPlanRepository()}
      />,
    );

    await waitFor(() => {
      expect(inviteBoundary.resolveInviteLink).toHaveBeenCalledWith(
        "https://gettoit.example/join/open-room",
      );
      expect(screen.getByText("Join Plan")).toBeOnTheScreen();
    });
  });

  it("routes a warm invite link event to Waiting", async () => {
    const inviteBoundary = makeInviteBoundary({
      kind: "waiting",
      roomId: "waiting-room",
    });
    let listener: ((url: string) => void) | null = null;

    render(
      <App
        initialRouterState={linkedApplePlanListState}
        inviteBoundary={inviteBoundary}
        nativeLinkBoundary={{
          getInitialUrl: jest.fn().mockResolvedValue(null),
          subscribe: jest.fn((nextListener) => {
            listener = nextListener;
            return () => undefined;
          }),
        }}
        planRepository={makeEmptyPlanRepository()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No Plans yet")).toBeOnTheScreen();
    });

    await act(async () => {
      listener?.("https://gettoit.example/join/waiting-room");
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(inviteBoundary.resolveInviteLink).toHaveBeenCalledWith(
        "https://gettoit.example/join/waiting-room",
      );
      expect(screen.getByText("Waiting for the group")).toBeOnTheScreen();
      expect(screen.getByText("Ava")).toBeOnTheScreen();
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
        authBoundary={makeAuthBoundary({ redeemClaimCode })}
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
        authBoundary={makeAuthBoundary({ redeemClaimCode })}
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
