import { Pressable, StyleSheet, Text, View } from "react-native";

import { mobileTokens } from "../design/tokens";
import type { LiveVerdictViewModel } from "./verdictRepository";

type VerdictScreenProps = {
  verdict: LiveVerdictViewModel;
};

export function VerdictScreen({ verdict }: VerdictScreenProps) {
  const isSolo = verdict.flavor === "solo";

  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>
        {isSolo ? "Your solo pick" : "Tonight, the verdict is"}
      </Text>
      <Text style={styles.title}>{verdict.placeName}</Text>
      {verdict.metaLine ? (
        <Text style={styles.subtitle}>{verdict.metaLine}</Text>
      ) : null}
      <View style={styles.timeBadge}>
        <Text style={styles.timeText}>{verdict.timeBadge.time}</Text>
        {verdict.timeBadge.audience ? (
          <Text style={styles.timeAudience}>{verdict.timeBadge.audience}</Text>
        ) : null}
      </View>
      <Text style={styles.ruleText}>{verdict.ruleText}</Text>
      {verdict.receipts.length > 0 ? (
        <View style={styles.receiptStack}>
          {verdict.receipts.map((receipt) => (
            <View key={receipt.id} style={styles.receiptRow}>
              <Text style={styles.receiptName}>{receipt.name}</Text>
              <Text style={styles.receiptAction}>{receipt.action}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.actionRow}>
        <Pressable accessibilityRole="button" style={styles.primaryButton}>
          <Text style={styles.primaryButtonLabel}>
            {verdict.primaryActionLabel}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonLabel}>Reroll</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileTokens.color.ink,
    gap: mobileTokens.spacing[4],
    padding: mobileTokens.spacing[8],
  },
  eyebrow: {
    color: mobileTokens.color.sun,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  title: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.display.size,
    fontWeight: mobileTokens.typography.display.weight,
    lineHeight: mobileTokens.typography.display.lineHeight,
  },
  subtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  timeBadge: {
    alignSelf: "flex-start",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 12,
    borderWidth: 1,
    padding: mobileTokens.spacing[4],
  },
  timeText: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  timeAudience: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 1.5,
    marginTop: mobileTokens.spacing[3],
    textTransform: "uppercase",
  },
  ruleText: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  receiptStack: {
    gap: mobileTokens.spacing[3],
  },
  receiptRow: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 12,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
  },
  receiptName: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  receiptAction: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.body.size,
  },
  actionRow: {
    gap: mobileTokens.spacing[3],
    marginTop: mobileTokens.spacing[4],
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.sun,
    borderRadius: 999,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: mobileTokens.spacing[4],
  },
  primaryButtonLabel: {
    color: mobileTokens.color.ink,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: mobileTokens.spacing[4],
  },
  secondaryButtonLabel: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
