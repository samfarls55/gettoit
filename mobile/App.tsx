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
  PlanRepository,
} from "./src/plans/planRepository";
import {
  emptyPlanListSnapshot,
  fakePlanRepository,
} from "./src/plans/planRepository";
import { PlanListScreen } from "./src/plans/PlanListScreen";
import { SearchAreaPickerPreview } from "./src/searchArea/SearchAreaPickerPreview";

type AuthBoundary = {
  signInWithApple: () => Promise<void>;
  redeemClaimCode: (code: string) => Promise<void>;
};

type AppProps = {
  authBoundary?: AuthBoundary;
  initialRouterState?: AppStateRouterState;
  planRepository?: PlanRepository;
  [key: string]: unknown;
};

type MobileAppShellProps = {
  authBoundary?: AuthBoundary;
  onCreatePlan?: () => void;
  routerState: AppStateRouterState;
  onAppleSignInSucceeded?: () => void;
  onClaimCodeRedeemed?: () => void;
  onOpenPlan?: (plan: PlanListItem) => void;
  planRepository?: PlanRepository;
};

type RouteContent = {
  title: string;
  body: string;
};

const contentByRouteName: Record<AppRouteName, RouteContent> = {
  signInGate: {
    title: "Sign in gate",
    body: "Sign in once and your taste profile saves itself.",
  },
  planList: {
    title: "Plan list",
    body: "Your Plans will appear here.",
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
  signInWithApple: async () => undefined,
  redeemClaimCode: async () => undefined,
};

export default function App({
  authBoundary = defaultAuthBoundary,
  initialRouterState,
  planRepository = fakePlanRepository,
}: AppProps = {}) {
  const [routerState, dispatch] = useReducer(
    appStateRouterReducer,
    initialRouterState ?? initialAppStateRouterState,
  );

  return (
    <MobileAppShell
      authBoundary={authBoundary}
      onCreatePlan={() => dispatch({ type: "openSetup" })}
      onOpenPlan={(plan) => {
        switch (plan.routeTarget) {
          case "pending":
            dispatch({ type: "openSetup" });
            break;
          case "joined":
            dispatch({ type: "startQuiz" });
            break;
          case "decided":
          case "history":
            dispatch({ type: "showVerdict" });
            break;
        }
      }}
      planRepository={planRepository}
      routerState={routerState}
      onAppleSignInSucceeded={() =>
        dispatch({ type: "appleSignInSucceeded" })
      }
      onClaimCodeRedeemed={() => dispatch({ type: "claimCodeRedeemed" })}
    />
  );
}

export function MobileAppShell({
  authBoundary = defaultAuthBoundary,
  onCreatePlan,
  onAppleSignInSucceeded,
  onClaimCodeRedeemed,
  onOpenPlan,
  planRepository = fakePlanRepository,
  routerState,
}: MobileAppShellProps) {
  const route = routeForAppState(routerState);
  const [planSnapshot, setPlanSnapshot] = useState<PlanListSnapshot>(
    emptyPlanListSnapshot,
  );
  const [planListStatus, setPlanListStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");

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

        setPlanSnapshot(snapshot);
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
  }, [planRepository, route.name]);

  if (route.name === "setup") {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SearchAreaPickerPreview />
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
        {planListStatus === "error" ? (
          <View style={styles.surface}>
            <Text style={styles.routeTitle}>Plans unavailable</Text>
            <Text style={styles.subtitle}>Try again in a moment.</Text>
          </View>
        ) : planListStatus === "loaded" ? (
          <PlanListScreen
            onCreatePlan={onCreatePlan}
            onOpenPlan={onOpenPlan}
            plans={planSnapshot}
          />
        ) : (
          <View style={styles.surface}>
            <Text style={styles.routeTitle}>Plans</Text>
            <Text style={styles.subtitle}>Loading Plans.</Text>
          </View>
        )}
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
