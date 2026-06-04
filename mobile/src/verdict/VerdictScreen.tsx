import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { mobileTokens } from "../design/tokens";
import type {
  RerollInput,
  VerdictViewModel,
  WidenAndRerunInput,
} from "./verdictRepository";

type VerdictScreenProps = {
  mode?: "live" | "readOnly";
  onReroll?: (input: RerollInput) => Promise<void>;
  onWidenAndRerun?: (input: WidenAndRerunInput) => Promise<void>;
  verdict: VerdictViewModel;
};

export function VerdictScreen({
  mode = "live",
  onReroll = async () => undefined,
  onWidenAndRerun = async () => undefined,
  verdict,
}: VerdictScreenProps) {
  if (verdict.kind === "noSurvivor") {
    return (
      <NoSurvivorVerdict
        onWidenAndRerun={onWidenAndRerun}
        verdict={verdict}
      />
    );
  }

  const isSolo = verdict.flavor === "solo";
  const isReadOnly = mode === "readOnly";
  let eyebrowLabel = "Tonight, the verdict is";

  if (isReadOnly) {
    eyebrowLabel = "Closed verdict record";
  } else if (isSolo) {
    eyebrowLabel = "Your solo pick";
  }

  const primaryActionLabel = isReadOnly
    ? "Start a new decision"
    : verdict.primaryActionLabel;
  const rerollLabel =
    verdict.reroll.burnsRemaining === 1
      ? "Reroll · last one"
      : `Reroll · ${verdict.reroll.burnsRemaining} left`;

  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>{eyebrowLabel}</Text>
      <Text style={styles.title}>{verdict.placeName}</Text>
      {verdict.metaLine ? (
        <Text style={styles.subtitle}>{verdict.metaLine}</Text>
      ) : null}
      {isReadOnly ? (
        <Text style={styles.recordCopy}>
          This Plan is closed. The recommendation is preserved as a record.
        </Text>
      ) : (
        <View style={styles.timeBadge}>
          <Text style={styles.timeText}>{verdict.timeBadge.time}</Text>
          {verdict.timeBadge.audience ? (
            <Text style={styles.timeAudience}>
              {verdict.timeBadge.audience}
            </Text>
          ) : null}
        </View>
      )}
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
            {primaryActionLabel}
          </Text>
        </Pressable>
        {isReadOnly ? null : verdict.reroll.isEligible ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onReroll({ roomId: verdict.roomId, reason: "mood" })}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>{rerollLabel}</Text>
          </Pressable>
        ) : (
          <Text style={styles.subtitle}>{verdict.reroll.ineligibleReason}</Text>
        )}
      </View>
    </View>
  );
}

type NoSurvivorVerdictProps = {
  onWidenAndRerun: (input: WidenAndRerunInput) => Promise<void>;
  verdict: Extract<VerdictViewModel, { kind: "noSurvivor" }>;
};

function radiusLabel(radiusMiles: number): string {
  return `${radiusMiles.toFixed(1)} mi`;
}

function NoSurvivorVerdict({
  onWidenAndRerun,
  verdict,
}: NoSurvivorVerdictProps) {
  const [radiusMiles, setRadiusMiles] = useState(verdict.currentRadiusMiles);
  const [actionError, setActionError] = useState<string | null>(null);

  const widen = () => {
    setRadiusMiles((current) =>
      Math.min(verdict.maxRadiusMiles, current + verdict.stepMiles),
    );
  };

  const narrow = () => {
    setRadiusMiles((current) =>
      Math.max(verdict.minRadiusMiles, current - verdict.stepMiles),
    );
  };

  const handleRerun = async () => {
    setActionError(null);

    try {
      await onWidenAndRerun({ roomId: verdict.roomId, radiusMiles });
    } catch {
      setActionError("Could not re-run. Try again.");
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>Try a wider search</Text>
      <Text style={styles.title}>No spot fits tonight</Text>
      <Text style={styles.subtitle}>
        Every candidate was ruled out by the group's hard constraints.
      </Text>
      <View style={styles.radiusControl}>
        <Pressable
          accessibilityLabel="Narrow search area"
          accessibilityRole="button"
          onPress={narrow}
          style={styles.stepButton}
        >
          <Text style={styles.secondaryButtonLabel}>-</Text>
        </Pressable>
        <Text style={styles.radiusValue}>{radiusLabel(radiusMiles)}</Text>
        <Pressable
          accessibilityLabel="Widen search area"
          accessibilityRole="button"
          onPress={widen}
          style={styles.stepButton}
        >
          <Text style={styles.secondaryButtonLabel}>+</Text>
        </Pressable>
      </View>
      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={handleRerun}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonLabel}>
          Re-run · {radiusLabel(radiusMiles)}
        </Text>
      </Pressable>
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
  recordCopy: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.body.size,
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
  radiusControl: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileTokens.spacing[4],
  },
  radiusValue: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
    minWidth: 96,
    textAlign: "center",
  },
  stepButton: {
    alignItems: "center",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  errorText: {
    color: mobileTokens.color.sun,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
  },
});
