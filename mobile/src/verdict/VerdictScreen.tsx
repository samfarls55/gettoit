import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { mobileTokens } from "../design/tokens";
import { VerdictBackdrop } from "../design/VerdictBackdrop";
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
  if (verdict.kind === "history") {
    return <HistoryVerdict verdict={verdict} />;
  }

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
  const primaryActionLabel = isReadOnly
    ? "Start a new decision"
    : verdict.primaryActionLabel;
  const rerollActionLabel =
    verdict.reroll.burnsRemaining === 1
      ? "Reroll with reason, last one"
      : `Reroll with reason, ${verdict.reroll.burnsRemaining} left`;
  const topLabel = isReadOnly
    ? "Verdict record"
    : isSolo
      ? "Solo verdict"
      : "Live verdict";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.verdictContent}
    >
      <VerdictBackdrop />

      <View style={styles.topbar}>
        <View style={styles.liveChip}>
          <Text style={styles.liveChipText}>{topLabel}</Text>
        </View>
        {verdict.receipts.length > 0 ? (
          <View
            accessibilityLabel="Members counted"
            style={styles.avatarStack}
          >
            {verdict.receipts.slice(0, 4).map((receipt) => (
              <View key={receipt.id} style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsFor(receipt.name)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.poster}>
        <View style={styles.seal}>
          <Text style={styles.sealText}>LOCKED</Text>
        </View>
        <Text style={styles.posterKicker}>
          {liveKickerFor(verdict, isReadOnly)}
        </Text>
        <Text accessibilityLabel={verdict.placeName} style={styles.venueTitle}>
          {stackedPlaceName(verdict.placeName)}
        </Text>
        {verdict.formattedAddress ? (
          <Text style={styles.metaLine}>{verdict.formattedAddress}</Text>
        ) : null}
        <Text style={styles.mapsLink}>{verdict.googleMapsUri}</Text>
        <Text style={styles.attribution}>{verdict.attributionText}</Text>
        {isReadOnly ? (
          <Text style={styles.recordCopy}>
            This Plan is closed. The recommendation is preserved as a record.
          </Text>
        ) : (
          <View style={styles.timeBlock}>
            <View>
              <Text style={styles.timeMain}>{verdict.timeBadge.time}</Text>
              <Text style={styles.timeSub}>Meet there</Text>
            </View>
            {verdict.timeBadge.audience ? (
              <Text style={styles.timeAudience}>
                {verdict.timeBadge.audience}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.proofStack}>
        <View style={styles.ruleCard}>
          <Text style={styles.proofLabel}>Rule proof</Text>
          <Text style={styles.ruleText}>{verdict.ruleText}</Text>
        </View>
        {verdict.receipts.length > 0 ? (
          <View style={styles.receiptBlock}>
            <Text style={styles.proofLabel}>Member receipts</Text>
            <View style={styles.receiptRow}>
              {verdict.receipts.map((receipt) => (
                <View key={receipt.id} style={styles.receiptChip}>
                  <Text style={styles.receiptText}>
                    {receipt.name}: {receipt.action}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.actionStack}>
        <Pressable accessibilityRole="button" style={styles.primaryButton}>
          <Text style={styles.primaryButtonLabel}>{primaryActionLabel}</Text>
        </Pressable>
        {isReadOnly ? null : verdict.reroll.isEligible ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onReroll({ roomId: verdict.roomId, reason: "mood" })}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>
              {rerollActionLabel}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.rerollUnavailable}>
            {verdict.reroll.ineligibleReason}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

type NoSurvivorVerdictProps = {
  onWidenAndRerun: (input: WidenAndRerunInput) => Promise<void>;
  verdict: Extract<VerdictViewModel, { kind: "noSurvivor" }>;
};

type HistoryVerdictProps = {
  verdict: Extract<VerdictViewModel, { kind: "history" }>;
};

function radiusLabel(radiusMiles: number): string {
  return `${radiusMiles.toFixed(1)} mi`;
}

function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return initials.toUpperCase() || "?";
}

function stackedPlaceName(placeName: string): string {
  return placeName.trim().split(/\s+/).join("\n").toUpperCase();
}

function liveKickerFor(
  verdict: Extract<VerdictViewModel, { kind: "live" }>,
  isReadOnly: boolean,
): string {
  if (isReadOnly) {
    return "Closed record";
  }

  if (verdict.flavor === "solo") {
    return "Solo pick";
  }

  return `Tonight at ${verdict.timeBadge.time}`;
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
    <View style={styles.noSurvivorRoot}>
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

function HistoryVerdict({ verdict }: HistoryVerdictProps) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.verdictContent}
    >
      <VerdictBackdrop />
      <View style={styles.topbar}>
        <View style={styles.liveChip}>
          <Text style={styles.liveChipText}>Verdict record</Text>
        </View>
      </View>

      <View style={styles.poster}>
        <Text style={styles.posterKicker}>{verdict.decidedAtLabel}</Text>
        <Text style={styles.historyPlanName}>{verdict.planName}</Text>
        <Text
          accessibilityLabel={verdict.display.placeName}
          style={styles.venueTitle}
        >
          {stackedPlaceName(verdict.display.placeName)}
        </Text>
        {verdict.display.status === "available" &&
        verdict.display.formattedAddress ? (
          <Text style={styles.metaLine}>{verdict.display.formattedAddress}</Text>
        ) : null}
        {verdict.display.status === "available" ? (
          <>
            <Text style={styles.mapsLink}>{verdict.display.googleMapsUri}</Text>
            <Text style={styles.attribution}>
              {verdict.display.attributionText}
            </Text>
          </>
        ) : (
          <Text style={styles.recordCopy}>{verdict.display.details}</Text>
        )}
      </View>

      <View style={styles.actionStack}>
        <Pressable accessibilityRole="button" style={styles.primaryButton}>
          <Text style={styles.primaryButtonLabel}>Start a new decision</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileTokens.color.ink,
  },
  verdictContent: {
    flexGrow: 1,
    gap: mobileTokens.spacing[4],
    overflow: "hidden",
    padding: mobileTokens.spacing[8],
  },
  noSurvivorRoot: {
    flex: 1,
    backgroundColor: mobileTokens.color.ink,
    gap: mobileTokens.spacing[4],
    padding: mobileTokens.spacing[8],
  },
  topbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 40,
  },
  liveChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: mobileTokens.spacing[3],
  },
  liveChipText: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: "800",
  },
  avatarStack: {
    alignItems: "center",
    flexDirection: "row",
  },
  avatar: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.paper,
    borderColor: "rgba(0,0,0,0.52)",
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    justifyContent: "center",
    marginLeft: -8,
    width: 32,
  },
  avatarText: {
    color: mobileTokens.color.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  poster: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 18,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    marginTop: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
    paddingTop: 36,
  },
  seal: {
    alignItems: "center",
    borderColor: mobileTokens.color.sun,
    borderRadius: 36,
    borderWidth: 2,
    height: 72,
    justifyContent: "center",
    position: "absolute",
    right: 14,
    top: -20,
    transform: [{ rotate: "-10deg" }],
    width: 72,
  },
  sealText: {
    color: mobileTokens.color.sun,
    fontSize: 10,
    fontWeight: "900",
  },
  posterKicker: {
    color: mobileTokens.color.sun,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: "900",
  },
  venueTitle: {
    color: mobileTokens.color.paper,
    fontSize: 46,
    fontWeight: "900",
    lineHeight: 42,
    marginTop: mobileTokens.spacing[3],
  },
  historyPlanName: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  metaLine: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  mapsLink: {
    color: mobileTokens.color.paper,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  attribution: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  timeBlock: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.sun,
    borderRadius: 14,
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    justifyContent: "space-between",
    marginTop: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
  },
  timeMain: {
    color: mobileTokens.color.ink,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 32,
  },
  timeSub: {
    color: mobileTokens.color.ink,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  proofStack: {
    gap: mobileTokens.spacing[3],
  },
  ruleCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    padding: mobileTokens.spacing[4],
  },
  proofLabel: {
    color: mobileTokens.color.sun,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: "900",
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
  timeAudience: {
    color: mobileTokens.color.ink,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "right",
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
  receiptBlock: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
  },
  receiptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileTokens.spacing[3],
  },
  receiptChip: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  receiptText: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: 13,
    fontWeight: "800",
  },
  actionStack: {
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
    textAlign: "center",
  },
  rerollUnavailable: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    lineHeight: mobileTokens.typography.body.lineHeight,
    textAlign: "center",
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
