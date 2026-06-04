import { StatusBar } from "expo-status-bar";
import { useEffect, useReducer, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { mobileTokens } from "./src/design/tokens";
import {
  createGroupInviteUrl,
  resolveInviteLink,
  type InviteRouteResolution,
} from "./src/invites/inviteLinks";
import type {
  AppRouteName,
  AppStateRouterState,
} from "./src/navigation/appStateRouter";
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
} from "./src/plans/planRepository";
import {
  emptyPlanListSnapshot,
  fakePlanRepository,
} from "./src/plans/planRepository";
import { PlanListScreen } from "./src/plans/PlanListScreen";
import { SetupScreen } from "./src/plans/SetupScreen";
import { QuizScreen } from "./src/quiz/QuizScreen";
import type { Q5CandidateRepository } from "./src/quiz/q5CandidateRepository";
import { fakeQ5CandidateRepository } from "./src/quiz/q5CandidateRepository";
import type { QuizProgressRepository } from "./src/quiz/quizProgressRepository";
import { fakeQuizProgressRepository } from "./src/quiz/quizProgressRepository";
import type { QuizSubmissionRepository } from "./src/quiz/quizSubmissionRepository";
import { fakeQuizSubmissionRepository } from "./src/quiz/quizSubmissionRepository";
import { VerdictScreen } from "./src/verdict/VerdictScreen";
import type {
  VerdictFlavor,
  VerdictRepository,
  VerdictViewModel,
} from "./src/verdict/verdictRepository";
import { fakeVerdictRepository } from "./src/verdict/verdictRepository";
import { WaitingScreen } from "./src/waiting/WaitingScreen";
import type { WaitingRepository } from "./src/waiting/waitingRepository";
import { fakeWaitingRepository } from "./src/waiting/waitingRepository";

type AuthBoundary = {
  deleteCurrentAccount: () => Promise<unknown>;
  signInWithApple: () => Promise<unknown>;
  redeemClaimCode: (code: string) => Promise<unknown>;
  signOut: () => Promise<unknown>;
};

type SavedPlanSetup = PlanSetup & { id: string };

type InviteBoundary = {
  createGroupInviteLink: (plan: SavedPlanSetup) => Promise<string>;
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
    title: "Join placeholder",
    body: "Join this group Plan.",
  },
  setup: {
    title: "Setup placeholder",
    body: "Plan setup starts here.",
  },
  quiz: {
    title: "Quiz placeholder",
    body: "Answer Plan questions here.",
  },
  waiting: {
    title: "Waiting placeholder",
    body: "Waiting for the group verdict.",
  },
  verdict: {
    title: "Verdict placeholder",
    body: "The Plan verdict appears here.",
  },
  readOnlyVerdict: {
    title: "Read-only verdict placeholder",
    body: "The closed Plan verdict appears here.",
  },
  settings: {
    title: "Settings placeholder",
    body: "Account settings live here.",
  },
  deepLink: {
    title: "Deep-link placeholder",
    body: "Resolving invite link.",
  },
};

const defaultAuthBoundary: AuthBoundary = {
  deleteCurrentAccount: async () => undefined,
  signInWithApple: async () => undefined,
  redeemClaimCode: async () => undefined,
  signOut: async () => undefined,
};

const defaultInviteBoundary: InviteBoundary = {
  createGroupInviteLink: async (plan) =>
    createGroupInviteUrl({
      baseUrl: "https://gettoit.example",
      roomId: plan.id,
    }),
  resolveInviteLink: async (url) =>
    resolveInviteLink(url, async (roomId) => {
      if (roomId.startsWith("quiz")) {
        return { kind: "inProgress", roomId };
      }

      if (roomId.startsWith("waiting")) {
        return { kind: "waiting", roomId };
      }

      if (roomId.startsWith("decided")) {
        return { kind: "decided", roomId };
      }

      if (roomId.startsWith("stale")) {
        return { kind: "stale", roomId };
      }

      return { kind: "open", roomId };
    }),
  shareInviteLink: async () => undefined,
};

const defaultNativeLinkBoundary: NativeLinkBoundary = {
  getInitialUrl: async () => null,
  subscribe: () => () => undefined,
};

function defaultSetupPlan(participantScope: PlanParticipantScope): PlanSetup {
  return {
    name: "",
    participantScope,
    searchArea: null,
    mealTime: "dinner",
    serviceShape: "dineIn",
  };
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
  authBoundary = defaultAuthBoundary,
  initialRouterState,
  inviteBoundary = defaultInviteBoundary,
  nativeLinkBoundary = defaultNativeLinkBoundary,
  planRepository = fakePlanRepository,
  q5CandidateRepository = fakeQ5CandidateRepository,
  quizProgressRepository = fakeQuizProgressRepository,
  quizSubmissionRepository = fakeQuizSubmissionRepository,
  verdictRepository = fakeVerdictRepository,
  waitingRepository = fakeWaitingRepository,
}: AppProps = {}) {
  const [routerState, dispatch] = useReducer(
    appStateRouterReducer,
    initialRouterState ?? initialAppStateRouterState,
  );
  const [setupPlan, setSetupPlan] = useState<PlanSetup>(
    defaultSetupPlan("group"),
  );
  const [quizSession, setQuizSession] = useState<QuizSession>({
    roomId: "active-room",
    participantScope: "group",
    role: "initiator",
  });
  const [planListNotice, setPlanListNotice] = useState<string | null>(null);

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
            setQuizSession(groupQuizSession(plan.id, "joiner"));
            dispatch({ type: "startQuiz" });
            break;
          case "decided":
            setQuizSession(groupQuizSession(plan.id, "initiator"));
            dispatch({ type: "showVerdict" });
            break;
          case "history":
            setQuizSession(groupQuizSession(plan.id, "initiator"));
            dispatch({ type: "showReadOnlyVerdict" });
            break;
        }
      }}
      onLaunchSetup={async (plan) => {
        const savedPlan = await planRepository.savePlan(plan);
        setQuizSession({
          roomId: savedPlan.id,
          participantScope: plan.participantScope,
          role: "initiator",
        });

        if (plan.participantScope === "solo") {
          dispatch({ type: "startQuiz" });
          return;
        }

        const inviteUrl =
          await inviteBoundary.createGroupInviteLink(savedPlan);
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
  planRepository = fakePlanRepository,
  planListNotice = null,
  q5CandidateRepository = fakeQ5CandidateRepository,
  quizProgressRepository = fakeQuizProgressRepository,
  quizSubmissionRepository = fakeQuizSubmissionRepository,
  routerState,
  quizSession = {
    roomId: "active-room",
    participantScope: "group",
    role: "initiator",
  },
  setupPlan = defaultSetupPlan("group"),
  verdictRepository = fakeVerdictRepository,
  waitingRepository = fakeWaitingRepository,
}: MobileAppShellProps) {
  const route = routeForAppState(routerState);
  const [planSnapshot, setPlanSnapshot] = useState<PlanListSnapshot>(
    emptyPlanListSnapshot,
  );
  const [planListStatus, setPlanListStatus] =
    useState<PlanListStatus>("idle");
  const [verdict, setVerdict] = useState<VerdictViewModel | null>(null);
  const verdictFlavor: VerdictFlavor =
    quizSession.participantScope === "solo" ? "solo" : "group";
  const [deletedCreatedPlanIds, setDeletedCreatedPlanIds] = useState<
    Set<string>
  >(
    () => new Set(),
  );

  const handleDeletePlan = async (plan: PlanListItem) => {
    await planRepository.deletePlan({ planId: plan.id });
    const nextDeletedCreatedPlanIds = new Set(deletedCreatedPlanIds).add(
      plan.id,
    );

    setDeletedCreatedPlanIds(nextDeletedCreatedPlanIds);
    setPlanSnapshot(
      filterDeletedCreatedPlans(
        await planRepository.listPlans(),
        nextDeletedCreatedPlanIds,
      ),
    );
    onPlanDeleted?.();
  };

  useEffect(() => {
    if (route.name !== "planList") {
      return;
    }

    let isCurrent = true;
    setPlanListStatus("loading");

    planRepository
      .listPlans()
      .then((snapshot) => {
        if (!isCurrent) {
          return;
        }

        setPlanSnapshot(
          filterDeletedCreatedPlans(snapshot, deletedCreatedPlanIds),
        );
        setPlanListStatus("loaded");
      })
      .catch(() => {
        if (isCurrent) {
          setPlanListStatus("error");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [deletedCreatedPlanIds, planRepository, route.name]);

  useEffect(() => {
    if (route.name !== "verdict" && route.name !== "readOnlyVerdict") {
      return;
    }

    let isCurrent = true;
    setVerdict(null);

    verdictRepository
      .loadVerdict({
        roomId: quizSession.roomId,
        flavor: verdictFlavor,
      })
      .then((nextVerdict) => {
        if (isCurrent) {
          setVerdict(nextVerdict);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [quizSession.roomId, route.name, verdictFlavor, verdictRepository]);

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
          progressRepository={quizProgressRepository}
          q5CandidateRepository={q5CandidateRepository}
          role={quizSession.role}
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
        {verdict ? (
          <VerdictScreen
            mode={route.name === "readOnlyVerdict" ? "readOnly" : "live"}
            onReroll={verdictRepository.reroll}
            onWidenAndRerun={verdictRepository.widenAndRerun}
            verdict={verdict}
          />
        ) : (
          <View style={styles.surface}>
            <Text style={styles.routeTitle}>Loading verdict</Text>
            <Text style={styles.subtitle}>Pulling the recommendation.</Text>
          </View>
        )}
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

function SignInGate({
  authBoundary,
  onAppleSignInSucceeded,
  onClaimCodeRedeemed,
}: SignInGateProps) {
  const [claimCode, setClaimCode] = useState("");
  const [claimRedeemFailed, setClaimRedeemFailed] = useState(false);
  const [isClaimPanelOpen, setIsClaimPanelOpen] = useState(false);
  const [claimRedeemed, setClaimRedeemed] = useState(false);
  const [appleSignInFailed, setAppleSignInFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trimmedClaimCode = claimCode.trim();
  const isClaimRedeemDisabled = !trimmedClaimCode || isSubmitting;

  const handleAppleSignInPress = async () => {
    setAppleSignInFailed(false);
    setIsSubmitting(true);

    try {
      await authBoundary.signInWithApple();
      onAppleSignInSucceeded?.();
    } catch {
      setAppleSignInFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimCodeRedeemPress = async () => {
    if (!trimmedClaimCode) {
      return;
    }

    setClaimRedeemFailed(false);
    setIsSubmitting(true);

    try {
      await authBoundary.redeemClaimCode(trimmedClaimCode);
      setClaimRedeemed(true);
      onClaimCodeRedeemed?.();
    } catch {
      setClaimRedeemFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.surface}>
        <Text style={styles.eyebrow}>Tonight's session</Text>
        <Text style={styles.title}>Pick up where you left off</Text>
        <Text style={styles.subtitle}>
          Sign in once and your taste profile saves itself.
        </Text>
        {appleSignInFailed ? (
          <Text style={styles.inlineError}>Couldn't reach Apple. Try again.</Text>
        ) : null}
        {claimRedeemed ? (
          <Text style={styles.inlineSuccess}>
            Web Plans ready. Sign in with Apple to finish.
          </Text>
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
              onChangeText={setClaimCode}
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
            onPress={() => setIsClaimPanelOpen(true)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>Voted on the web?</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityLabel="Sign in with Apple"
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleAppleSignInPress}
          style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonLabel}>Save my taste profile</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileTokens.color.ink,
  },
  surface: {
    flex: 1,
    justifyContent: "center",
    padding: mobileTokens.spacing[8],
    backgroundColor: mobileTokens.color.ink,
  },
  eyebrow: {
    color: mobileTokens.color.sun,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 1.5,
    marginBottom: mobileTokens.spacing[3],
    textTransform: "uppercase",
  },
  title: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.display.size,
    fontWeight: mobileTokens.typography.display.weight,
    lineHeight: mobileTokens.typography.display.lineHeight,
    marginBottom: mobileTokens.spacing[4],
  },
  routeTitle: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    lineHeight: mobileTokens.typography.body.lineHeight,
    marginBottom: mobileTokens.spacing[3],
  },
  subtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: mobileTokens.typography.body.weight,
    lineHeight: mobileTokens.typography.body.lineHeight,
    marginBottom: mobileTokens.spacing[4],
  },
  claimPanel: {
    gap: mobileTokens.spacing[3],
    marginBottom: mobileTokens.spacing[3],
  },
  claimTeaching: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: mobileTokens.typography.body.weight,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  claimInput: {
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 12,
    borderWidth: 1,
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "600",
    minHeight: 56,
    paddingHorizontal: mobileTokens.spacing[4],
  },
  closeButton: {
    alignItems: "center",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    marginBottom: mobileTokens.spacing[8],
    width: 44,
  },
  closeButtonLabel: {
    color: mobileTokens.color.paper,
    fontSize: 16,
    fontWeight: "800",
  },
  confirmCard: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 8,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    marginBottom: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.paper,
    borderRadius: 999,
    minHeight: 56,
    justifyContent: "center",
    marginTop: mobileTokens.spacing[3],
    paddingHorizontal: mobileTokens.spacing[4],
  },
  primaryButtonLabel: {
    color: mobileTokens.color.ink,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: "center",
    marginBottom: mobileTokens.spacing[3],
    paddingHorizontal: mobileTokens.spacing[4],
  },
  secondaryButtonLabel: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  disabledButton: {
    opacity: 0.45,
  },
  inlineError: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: mobileTokens.spacing[3],
  },
  inlineSuccess: {
    color: mobileTokens.color.sun,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: mobileTokens.spacing[3],
  },
});
