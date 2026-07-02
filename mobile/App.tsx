import { StatusBar } from "expo-status-bar";
import { type Dispatch, useEffect, useReducer, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { mobileTokens } from "./src/design/tokens";
import type { InviteRouteResolution } from "./src/invites/inviteLinks";
import type { MobileAuthState } from "./src/auth/authRepository";
import type {
  AppRouteName,
  AppStateRouterState,
} from "./src/navigation/appStateRouter";
import {
  nativeAuthBoundary,
  nativeInviteBoundary,
  nativeLinkBoundary as runtimeNativeLinkBoundary,
  nativePlanRepository,
  nativeQ5CandidateRepository,
  nativeQuizProgressRepository,
  nativeQuizSubmissionRepository,
  nativeVerdictRepository,
  nativeWaitingRepository,
} from "./src/native/nativeRuntime";
import {
  initialAppStateRouterState,
  appStateRouterReducer,
  routeForAppState,
} from "./src/navigation/appStateRouter";
import type {
  PlanListItem,
  PlanListSnapshot,
  PlanParticipantScope,
  PlanRepository,
  PlanSetup,
  SavedPlanSetup,
  LaunchedPlanSetup,
} from "./src/plans/planRepository";
import { emptyPlanListSnapshot } from "./src/plans/planRepository";
import { VerdictBackdrop } from "./src/design/VerdictBackdrop";
import { PlanListScreen } from "./src/plans/PlanListScreen";
import { SetupScreen } from "./src/plans/SetupScreen";
import { QuizScreen } from "./src/quiz/QuizScreen";
import type { Q5CandidateRepository } from "./src/quiz/q5CandidateRepository";
import type { QuizProgressRepository } from "./src/quiz/quizProgressRepository";
import type { QuizSubmissionRepository } from "./src/quiz/quizSubmissionRepository";
import { VerdictScreen } from "./src/verdict/VerdictScreen";
import type {
  RerollInput,
  VerdictFlavor,
  VerdictRepository,
  VerdictViewModel,
} from "./src/verdict/verdictRepository";
import { WaitingScreen } from "./src/waiting/WaitingScreen";
import type { WaitingRepository } from "./src/waiting/waitingRepository";

type ExpoProcess = {
  env: Record<string, string | undefined>;
};

declare const process: ExpoProcess;

type DevPasswordCredentials = {
  email: string;
  password: string;
};

type AuthBoundary = {
  restoreSession?: () => Promise<MobileAuthState>;
  deleteCurrentAccount: () => Promise<unknown>;
  signInWithApple: () => Promise<unknown>;
  signInWithDevPassword?: (
    credentials: DevPasswordCredentials,
  ) => Promise<unknown>;
  redeemClaimCode: (code: string) => Promise<unknown>;
  signOut: () => Promise<unknown>;
};

type InviteBoundary = {
  createGroupInviteLink: (
    plan: SavedPlanSetup | LaunchedPlanSetup,
  ) => Promise<string>;
  resolveInviteLink: (url: string) => Promise<InviteRouteResolution>;
  shareInviteLink: (url: string) => Promise<void>;
};

type NativeLinkBoundary = {
  getInitialUrl: () => Promise<string | null>;
  subscribe: (listener: (url: string) => void) => () => void;
};

type AppProps = {
  authBoundary?: AuthBoundary;
  initialRouterState?: AppStateRouterState;
  inviteBoundary?: InviteBoundary;
  nativeLinkBoundary?: NativeLinkBoundary;
  planRepository?: PlanRepository;
  q5CandidateRepository?: Q5CandidateRepository;
  quizProgressRepository?: QuizProgressRepository;
  quizSubmissionRepository?: QuizSubmissionRepository;
  verdictRepository?: VerdictRepository;
  waitingRepository?: WaitingRepository;
  [key: string]: unknown;
};

type MobileAppShellProps = {
  authBoundary?: AuthBoundary;
  onCreatePlan?: (participantScope: PlanParticipantScope) => void;
  onAccountDeleted?: () => void;
  onLaunchSetup?: (plan: PlanSetup) => Promise<void>;
  routerState: AppStateRouterState;
  onAppleSignInSucceeded?: () => void;
  onClaimCodeRedeemed?: () => void;
  onCloseSettings?: () => void;
  onOpenSettings?: () => void;
  onOpenPlan?: (plan: PlanListItem) => void;
  onPlanDeleted?: () => void;
  onQuizExited?: () => void;
  onQuizSubmitted?: () => void;
  onSaveSetup?: (plan: PlanSetup) => Promise<void>;
  onSessionEnded?: () => void;
  onSignedOut?: () => void;
  onVerdictReady?: () => void;
  planRepository?: PlanRepository;
  planListNotice?: string | null;
  q5CandidateRepository?: Q5CandidateRepository;
  quizProgressRepository?: QuizProgressRepository;
  quizSubmissionRepository?: QuizSubmissionRepository;
  setupPlan?: PlanSetup;
  quizSession?: QuizSession;
  verdictRepository?: VerdictRepository;
  waitingRepository?: WaitingRepository;
};

type RouteContent = {
  title: string;
  body: string;
};

type PlanListStatus = "idle" | "loading" | "loaded" | "error";

type PlanListLoadState = {
  requestKey: string | null;
  snapshot: PlanListSnapshot;
  status: Exclude<PlanListStatus, "loading">;
};

type PlanListContentProps = {
  notice?: string | null;
  onDeletePlan?: (plan: PlanListItem) => Promise<void> | void;
  onCreatePlan?: (participantScope: PlanParticipantScope) => void;
  onOpenPlan?: (plan: PlanListItem) => void;
  onOpenSettings?: () => void;
  plans: PlanListSnapshot;
  status: PlanListStatus;
};

type QuizSession = {
  roomId: string;
  participantScope: PlanParticipantScope;
  role: "initiator" | "joiner";
};

type VerdictLoadState = {
  requestKey: string | null;
  verdict: VerdictViewModel | null;
  failed: boolean;
};

function routeAfterQuizSubmission(participantScope: PlanParticipantScope) {
  return participantScope === "solo" ? "showVerdict" : "waitForVerdict";
}

function groupQuizSession(
  roomId: string,
  role: QuizSession["role"],
): QuizSession {
  return {
    roomId,
    participantScope: "group",
    role,
  };
}

function routedInviteRoomId(
  resolution: InviteRouteResolution,
): string | null {
  switch (resolution.kind) {
    case "join":
    case "quiz":
    case "waiting":
    case "verdict":
      return resolution.roomId;
    case "invalid":
    case "stale":
      return null;
  }
}

const contentByRouteName: Record<AppRouteName, RouteContent> = {
  signInGate: {
    title: "Sign in gate",
    body: "Sign in once and your taste profile saves itself.",
  },
  planList: {
    title: "Plan list",
    body: "Your Plans will appear here.",
  },
  join: {
    title: "Join Plan",
    body: "Opening this group Plan.",
  },
  setup: {
    title: "Plan setup",
    body: "Plan setup starts here.",
  },
  quiz: {
    title: "Quiz",
    body: "Answer Plan questions here.",
  },
  waiting: {
    title: "Waiting",
    body: "Waiting for the group verdict.",
  },
  verdict: {
    title: "Verdict",
    body: "The Plan verdict appears here.",
  },
  readOnlyVerdict: {
    title: "Closed verdict",
    body: "The closed Plan verdict appears here.",
  },
  settings: {
    title: "Settings",
    body: "Account settings live here.",
  },
  deepLink: {
    title: "Resolving invite link",
    body: "Checking this Plan link.",
  },
};

const defaultAuthBoundary: AuthBoundary = {
  restoreSession: async () => ({ kind: "idle" }),
  deleteCurrentAccount: async () => undefined,
  signInWithApple: async () => undefined,
  redeemClaimCode: async () => undefined,
  signOut: async () => undefined,
};

const defaultNativeLinkBoundary: NativeLinkBoundary = {
  getInitialUrl: async () => null,
  subscribe: () => () => undefined,
};

function isWebDevLoginEnabled(): boolean {
  return (
    Platform.OS === "web" &&
    process.env.EXPO_PUBLIC_ENABLE_WEB_DEV_LOGIN === "1"
  );
}

const unconfiguredPlanRepository: PlanRepository = {
  listPlans: async () => emptyPlanListSnapshot,
  savePlan: async () => {
    throw new Error("Plan repository is not configured.");
  },
  launchPlan: async () => {
    throw new Error("Plan repository is not configured.");
  },
  deletePlan: async () => {
    throw new Error("Plan repository is not configured.");
  },
};

const unconfiguredQuizProgressRepository: QuizProgressRepository = {
  loadProgress: async () => null,
  saveProgress: async () => {
    throw new Error("Quiz progress repository is not configured.");
  },
  exitPlan: async () => {
    throw new Error("Quiz progress repository is not configured.");
  },
};

const unconfiguredQuizSubmissionRepository: QuizSubmissionRepository = {
  submitQuiz: async () => {
    throw new Error("Quiz submission repository is not configured.");
  },
};

const unconfiguredVerdictRepository: VerdictRepository = {
  loadVerdict: async () => {
    throw new Error("Verdict repository is not configured.");
  },
  loadHistoryVerdict: async () => {
    throw new Error("Verdict repository is not configured.");
  },
  reroll: async () => {
    throw new Error("Verdict repository is not configured.");
  },
};

const unconfiguredWaitingRepository: WaitingRepository = {
  loadSnapshot: async (roomId) => ({
    roomId,
    status: "waiting",
    members: [],
  }),
  fireVerdict: async () => {
    throw new Error("Waiting repository is not configured.");
  },
};

const runtimeAuthBoundary: AuthBoundary = {
  restoreSession: async () => {
    try {
      return await nativeAuthBoundary.restoreSession();
    } catch {
      return { kind: "idle" };
    }
  },
  deleteCurrentAccount: nativeAuthBoundary.deleteCurrentAccount,
  signInWithApple: nativeAuthBoundary.signInWithApple,
  signInWithDevPassword: nativeAuthBoundary.signInWithDevPassword,
  redeemClaimCode: nativeAuthBoundary.redeemClaimCode,
  signOut: nativeAuthBoundary.signOut,
};

function dispatchAuthState(
  dispatch: Dispatch<Parameters<typeof appStateRouterReducer>[1]>,
  authState: MobileAuthState,
) {
  switch (authState.kind) {
    case "linkedApple":
      dispatch({ type: "appleSignInSucceeded" });
      return;
    case "anonymous":
      dispatch({ type: "claimCodeRedeemed" });
      return;
    case "idle":
      dispatch({ type: "authSignedOut" });
      return;
  }
}

function defaultSetupPlan(participantScope: PlanParticipantScope): PlanSetup {
  return {
    name: "",
    participantScope,
    searchArea: null,
    mealTime: "dinner",
    serviceShape: "dineIn",
  };
}

function deletedPlanIdsKey(ids: Set<string>): string {
  return JSON.stringify(Array.from(ids).sort());
}

function editSetupPlan(plan: PlanListItem): PlanSetup {
  return (
    plan.setup ?? {
      ...defaultSetupPlan("group"),
      id: plan.id,
      name: plan.title,
    }
  );
}

function roomIdForPlanRoute(plan: PlanListItem): string {
  return plan.roomId ?? plan.id;
}

function filterDeletedCreatedPlans(
  snapshot: PlanListSnapshot,
  deletedCreatedPlanIds: Set<string>,
): PlanListSnapshot {
  if (deletedCreatedPlanIds.size === 0) {
    return snapshot;
  }

  return {
    created: snapshot.created.filter(
      (plan) => !deletedCreatedPlanIds.has(plan.id),
    ),
    joined: snapshot.joined,
    decided: snapshot.decided,
    history: snapshot.history,
  };
}

export default function App({
  authBoundary = runtimeAuthBoundary,
  initialRouterState,
  inviteBoundary = nativeInviteBoundary,
  nativeLinkBoundary = runtimeNativeLinkBoundary,
  planRepository = nativePlanRepository,
  q5CandidateRepository = nativeQ5CandidateRepository,
  quizProgressRepository = nativeQuizProgressRepository,
  quizSubmissionRepository = nativeQuizSubmissionRepository,
  verdictRepository = nativeVerdictRepository,
  waitingRepository = nativeWaitingRepository,
}: AppProps = {}) {
  const [routerState, dispatch] = useReducer(
    appStateRouterReducer,
    initialRouterState ?? initialAppStateRouterState,
  );
  const [setupPlan, setSetupPlan] = useState<PlanSetup>(() =>
    defaultSetupPlan("group"),
  );
  const [quizSession, setQuizSession] = useState<QuizSession>({
    roomId: "active-room",
    participantScope: "group",
    role: "initiator",
  });
  const [planListNotice, setPlanListNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialRouterState) {
      return;
    }

    let isCurrent = true;

    authBoundary.restoreSession?.().then((authState) => {
      if (isCurrent) {
        dispatchAuthState(dispatch, authState);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [authBoundary, initialRouterState]);

  useEffect(() => {
    let isCurrent = true;

    nativeLinkBoundary.getInitialUrl().then((url) => {
      if (isCurrent && url) {
        dispatch({ type: "deepLinkOpened", url });
      }
    });

    const unsubscribe = nativeLinkBoundary.subscribe((url) => {
      dispatch({ type: "deepLinkOpened", url });
    });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [nativeLinkBoundary]);

  useEffect(() => {
    if (routerState.auth !== "linkedApple" || !routerState.pendingDeepLinkUrl) {
      return;
    }

    let isCurrent = true;
    const url = routerState.pendingDeepLinkUrl;

    inviteBoundary
      .resolveInviteLink(url)
      .then((resolution) => {
        if (isCurrent) {
          const roomId = routedInviteRoomId(resolution);

          if (roomId) {
            setQuizSession(groupQuizSession(roomId, "joiner"));
          }

          dispatch({ type: "deepLinkResolved", resolution });
        }
      })
      .catch(() => {
        if (isCurrent) {
          dispatch({
            type: "deepLinkResolved",
            resolution: { kind: "invalid", reason: "malformed-url" },
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [inviteBoundary, routerState.auth, routerState.pendingDeepLinkUrl]);

  return (
    <MobileAppShell
      authBoundary={authBoundary}
      onCreatePlan={(participantScope) => {
        setPlanListNotice(null);
        setSetupPlan(defaultSetupPlan(participantScope));
        dispatch({ type: "openSetup" });
      }}
      onOpenPlan={(plan) => {
        setPlanListNotice(null);
        switch (plan.routeTarget) {
          case "pending":
            setSetupPlan(editSetupPlan(plan));
            dispatch({ type: "openSetup" });
            break;
          case "joined":
            setQuizSession(groupQuizSession(roomIdForPlanRoute(plan), "joiner"));
            dispatch({ type: "startQuiz" });
            break;
          case "decided":
            setQuizSession(groupQuizSession(roomIdForPlanRoute(plan), "initiator"));
            dispatch({ type: "showVerdict" });
            break;
          case "history":
            setQuizSession(groupQuizSession(roomIdForPlanRoute(plan), "initiator"));
            dispatch({ type: "showReadOnlyVerdict" });
            break;
        }
      }}
      onLaunchSetup={async (plan) => {
        const launchedPlan = await planRepository.launchPlan(plan);
        setQuizSession({
          roomId: launchedPlan.roomId,
          participantScope: plan.participantScope,
          role: "initiator",
        });

        if (plan.participantScope === "solo") {
          dispatch({ type: "startQuiz" });
          return;
        }

        const inviteUrl =
          await inviteBoundary.createGroupInviteLink(launchedPlan);
        await inviteBoundary.shareInviteLink(inviteUrl);
        dispatch({ type: "waitForVerdict" });
      }}
      planRepository={planRepository}
      planListNotice={planListNotice}
      q5CandidateRepository={q5CandidateRepository}
      quizProgressRepository={quizProgressRepository}
      quizSubmissionRepository={quizSubmissionRepository}
      routerState={routerState}
      quizSession={quizSession}
      setupPlan={setupPlan}
      verdictRepository={verdictRepository}
      waitingRepository={waitingRepository}
      onAppleSignInSucceeded={() =>
        dispatch({ type: "appleSignInSucceeded" })
      }
      onAccountDeleted={() => dispatch({ type: "authSignedOut" })}
      onClaimCodeRedeemed={() => dispatch({ type: "claimCodeRedeemed" })}
      onCloseSettings={() => dispatch({ type: "closeSettings" })}
      onOpenSettings={() => dispatch({ type: "openSettings" })}
      onPlanDeleted={() => setPlanListNotice("Plan deleted.")}
      onQuizExited={() => dispatch({ type: "returnToPlans" })}
      onQuizSubmitted={() =>
        dispatch({
          type: routeAfterQuizSubmission(quizSession.participantScope),
        })
      }
      onSessionEnded={() => {
        setPlanListNotice("Session ended. Back to Plans.");
        dispatch({ type: "returnToPlans" });
      }}
      onVerdictReady={() => dispatch({ type: "showVerdict" })}
      onSaveSetup={async (plan) => {
        await planRepository.savePlan(plan);
        dispatch({ type: "returnToPlans" });
      }}
      onSignedOut={() => dispatch({ type: "authSignedOut" })}
    />
  );
}

export function MobileAppShell({
  authBoundary = defaultAuthBoundary,
  onCreatePlan,
  onLaunchSetup,
  onAccountDeleted,
  onAppleSignInSucceeded,
  onClaimCodeRedeemed,
  onCloseSettings,
  onOpenSettings,
  onOpenPlan,
  onPlanDeleted,
  onQuizExited,
  onQuizSubmitted,
  onSaveSetup,
  onSessionEnded,
  onSignedOut,
  onVerdictReady,
  planRepository = unconfiguredPlanRepository,
  planListNotice = null,
  q5CandidateRepository = nativeQ5CandidateRepository,
  quizProgressRepository = unconfiguredQuizProgressRepository,
  quizSubmissionRepository = unconfiguredQuizSubmissionRepository,
  routerState,
  quizSession = {
    roomId: "active-room",
    participantScope: "group",
    role: "initiator",
  },
  setupPlan = defaultSetupPlan("group"),
  verdictRepository = unconfiguredVerdictRepository,
  waitingRepository = unconfiguredWaitingRepository,
}: MobileAppShellProps) {
  const route = routeForAppState(routerState);
  const [planListLoad, setPlanListLoad] = useState<PlanListLoadState>({
    requestKey: null,
    snapshot: emptyPlanListSnapshot,
    status: "idle",
  });
  const [verdictLoad, setVerdictLoad] = useState<VerdictLoadState>({
    requestKey: null,
    verdict: null,
    failed: false,
  });
  const [verdictLoadAttempt, setVerdictLoadAttempt] = useState(0);
  const [deletedCreatedPlanIds, setDeletedCreatedPlanIds] = useState<
    Set<string>
  >(
    () => new Set(),
  );
  const verdictFlavor: VerdictFlavor =
    quizSession.participantScope === "solo" ? "solo" : "group";
  const planListRequestKey = deletedPlanIdsKey(deletedCreatedPlanIds);
  const planSnapshot =
    planListLoad.requestKey === planListRequestKey
      ? planListLoad.snapshot
      : emptyPlanListSnapshot;
  const planListStatus: PlanListStatus =
    route.name === "planList" && planListLoad.requestKey !== planListRequestKey
      ? "loading"
      : planListLoad.status;
  const verdictRequestKey =
    route.name === "verdict" || route.name === "readOnlyVerdict"
      ? `${route.name}:${quizSession.roomId}:${verdictFlavor}:${verdictLoadAttempt}`
      : null;
  const verdict =
    verdictLoad.requestKey === verdictRequestKey ? verdictLoad.verdict : null;
  const verdictLoadFailed =
    verdictLoad.requestKey === verdictRequestKey && verdictLoad.failed;

  const handleDeletePlan = async (plan: PlanListItem) => {
    await planRepository.deletePlan({ planId: plan.id });
    const nextDeletedCreatedPlanIds = new Set(deletedCreatedPlanIds).add(
      plan.id,
    );

    setDeletedCreatedPlanIds(nextDeletedCreatedPlanIds);
    setPlanListLoad({
      requestKey: deletedPlanIdsKey(nextDeletedCreatedPlanIds),
      snapshot: filterDeletedCreatedPlans(
        await planRepository.listPlans(),
        nextDeletedCreatedPlanIds,
      ),
      status: "loaded",
    });
    onPlanDeleted?.();
  };

  useEffect(() => {
    if (route.name !== "planList") {
      return;
    }

    let isCurrent = true;
    const requestKey = planListRequestKey;

    planRepository
      .listPlans()
      .then((snapshot) => {
        if (!isCurrent) {
          return;
        }

        setPlanListLoad({
          requestKey,
          snapshot: filterDeletedCreatedPlans(snapshot, deletedCreatedPlanIds),
          status: "loaded",
        });
      })
      .catch(() => {
        if (isCurrent) {
          setPlanListLoad((current) => ({
            ...current,
            requestKey,
            status: "error",
          }));
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [deletedCreatedPlanIds, planListRequestKey, planRepository, route.name]);

  useEffect(() => {
    if (!verdictRequestKey) {
      return;
    }

    let isCurrent = true;
    const requestKey = verdictRequestKey;

    const verdictRequest =
      route.name === "readOnlyVerdict"
        ? verdictRepository.loadHistoryVerdict({
            roomId: quizSession.roomId,
            flavor: verdictFlavor,
          })
        : verdictRepository.loadVerdict({
            roomId: quizSession.roomId,
            flavor: verdictFlavor,
          });

    verdictRequest
      .then((nextVerdict) => {
        if (isCurrent) {
          setVerdictLoad({
            requestKey,
            verdict: nextVerdict,
            failed: false,
          });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setVerdictLoad({
            requestKey,
            verdict: null,
            failed: true,
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [
    route.name,
    quizSession.roomId,
    verdictRepository,
    verdictFlavor,
    verdictRequestKey,
  ]);

  if (route.name === "setup") {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SetupScreen
          initialPlan={setupPlan}
          mode={setupPlan.id ? "edit" : "create"}
          onLaunch={onLaunchSetup ?? (async () => undefined)}
          onSave={onSaveSetup ?? (async () => undefined)}
        />
      </View>
    );
  }

  if (route.name === "settings") {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SettingsScreen
          authBoundary={authBoundary}
          onAccountDeleted={onAccountDeleted}
          onClose={onCloseSettings}
          onSignedOut={onSignedOut}
        />
      </View>
    );
  }

  if (route.name === "quiz") {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <QuizScreen
          onExited={onQuizExited ?? (() => undefined)}
          onSubmitted={onQuizSubmitted}
          participantRole={quizSession.role}
          progressRepository={quizProgressRepository}
          q5CandidateRepository={q5CandidateRepository}
          roomId={quizSession.roomId}
          submissionRepository={quizSubmissionRepository}
        />
      </View>
    );
  }

  if (route.name === "waiting") {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <WaitingScreen
          isInitiator={quizSession.role === "initiator"}
          onSessionEnded={onSessionEnded ?? (() => undefined)}
          onVerdictReady={onVerdictReady ?? (() => undefined)}
          repository={waitingRepository}
          roomId={quizSession.roomId}
        />
      </View>
    );
  }

  if (route.name === "verdict" || route.name === "readOnlyVerdict") {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <VerdictRouteContent
          failed={verdictLoadFailed}
          mode={route.name === "readOnlyVerdict" ? "readOnly" : "live"}
          onPrimaryAction={onQuizExited ?? (() => undefined)}
          onReroll={verdictRepository.reroll}
          onRetry={() => setVerdictLoadAttempt((attempt) => attempt + 1)}
          verdict={verdict}
        />
      </View>
    );
  }

  const content = contentByRouteName[route.name];

  if (route.name === "signInGate") {
    return (
      <SignInGate
        authBoundary={authBoundary}
        onAppleSignInSucceeded={onAppleSignInSucceeded}
        onClaimCodeRedeemed={onClaimCodeRedeemed}
      />
    );
  }

  if (route.name === "planList") {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <PlanListContent
          notice={planListNotice}
          onCreatePlan={onCreatePlan}
          onDeletePlan={handleDeletePlan}
          onOpenPlan={onOpenPlan}
          onOpenSettings={onOpenSettings}
          plans={planSnapshot}
          status={planListStatus}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.surface}>
        <Text style={styles.eyebrow}>Mobile router</Text>
        <Text style={styles.title}>GetToIt</Text>
        <Text style={styles.routeTitle}>{content.title}</Text>
        <Text style={styles.subtitle}>{content.body}</Text>
      </View>
    </View>
  );
}

type VerdictRouteContentProps = {
  failed: boolean;
  mode: "live" | "readOnly";
  onPrimaryAction: () => void;
  onReroll: (input: RerollInput) => Promise<void>;
  onRetry: () => void;
  verdict: VerdictViewModel | null;
};

function VerdictRouteContent({
  failed,
  mode,
  onPrimaryAction,
  onReroll,
  onRetry,
  verdict,
}: VerdictRouteContentProps) {
  if (verdict) {
    return (
      <VerdictScreen
        mode={mode}
        onPrimaryAction={onPrimaryAction}
        onReroll={onReroll}
        verdict={verdict}
      />
    );
  }

  if (failed) {
    return (
      <View style={styles.surface}>
        <Text style={styles.routeTitle}>Verdict unavailable</Text>
        <Text style={styles.subtitle}>Try again in a moment.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.surface}>
      <Text style={styles.routeTitle}>Loading verdict</Text>
      <Text style={styles.subtitle}>Pulling the recommendation.</Text>
    </View>
  );
}

function PlanListContent({
  notice,
  onDeletePlan,
  onCreatePlan,
  onOpenPlan,
  onOpenSettings,
  plans,
  status,
}: PlanListContentProps) {
  switch (status) {
    case "loaded":
      return (
        <PlanListScreen
          notice={notice}
          onCreatePlan={onCreatePlan}
          onDeletePlan={onDeletePlan}
          onOpenPlan={onOpenPlan}
          onOpenSettings={onOpenSettings}
          plans={plans}
        />
      );
    case "error":
      return (
        <View style={styles.surface}>
          <Text style={styles.routeTitle}>Plans unavailable</Text>
          <Text style={styles.subtitle}>Try again in a moment.</Text>
        </View>
      );
    case "idle":
    case "loading":
      return (
        <View style={styles.surface}>
          <Text style={styles.routeTitle}>Plans</Text>
          <Text style={styles.subtitle}>Loading Plans.</Text>
        </View>
      );
  }
}

type SettingsScreenProps = {
  authBoundary: AuthBoundary;
  onAccountDeleted?: () => void;
  onClose?: () => void;
  onSignedOut?: () => void;
};

function SettingsScreen({
  authBoundary,
  onAccountDeleted,
  onClose,
  onSignedOut,
}: SettingsScreenProps) {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [actionFailed, setActionFailed] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDeleteConfirm = async () => {
    setActionFailed(null);
    setIsSubmitting(true);

    try {
      await authBoundary.deleteCurrentAccount();
      onAccountDeleted?.();
    } catch {
      setActionFailed("Delete failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setActionFailed(null);
    setIsSubmitting(true);

    try {
      await authBoundary.signOut();
      onSignedOut?.();
    } catch {
      setActionFailed("Sign out failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.surface}>
      <Pressable
        accessibilityLabel="Close Settings"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.closeButton}
      >
        <Text style={styles.closeButtonLabel}>X</Text>
      </Pressable>
      <Text style={styles.eyebrow}>Your account</Text>
      <Text style={styles.title}>Just one thing here for now.</Text>
      <Text style={styles.subtitle}>
        Deletes everything: your sessions, your votes, your taste profile.
        Rooms you joined keep going - your spot in them clears. Can't be
        undone.
      </Text>
      {actionFailed ? (
        <Text accessibilityRole="alert" style={styles.inlineError}>
          {actionFailed}
        </Text>
      ) : null}
      {isDeleteConfirmOpen ? (
        <View style={styles.confirmCard}>
          <Text style={styles.routeTitle}>Delete your data?</Text>
          <Text style={styles.subtitle}>This can't be undone.</Text>
          <Pressable
            accessibilityLabel="Confirm delete account"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleDeleteConfirm}
            style={[styles.secondaryButton, isSubmitting && styles.disabledButton]}
          >
            <Text style={styles.secondaryButtonLabel}>Delete forever</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => setIsDeleteConfirmOpen(false)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => setIsDeleteConfirmOpen(true)}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonLabel}>Delete my data</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={handleSignOut}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonLabel}>Sign out</Text>
      </Pressable>
    </View>
  );
}

type SignInGateProps = {
  authBoundary: AuthBoundary;
  onAppleSignInSucceeded?: () => void;
  onClaimCodeRedeemed?: () => void;
};

type SignInGateState = {
  appleSignInFailed: boolean;
  claimCode: string;
  claimRedeemFailed: boolean;
  claimRedeemed: boolean;
  devEmail: string;
  devPassword: string;
  devSignInFailed: boolean;
  isClaimPanelOpen: boolean;
  isSubmitting: boolean;
};

const initialSignInGateState: SignInGateState = {
  appleSignInFailed: false,
  claimCode: "",
  claimRedeemFailed: false,
  claimRedeemed: false,
  devEmail: "",
  devPassword: "",
  devSignInFailed: false,
  isClaimPanelOpen: false,
  isSubmitting: false,
};

function signInGateReducer(
  state: SignInGateState,
  patch: Partial<SignInGateState>,
): SignInGateState {
  return { ...state, ...patch };
}

function SignInGate({
  authBoundary,
  onAppleSignInSucceeded,
  onClaimCodeRedeemed,
}: SignInGateProps) {
  const [signInState, updateSignInState] = useReducer(
    signInGateReducer,
    initialSignInGateState,
  );
  const {
    appleSignInFailed,
    claimCode,
    claimRedeemFailed,
    claimRedeemed,
    devEmail,
    devPassword,
    devSignInFailed,
    isClaimPanelOpen,
    isSubmitting,
  } = signInState;
  const trimmedClaimCode = claimCode.trim();
  const trimmedDevEmail = devEmail.trim();
  const isClaimRedeemDisabled = !trimmedClaimCode || isSubmitting;
  const isDevSignInDisabled =
    !trimmedDevEmail || !devPassword || isSubmitting;
  const canUseWebDevLogin =
    isWebDevLoginEnabled() && Boolean(authBoundary.signInWithDevPassword);
  const heroIntro = useSharedValue(0);
  const actionIntro = useSharedValue(0);

  useEffect(() => {
    heroIntro.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
    actionIntro.value = withDelay(
      90,
      withTiming(1, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [actionIntro, heroIntro]);
  const heroIntroStyle = useAnimatedStyle(() => ({
    opacity: heroIntro.value,
    transform: [{ translateY: 18 * (1 - heroIntro.value) }],
  }));
  const actionIntroStyle = useAnimatedStyle(() => ({
    opacity: actionIntro.value,
    transform: [{ translateY: 12 * (1 - actionIntro.value) }],
  }));

  const handleAppleSignInPress = async () => {
    updateSignInState({ appleSignInFailed: false, isSubmitting: true });

    try {
      await authBoundary.signInWithApple();
      onAppleSignInSucceeded?.();
    } catch {
      updateSignInState({ appleSignInFailed: true });
    } finally {
      updateSignInState({ isSubmitting: false });
    }
  };

  const handleClaimCodeRedeemPress = async () => {
    if (!trimmedClaimCode) {
      return;
    }

    updateSignInState({ claimRedeemFailed: false, isSubmitting: true });

    try {
      await authBoundary.redeemClaimCode(trimmedClaimCode);
      updateSignInState({ claimRedeemed: true });
      onClaimCodeRedeemed?.();
    } catch {
      updateSignInState({ claimRedeemFailed: true });
    } finally {
      updateSignInState({ isSubmitting: false });
    }
  };

  const handleDevSignInPress = async () => {
    if (
      !authBoundary.signInWithDevPassword ||
      !trimmedDevEmail ||
      !devPassword
    ) {
      return;
    }

    updateSignInState({ devSignInFailed: false, isSubmitting: true });

    try {
      await authBoundary.signInWithDevPassword({
        email: trimmedDevEmail,
        password: devPassword,
      });
      onAppleSignInSucceeded?.();
    } catch {
      updateSignInState({ devSignInFailed: true });
    } finally {
      updateSignInState({ isSubmitting: false });
    }
  };

  return (
    <View style={styles.signInRoot}>
      <StatusBar style="light" />
      <VerdictBackdrop />
      <View style={styles.signInSurface}>
        <View style={styles.signInTopSpace} />
        <Animated.View
          style={[
            styles.signInHero,
            heroIntroStyle,
          ]}
        >
          <View accessibilityLabel="GetToIt logo" style={styles.logoMark}>
            <Text style={styles.logoMarkText}>G</Text>
          </View>
          <Text style={styles.signInTitle}>
            Decide Dinner.{"\n"}Get To It.
          </Text>
          <Text style={styles.signInSubtitle}>
            Save your taste profile and turn group indecision into a locked pick.
          </Text>
        </Animated.View>
        <Animated.View style={actionIntroStyle}>
          {appleSignInFailed ? (
            <Text style={styles.signInInlineError}>
              Couldn't reach Apple. Try again.
            </Text>
          ) : null}
          {claimRedeemed ? (
            <Text style={styles.signInInlineSuccess}>
              Web Plans ready. Sign in with Apple to finish.
            </Text>
          ) : null}
          <Pressable
            accessibilityLabel="Sign in with Apple"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleAppleSignInPress}
            style={[
              styles.appleSignInButton,
              isSubmitting && styles.disabledButton,
            ]}
          >
            <Text style={styles.appleSignInLabel}>Continue with Apple</Text>
          </Pressable>
          {canUseWebDevLogin ? (
            <View style={styles.devLoginPanel}>
              <TextInput
                accessibilityLabel="Dev login email"
                autoCapitalize="none"
                autoCorrect={false}
                inputMode="email"
                onChangeText={(devEmail) => updateSignInState({ devEmail })}
                placeholder="Dev email"
                placeholderTextColor={mobileTokens.color.textTertiaryOnGradient}
                style={styles.claimInput}
                textContentType="username"
                value={devEmail}
              />
              <TextInput
                accessibilityLabel="Dev login password"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(devPassword) =>
                  updateSignInState({ devPassword })
                }
                placeholder="Dev password"
                placeholderTextColor={mobileTokens.color.textTertiaryOnGradient}
                secureTextEntry
                style={styles.claimInput}
                textContentType="password"
                value={devPassword}
              />
              {devSignInFailed ? (
                <Text accessibilityRole="alert" style={styles.inlineError}>
                  Dev login failed. Check email and password.
                </Text>
              ) : null}
              <Pressable
                accessibilityLabel="Sign in for web testing"
                accessibilityRole="button"
                disabled={isDevSignInDisabled}
                onPress={handleDevSignInPress}
                style={[
                  styles.secondaryButton,
                  isDevSignInDisabled && styles.disabledButton,
                ]}
              >
                <Text style={styles.secondaryButtonLabel}>
                  Sign in for web testing
                </Text>
              </Pressable>
            </View>
          ) : null}
          {isClaimPanelOpen ? (
            <View style={styles.claimPanel}>
              <Text style={styles.claimTeaching}>
                Bring back your recent web Plans. Open any link you voted on, tap
                Getting the app?, and enter the code here.
              </Text>
              <TextInput
                accessibilityLabel="Claim code"
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={(claimCode) =>
                  updateSignInState({ claimCode })
                }
                placeholder="Enter your code"
                placeholderTextColor={mobileTokens.color.textTertiaryOnGradient}
                style={styles.claimInput}
                value={claimCode}
              />
              {claimRedeemFailed ? (
                <Text accessibilityRole="alert" style={styles.inlineError}>
                  That code didn't work. Generate a fresh one from your web link.
                </Text>
              ) : null}
              <Pressable
                accessibilityLabel="Bring my Plans over"
                accessibilityRole="button"
                disabled={isClaimRedeemDisabled}
                onPress={handleClaimCodeRedeemPress}
                style={[
                  styles.primaryButton,
                  isClaimRedeemDisabled && styles.disabledButton,
                ]}
              >
                <Text style={styles.primaryButtonLabel}>Bring my Plans over</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityLabel="Voted on the web?"
              accessibilityRole="button"
              onPress={() => updateSignInState({ isClaimPanelOpen: true })}
              style={styles.signInWebButton}
            >
              <Text style={styles.signInWebButtonLabel}>Voted on the Web?</Text>
            </Pressable>
          )}
        </Animated.View>
        <View style={styles.homeIndicator} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileTokens.color.ink,
  },
  signInRoot: {
    flex: 1,
    backgroundColor: mobileTokens.color.ink,
    overflow: "hidden",
  },
  signInSurface: {
    flex: 1,
    justifyContent: "flex-end",
    padding: mobileTokens.spacing[5],
    paddingBottom: mobileTokens.spacing[4],
  },
  signInTopSpace: {
    flex: 1,
    minHeight: 80,
  },
  signInHero: {
    alignItems: "center",
    marginBottom: mobileTokens.spacing[8],
  },
  logoMark: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassTop,
    borderRadius: mobileTokens.radius.lg,
    borderWidth: 1,
    height: 68,
    justifyContent: "center",
    marginBottom: mobileTokens.spacing[4],
    width: 68,
  },
  logoMarkText: {
    color: mobileTokens.color.sun,
    fontFamily: mobileTokens.typography.family.display,
    fontSize: 32,
    fontWeight: "700",
  },
  signInTitle: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.display,
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 40,
    marginBottom: mobileTokens.spacing[4],
    textAlign: "center",
  },
  signInSubtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  appleSignInButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.sun,
    borderRadius: mobileTokens.radius.md,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: mobileTokens.spacing[4],
  },
  appleSignInLabel: {
    color: mobileTokens.color.ink,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: 17,
    fontWeight: "700",
  },
  signInWebButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    marginTop: mobileTokens.spacing[3],
  },
  signInWebButtonLabel: {
    color: mobileTokens.color.copper,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  devLoginPanel: {
    gap: mobileTokens.spacing[3],
    marginTop: mobileTokens.spacing[3],
  },
  signInInlineError: {
    color: mobileTokens.color.danger,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: mobileTokens.spacing[3],
    textAlign: "center",
  },
  signInInlineSuccess: {
    color: mobileTokens.color.sun,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: mobileTokens.spacing[3],
    textAlign: "center",
  },
  homeIndicator: {
    alignSelf: "center",
    backgroundColor: mobileTokens.color.glassTop,
    borderRadius: mobileTokens.radius.full,
    height: 5,
    marginTop: mobileTokens.spacing[4],
    width: 134,
  },
  surface: {
    backgroundColor: mobileTokens.color.ink,
    flex: 1,
    justifyContent: "center",
    padding: mobileTokens.spacing[8],
  },
  eyebrow: {
    color: mobileTokens.color.sun,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 0,
    marginBottom: mobileTokens.spacing[3],
    textTransform: "uppercase",
  },
  title: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.display,
    fontSize: mobileTokens.typography.display.size,
    fontWeight: mobileTokens.typography.display.weight,
    lineHeight: mobileTokens.typography.display.lineHeight,
    marginBottom: mobileTokens.spacing[4],
  },
  routeTitle: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.title.size,
    fontWeight: "700",
    lineHeight: mobileTokens.typography.title.lineHeight,
    marginBottom: mobileTokens.spacing[3],
  },
  subtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: mobileTokens.typography.body.weight,
    lineHeight: mobileTokens.typography.body.lineHeight,
    marginBottom: mobileTokens.spacing[4],
  },
  claimPanel: {
    gap: mobileTokens.spacing[3],
    marginBottom: mobileTokens.spacing[3],
    marginTop: mobileTokens.spacing[3],
  },
  claimTeaching: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: mobileTokens.typography.body.weight,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  claimInput: {
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "600",
    minHeight: 56,
    paddingHorizontal: mobileTokens.spacing[4],
  },
  closeButton: {
    alignItems: "center",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    marginBottom: mobileTokens.spacing[8],
    width: 44,
  },
  closeButtonLabel: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: 16,
    fontWeight: "800",
  },
  confirmCard: {
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.lg,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    marginBottom: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.sun,
    borderRadius: mobileTokens.radius.md,
    minHeight: 56,
    justifyContent: "center",
    marginTop: mobileTokens.spacing[3],
    paddingHorizontal: mobileTokens.spacing[4],
  },
  primaryButtonLabel: {
    color: mobileTokens.color.ink,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: mobileTokens.color.copper,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: "center",
    marginBottom: mobileTokens.spacing[3],
    paddingHorizontal: mobileTokens.spacing[4],
  },
  secondaryButtonLabel: {
    color: mobileTokens.color.copper,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  disabledButton: {
    opacity: 0.45,
  },
  inlineError: {
    color: mobileTokens.color.danger,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: mobileTokens.spacing[3],
  },
  inlineSuccess: {
    color: mobileTokens.color.sun,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: mobileTokens.spacing[3],
  },
});
