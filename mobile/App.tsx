import { StatusBar } from "expo-status-bar";
import { useReducer } from "react";
import { StyleSheet, Text, View } from "react-native";

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
import { SearchAreaPickerPreview } from "./src/searchArea/SearchAreaPickerPreview";

type AppProps = {
  initialRouterState?: AppStateRouterState;
  [key: string]: unknown;
};

type MobileAppShellProps = {
  routerState: AppStateRouterState;
};

type RouteContent = {
  title: string;
  body: string;
};

const contentByRouteName: Record<AppRouteName, RouteContent> = {
  signInGate: {
    title: "Sign in gate",
    body: "Sign in with Apple to continue.",
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

export default function App({ initialRouterState }: AppProps = {}) {
  const [routerState] = useReducer(
    appStateRouterReducer,
    initialRouterState ?? initialAppStateRouterState,
  );

  return <MobileAppShell routerState={routerState} />;
}

export function MobileAppShell({ routerState }: MobileAppShellProps) {
  const route = routeForAppState(routerState);
  const content = contentByRouteName[route.name];

  if (route.name === "setup") {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SearchAreaPickerPreview />
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
  },
});
