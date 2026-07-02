import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { mobileTokens } from "../design/tokens";
import { VerdictBackdrop } from "../design/VerdictBackdrop";
import type {
  RerollInput,
  VerdictViewModel,
} from "./verdictRepository";

type VerdictScreenProps = {
  mode?: "live" | "readOnly";
  onPrimaryAction?: () => void;
  onReroll?: (input: RerollInput) => Promise<void>;
  verdict: VerdictViewModel;
};

export function VerdictScreen({
  mode = "live",
  onPrimaryAction,
  onReroll = async () => undefined,
  verdict,
}: VerdictScreenProps) {
  if (verdict.kind === "history") {
    return <HistoryVerdict onPrimaryAction={onPrimaryAction} verdict={verdict} />;
  }

  if (verdict.kind === "noSurvivor") {
    return <NoSurvivorVerdict onPrimaryAction={onPrimaryAction} />;
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
      contentInsetAdjustmentBehavior="automatic"
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
        <MapsLink uri={verdict.googleMapsUri} />
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
          <Text style={styles.ruleText}>{cleanDisplayText(verdict.ruleText)}</Text>
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
        <Pressable
          accessibilityRole="button"
          onPress={onPrimaryAction}
          style={styles.primaryButton}
        >
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

type HistoryVerdictProps = {
  onPrimaryAction?: () => void;
  verdict: Extract<VerdictViewModel, { kind: "history" }>;
};

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
  onPrimaryAction,
}: {
  onPrimaryAction?: () => void;
}) {
  return (
    <View style={styles.noSurvivorRoot}>
      <Text style={styles.eyebrow}>Try a wider search</Text>
      <Text style={styles.title}>No spot fits tonight</Text>
      <Text style={styles.subtitle}>
        Every candidate was ruled out by the group's hard constraints.
      </Text>
      <Text style={styles.subtitle}>
        Start a new Plan with a wider search area.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPrimaryAction}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonLabel}>Start a new Plan</Text>
      </Pressable>
    </View>
  );
}

function HistoryVerdict({ onPrimaryAction, verdict }: HistoryVerdictProps) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.verdictContent}
      contentInsetAdjustmentBehavior="automatic"
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
            <MapsLink uri={verdict.display.googleMapsUri} />
            <Text style={styles.attribution}>
              {verdict.display.attributionText}
            </Text>
          </>
        ) : (
          <Text style={styles.recordCopy}>{verdict.display.details}</Text>
        )}
      </View>

      <View style={styles.actionStack}>
        <Pressable
          accessibilityRole="button"
          onPress={onPrimaryAction}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonLabel}>Start a new decision</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function MapsLink({ uri }: { uri: string }) {
  return (
    <Pressable
      accessibilityLabel="Open in Maps"
      accessibilityRole="button"
      onPress={() => void Linking.openURL(uri)}
      style={styles.mapsButton}
    >
      <Text style={styles.mapsButtonLabel}>Open in Maps</Text>
    </Pressable>
  );
}

function cleanDisplayText(value: string): string {
  return value
    .replaceAll("â€”", "-")
    .replaceAll("â€“", "-")
    .replaceAll("â€™", "'");
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
    padding: mobileTokens.spacing[5],
  },
  noSurvivorRoot: {
    flex: 1,
    backgroundColor: mobileTokens.color.ink,
    gap: mobileTokens.spacing[4],
    padding: mobileTokens.spacing[5],
    paddingTop: mobileTokens.spacing[10],
  },
  topbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 40,
  },
  liveChip: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.full,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: mobileTokens.spacing[3],
  },
  liveChipText: {
    color: mobileTokens.color.sun,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: "800",
  },
  avatarStack: {
    alignItems: "center",
    flexDirection: "row",
  },
  avatar: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainerHighest,
    borderColor: mobileTokens.color.ink,
    borderRadius: mobileTokens.radius.full,
    borderWidth: 2,
    height: 32,
    justifyContent: "center",
    marginLeft: -8,
    width: 32,
  },
  avatarText: {
    color: mobileTokens.color.sun,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: 12,
    fontWeight: "900",
  },
  poster: {
    backgroundColor: mobileTokens.color.surface,
    borderColor: mobileTokens.color.glassTop,
    borderRadius: mobileTokens.radius.xl,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    marginTop: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
    paddingTop: 36,
  },
  seal: {
    alignItems: "center",
    borderColor: mobileTokens.color.sun,
    borderRadius: mobileTokens.radius.full,
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
    fontFamily: mobileTokens.typography.family.label,
    fontSize: 10,
    fontWeight: "900",
  },
  posterKicker: {
    color: mobileTokens.color.sun,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: "900",
  },
  venueTitle: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.display,
    fontSize: 40,
    fontWeight: "700",
    lineHeight: 40,
    marginTop: mobileTokens.spacing[3],
  },
  historyPlanName: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  metaLine: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  mapsButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: mobileTokens.color.copper,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: mobileTokens.spacing[3],
  },
  mapsButtonLabel: {
    color: mobileTokens.color.copper,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  attribution: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  timeBlock: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.sun,
    borderRadius: mobileTokens.radius.lg,
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    justifyContent: "space-between",
    marginTop: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
  },
  timeMain: {
    color: mobileTokens.color.ink,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 32,
  },
  timeSub: {
    color: mobileTokens.color.ink,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  proofStack: {
    gap: mobileTokens.spacing[3],
  },
  ruleCard: {
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.lg,
    borderWidth: 1,
    gap: 8,
    padding: mobileTokens.spacing[4],
  },
  proofLabel: {
    color: mobileTokens.color.sun,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: "900",
  },
  eyebrow: {
    color: mobileTokens.color.sun,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.display,
    fontSize: mobileTokens.typography.display.size,
    fontWeight: mobileTokens.typography.display.weight,
    lineHeight: mobileTokens.typography.display.lineHeight,
  },
  subtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  timeAudience: {
    color: mobileTokens.color.ink,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "right",
  },
  ruleText: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  recordCopy: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  receiptBlock: {
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.lg,
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
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  receiptText: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.label,
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
    borderRadius: mobileTokens.radius.md,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: mobileTokens.spacing[4],
  },
  primaryButtonLabel: {
    color: mobileTokens.color.ink,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: mobileTokens.color.copper,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: mobileTokens.spacing[4],
  },
  secondaryButtonLabel: {
    color: mobileTokens.color.copper,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
    textAlign: "center",
  },
  rerollUnavailable: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    lineHeight: mobileTokens.typography.body.lineHeight,
    textAlign: "center",
  },
});
