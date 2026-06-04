import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { mobileTokens } from "../design/tokens";
import type {
  PlanListItem,
  PlanListSnapshot,
  PlanParticipantScope,
} from "./planRepository";
import { hasPlans } from "./planRepository";

type PlanBucket = {
  key: keyof PlanListSnapshot;
  title: string;
};

type PlanListScreenProps = {
  plans: PlanListSnapshot;
  notice?: string | null;
  onCreatePlan?: (participantScope: PlanParticipantScope) => void;
  onDeletePlan?: (plan: PlanListItem) => Promise<void> | void;
  onOpenPlan?: (plan: PlanListItem) => void;
  onOpenSettings?: () => void;
};

const planBuckets: PlanBucket[] = [
  { key: "created", title: "Created" },
  { key: "joined", title: "Joined" },
  { key: "decided", title: "Decided" },
  { key: "history", title: "History" },
];

export function PlanListScreen({
  plans,
  notice,
  onCreatePlan,
  onDeletePlan,
  onOpenPlan,
  onOpenSettings,
}: PlanListScreenProps) {
  const hasAnyPlan = hasPlans(plans);
  const [planPendingDelete, setPlanPendingDelete] =
    useState<PlanListItem | null>(null);
  const [
    locallyDeletedCreatedPlanIds,
    setLocallyDeletedCreatedPlanIds,
  ] = useState<Set<string>>(() => new Set());

  const handleConfirmDelete = (plan: PlanListItem) => {
    setLocallyDeletedCreatedPlanIds(
      (currentIds) => new Set(currentIds).add(plan.id),
    );
    setPlanPendingDelete(null);
    void (onDeletePlan?.(plan));
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>GetToIt</Text>
        <Pressable
          accessibilityLabel="Open Settings"
          accessibilityRole="button"
          onPress={onOpenSettings}
          style={styles.settingsButton}
        >
          <Text style={styles.settingsButtonLabel}>Settings</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>Plans</Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <View style={styles.createActions}>
        <Pressable
          accessibilityLabel="Create solo Plan"
          accessibilityRole="button"
          onPress={() => onCreatePlan?.("solo")}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonLabel}>Just me</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Create group Plan"
          accessibilityRole="button"
          onPress={() => onCreatePlan?.("group")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonLabel}>A group</Text>
        </Pressable>
      </View>
      {hasAnyPlan ? (
        <View style={styles.bucketStack}>
          {planBuckets.map((bucket) => (
            <View key={bucket.key} style={styles.bucket}>
              <Text style={styles.bucketTitle}>{bucket.title}</Text>
              {plans[bucket.key]
                .filter((plan) => !locallyDeletedCreatedPlanIds.has(plan.id))
                .map((plan) => (
                  <View key={plan.id} style={styles.planRow}>
                    <Pressable
                      accessibilityLabel={`Open ${bucket.title} Plan ${plan.title}`}
                      accessibilityRole="button"
                      onPress={() => onOpenPlan?.(plan)}
                      style={styles.planOpenArea}
                    >
                      <View style={styles.planRowHeader}>
                        <Text style={styles.planTitle}>{plan.title}</Text>
                        <Text style={styles.badge}>{plan.badge}</Text>
                      </View>
                      <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
                    </Pressable>
                    {bucket.key === "created" ? (
                      <Pressable
                        accessibilityLabel={`Delete Created Plan ${plan.title}`}
                        accessibilityRole="button"
                        onPress={() => setPlanPendingDelete(plan)}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.deleteButtonLabel}>Delete</Text>
                      </Pressable>
                    ) : null}
                    {planPendingDelete?.id === plan.id ? (
                      <View style={styles.confirmCard}>
                        <Text style={styles.confirmTitle}>
                          Delete {plan.title}?
                        </Text>
                        <Text style={styles.confirmBody}>
                          This removes the Plan and ends its active room.
                        </Text>
                        <Pressable
                          accessibilityLabel={`Confirm delete Plan ${plan.title}`}
                          accessibilityRole="button"
                          onPress={() => handleConfirmDelete(plan)}
                          style={styles.secondaryButton}
                        >
                          <Text style={styles.secondaryButtonLabel}>
                            Delete Plan
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setPlanPendingDelete(null)}
                          style={styles.cancelButton}
                        >
                          <Text style={styles.cancelButtonLabel}>
                            Keep Plan
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Plans yet</Text>
          <Text style={styles.emptyBody}>
            Create a Plan when you are ready to pick a place.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileTokens.color.ink,
  },
  content: {
    padding: mobileTokens.spacing[8],
    paddingTop: 72,
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
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  settingsButton: {
    alignItems: "center",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: mobileTokens.spacing[4],
  },
  settingsButtonLabel: {
    color: mobileTokens.color.paper,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  createActions: {
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    marginBottom: mobileTokens.spacing[8],
  },
  bucketStack: {
    gap: mobileTokens.spacing[8],
  },
  bucket: {
    gap: mobileTokens.spacing[3],
  },
  bucketTitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  planRow: {
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 8,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    minHeight: 88,
    padding: mobileTokens.spacing[4],
  },
  planOpenArea: {
    gap: mobileTokens.spacing[3],
  },
  planRowHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    justifyContent: "space-between",
  },
  planTitle: {
    color: mobileTokens.color.paper,
    flex: 1,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  badge: {
    color: mobileTokens.color.sun,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  planSubtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: 14,
    fontWeight: "500",
  },
  deleteButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: mobileTokens.spacing[4],
  },
  deleteButtonLabel: {
    color: mobileTokens.color.paper,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  confirmCard: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 8,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
  },
  confirmTitle: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  confirmBody: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: 14,
    fontWeight: "500",
  },
  cancelButton: {
    minHeight: 40,
    justifyContent: "center",
  },
  cancelButtonLabel: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  emptyState: {
    gap: mobileTokens.spacing[4],
  },
  notice: {
    color: mobileTokens.color.sun,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    lineHeight: mobileTokens.typography.body.lineHeight,
    marginBottom: mobileTokens.spacing[4],
  },
  emptyTitle: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
  },
  emptyBody: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
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
    flex: 1,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: mobileTokens.spacing[4],
  },
  secondaryButtonLabel: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
