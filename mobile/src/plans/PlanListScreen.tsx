import { useEffect, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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

const avatarUri =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB4NvCz-ozIWJU7CwGn1cPLKTB43XheUlbFFiwpeUSpz8Taqn7yz6CQksaWf4rJBOySVc3aHw5JxLmj9m-65SRAZwqtxa2-OxK_ca4fqnnC7OW2DZMik90bR_WzgHdvefPS9JRZuzy7dNkYIUmvjd2mdc8Dx5N9PqxU-8bUalxH0q1y4y1_2-uZjXLaItL7sJTatwEliCKD_TX2qifg0HsH19i_en7GD5CfAJB9iiO8Gvbmo1v3lVy1Mw";

const livePlanBuckets: PlanBucket[] = [
  { key: "created", title: "Created" },
  { key: "joined", title: "Joined" },
  { key: "decided", title: "Decided" },
];

const pastPlanBucket: PlanBucket = { key: "history", title: "History" };
const materialIconFont = "Material Symbols Outlined";
const isWeb = Platform.OS === "web";

function ensureDashboardFonts() {
  if (typeof document === "undefined") {
    return;
  }

  for (const [id, href] of [
    [
      "gettoit-playfair-font",
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&display=swap",
    ],
    [
      "gettoit-material-symbols-font",
      "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap",
    ],
    [
      "gettoit-ui-fonts",
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Manrope:wght@400;500;600;700;800&display=swap",
    ],
  ]) {
    if (document.getElementById(id)) {
      continue;
    }

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

export function PlanListScreen({
  plans,
  notice,
  onCreatePlan,
  onDeletePlan,
  onOpenPlan,
  onOpenSettings,
}: PlanListScreenProps) {
  useEffect(ensureDashboardFonts, []);

  const hasAnyPlan = hasPlans(plans);
  const [planPendingDelete, setPlanPendingDelete] =
    useState<PlanListItem | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [
    locallyDeletedCreatedPlanIds,
    setLocallyDeletedCreatedPlanIds,
  ] = useState<Set<string>>(() => new Set());
  const liveBuckets = livePlanBuckets.map((bucket) => ({
    ...bucket,
    plans: plans[bucket.key].filter(
      (plan) => !locallyDeletedCreatedPlanIds.has(plan.id),
    ),
  }));
  const pastPlans = plans.history;
  const handleCreateGroupPlan = () => onCreatePlan?.("group");

  const handleConfirmDelete = async (plan: PlanListItem) => {
    setDeleteError(null);
    setDeletingPlanId(plan.id);

    try {
      await onDeletePlan?.(plan);
      setLocallyDeletedCreatedPlanIds(
        (currentIds) => new Set(currentIds).add(plan.id),
      );
      setPlanPendingDelete(null);
    } catch {
      setDeleteError("Could not delete Plan. Try again.");
    } finally {
      setDeletingPlanId(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.topAppBar}>
        <Pressable
          accessibilityLabel="Open Settings"
          accessibilityRole="button"
          onPress={onOpenSettings}
          style={styles.iconButton}
        >
          <DashboardIcon
            color={mobileTokens.color.gold}
            fallback="☰"
            name="menu"
            size={30}
          />
        </Pressable>
        <Text style={styles.brand}>GetToIt</Text>
        <View style={styles.avatarButton}>
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
      >
        <View style={styles.hero}>
          <Text style={styles.title}>Your Plans</Text>
          <Text style={styles.subtitle}>Here's what you're up to.</Text>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.liveTitle}>Live Plans</Text>
          <ScrollView
            contentContainerStyle={styles.liveRail}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {liveBuckets.flatMap((bucket) =>
              bucket.plans.map((plan) => (
                <LivePlanCard
                  bucket={bucket}
                  deleteError={
                    planPendingDelete?.id === plan.id ? deleteError : null
                  }
                  isDeleting={deletingPlanId === plan.id}
                  key={plan.id}
                  onConfirmDelete={handleConfirmDelete}
                  onOpenPlan={onOpenPlan}
                  onRequestDelete={setPlanPendingDelete}
                  pendingDelete={planPendingDelete?.id === plan.id}
                  plan={plan}
                />
              )),
            )}
            <Pressable
              accessibilityLabel="Create group Plan"
              accessibilityRole="button"
              onPress={handleCreateGroupPlan}
              style={styles.createCard}
            >
              <View style={styles.createIcon}>
                <Text style={styles.createIconLabel}>+</Text>
              </View>
              <Text style={styles.createTitle}>Start a Plan</Text>
            </Pressable>
          </ScrollView>
        </View>

        <View style={styles.pastSection}>
          <Text style={styles.pastTitle}>Past Plans</Text>
          {pastPlans.length > 0 ? (
            <View style={styles.pastGrid}>
              {pastPlans.map((plan) => (
                <PastPlanCard
                  bucket={pastPlanBucket}
                  key={plan.id}
                  onOpenPlan={onOpenPlan}
                  plan={plan}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyBody}>Closed decisions will land here.</Text>
          )}
        </View>

        {hasAnyPlan ? null : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Plans yet</Text>
            <Text style={styles.emptyBody}>
              Create a Plan when you are ready to pick a place.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomActions}>
        <View style={styles.bottomActionCopy}>
          <Text style={styles.bottomActionEyebrow}>Plans</Text>
          <Text style={styles.bottomActionTitle}>Ready when you are.</Text>
        </View>
        <Pressable
          accessibilityLabel="Start a group Plan"
          accessibilityRole="button"
          onPress={handleCreateGroupPlan}
          style={styles.startPlanButton}
        >
          <DashboardIcon fallback="+" name="add" size={20} />
          <Text style={styles.startPlanButtonLabel}>Start a Plan</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LivePlanCard({
  bucket,
  deleteError,
  isDeleting,
  onConfirmDelete,
  onOpenPlan,
  onRequestDelete,
  pendingDelete,
  plan,
}: {
  bucket: PlanBucket;
  deleteError: string | null;
  isDeleting: boolean;
  onConfirmDelete: (plan: PlanListItem) => Promise<void> | void;
  onOpenPlan?: (plan: PlanListItem) => void;
  onRequestDelete: (plan: PlanListItem | null) => void;
  pendingDelete: boolean;
  plan: PlanListItem;
}) {
  const isDecided = bucket.key === "decided";
  const actionLabel = actionLabelFor(bucket);

  return (
    <View style={styles.liveCardShell}>
      <View style={styles.liveCard}>
        <Pressable
          accessibilityLabel={`Open ${bucket.title} Plan ${plan.title}`}
          accessibilityRole="button"
          onPress={() => onOpenPlan?.(plan)}
          style={styles.liveCardOpenArea}
        >
          <View
            style={[
              styles.cardWash,
              isDecided ? styles.secondaryCardWash : styles.primaryCardWash,
            ]}
          />
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleGroup}>
              <Text style={styles.bucketTitle}>{bucket.title}</Text>
              <Text numberOfLines={2} style={styles.planTitle}>
                {plan.title}
              </Text>
            </View>
            <View style={styles.statusChip}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{plan.badge}</Text>
            </View>
          </View>

          {isDecided ? (
            <View style={styles.detailStack}>
              <Text style={styles.detailLine}>□ Dinner</Text>
              <Text numberOfLines={1} style={styles.detailLine}>
                ◇ {plan.subtitle}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.avatarStack}>
                <Avatar label="A" tone="gold" />
                <Avatar label="M" tone="copper" />
                <View style={styles.avatarCount}>
                  <Text style={styles.avatarCountText}>+3</Text>
                </View>
              </View>
              <View style={styles.voteButton}>
                <Text style={styles.voteButtonLabel}>{actionLabel}</Text>
              </View>
            </>
          )}
        </Pressable>

        {bucket.key === "created" ? (
          <Pressable
            accessibilityLabel={`Delete Created Plan ${plan.title}`}
            accessibilityRole="button"
            disabled={isDeleting}
            hitSlop={8}
            onPress={() => onRequestDelete(plan)}
            style={[
              styles.deleteIconButton,
              isDeleting && styles.disabledAction,
            ]}
          >
            <DashboardIcon
              color={mobileTokens.color.danger}
              fallback="x"
              name="delete"
              size={20}
            />
          </Pressable>
        ) : null}
      </View>

      {pendingDelete ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Delete {plan.title}?</Text>
          <Text style={styles.confirmBody}>
            This deletes the Plan and ends its active room.
          </Text>
          {deleteError ? (
            <Text accessibilityRole="alert" style={styles.deleteError}>
              {deleteError}
            </Text>
          ) : null}
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityLabel={`Keep Plan ${plan.title}`}
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={() => onRequestDelete(null)}
              style={[
                styles.confirmGhostButton,
                isDeleting && styles.disabledAction,
              ]}
            >
              <Text style={styles.confirmGhostButtonLabel}>Keep Plan</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Confirm delete Plan ${plan.title}`}
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={() => void onConfirmDelete(plan)}
              style={[
                styles.confirmDeleteButton,
                isDeleting && styles.disabledAction,
              ]}
            >
              <Text style={styles.confirmDeleteButtonLabel}>
                {isDeleting ? "Deleting..." : "Delete Plan"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function actionLabelFor(bucket: PlanBucket) {
  if (bucket.key === "created") {
    return "Finish setup";
  }

  if (bucket.key === "joined") {
    return "Answer quiz";
  }

  return "Open Plan";
}

function Avatar({ label, tone }: { label: string; tone: "gold" | "copper" }) {
  return (
    <View
      style={[
        styles.memberAvatar,
        tone === "gold" ? styles.goldAvatar : styles.copperAvatar,
      ]}
    >
      <Text style={styles.memberAvatarText}>{label}</Text>
    </View>
  );
}

function DashboardIcon({
  color = mobileTokens.color.paper,
  fallback,
  name,
  size,
}: {
  color?: string;
  fallback: string;
  name: string;
  size: number;
}) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.iconGlyph,
        { color, fontSize: size, lineHeight: size + 4 },
      ]}
    >
      {isWeb ? name : fallback}
    </Text>
  );
}

function PastPlanCard({
  bucket,
  onOpenPlan,
  plan,
}: {
  bucket: PlanBucket;
  onOpenPlan?: (plan: PlanListItem) => void;
  plan: PlanListItem;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open ${bucket.title} Plan ${plan.title}`}
      accessibilityRole="button"
      onPress={() => onOpenPlan?.(plan)}
      style={styles.pastCard}
    >
      <View style={styles.pastCardTop}>
        <View style={styles.pastIcon}>
          <DashboardIcon fallback="▰" name="event_note" size={18} />
        </View>
        <DashboardIcon fallback=">" name="chevron_right" size={22} />
      </View>
      <View>
        <Text numberOfLines={1} style={styles.pastCardTitle}>
          {plan.title}
        </Text>
        <Text style={styles.pastBucket}>{bucket.title}</Text>
        <Text numberOfLines={1} style={styles.pastMeta}>
          {plan.subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const dashboardFont = mobileTokens.typography.family.display;
const bodyFont = mobileTokens.typography.family.body;
const labelFont = mobileTokens.typography.family.label;

const styles = StyleSheet.create({
  root: {
    alignSelf: "center",
    backgroundColor: mobileTokens.color.surface,
    flex: 1,
    maxWidth: 430,
    width: "100%",
  },
  topAppBar: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surface,
    borderBottomColor: mobileTokens.color.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    height: 64,
    justifyContent: "space-between",
    paddingHorizontal: mobileTokens.spacing[5],
  },
  iconButton: {
    alignItems: "center",
    gap: 4,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  iconGlyph: {
    fontFamily: isWeb ? materialIconFont : dashboardFont,
    fontWeight: "400",
    textAlign: "center",
  },
  brand: {
    color: mobileTokens.color.gold,
    fontFamily: dashboardFont,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 36,
  },
  avatarButton: {
    alignItems: "center",
    borderRadius: mobileTokens.radius.full,
    height: 40,
    justifyContent: "center",
    overflow: "hidden",
    width: 40,
  },
  avatarImage: {
    height: 40,
    width: 40,
  },
  scroller: {
    flex: 1,
  },
  content: {
    gap: mobileTokens.spacing[8],
    paddingBottom: 132,
    paddingTop: mobileTokens.spacing[10],
  },
  hero: {
    gap: mobileTokens.spacing[2],
    paddingHorizontal: mobileTokens.spacing[5],
  },
  title: {
    color: mobileTokens.color.paper,
    fontFamily: dashboardFont,
    fontSize: 48,
    fontWeight: "800",
    lineHeight: 56,
  },
  subtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: bodyFont,
    fontSize: 18,
    lineHeight: 28,
  },
  notice: {
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.lg,
    borderWidth: 1,
    color: mobileTokens.color.sun,
    fontFamily: bodyFont,
    fontSize: 14,
    marginHorizontal: mobileTokens.spacing[5],
    padding: mobileTokens.spacing[3],
  },
  section: {
    gap: mobileTokens.spacing[2],
  },
  liveTitle: {
    color: mobileTokens.color.gold,
    fontFamily: dashboardFont,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 40,
    paddingHorizontal: mobileTokens.spacing[5],
  },
  liveRail: {
    gap: mobileTokens.spacing[4],
    paddingBottom: mobileTokens.spacing[2],
    paddingHorizontal: mobileTokens.spacing[5],
  },
  liveCardShell: {
    gap: mobileTokens.spacing[3],
    width: 294,
  },
  liveCard: {
    backgroundColor: mobileTokens.color.surface,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.xl,
    borderWidth: 1,
    minHeight: 200,
    overflow: "hidden",
    position: "relative",
  },
  liveCardOpenArea: {
    gap: mobileTokens.spacing[4],
    minHeight: 200,
    padding: mobileTokens.spacing[4],
  },
  cardWash: {
    borderBottomLeftRadius: 128,
    height: 128,
    position: "absolute",
    right: 0,
    top: 0,
    width: 128,
  },
  primaryCardWash: {
    backgroundColor: "rgba(212, 175, 55, 0.10)",
  },
  secondaryCardWash: {
    backgroundColor: "rgba(208, 197, 162, 0.10)",
  },
  cardHeader: {
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    justifyContent: "space-between",
  },
  cardTitleGroup: {
    flex: 1,
    gap: mobileTokens.spacing[2],
  },
  bucketTitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: labelFont,
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  planTitle: {
    color: mobileTokens.color.paper,
    fontFamily: bodyFont,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },
  statusChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: mobileTokens.spacing[2],
    paddingHorizontal: mobileTokens.spacing[3],
    paddingVertical: mobileTokens.spacing[2],
  },
  statusDot: {
    backgroundColor: mobileTokens.color.gold,
    borderRadius: mobileTokens.radius.full,
    height: 8,
    width: 8,
  },
  statusText: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: labelFont,
    fontSize: 12,
    fontWeight: "500",
  },
  deleteIconButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.danger,
    borderRadius: mobileTokens.radius.full,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: mobileTokens.spacing[4],
    top: 58,
    width: 44,
    zIndex: 1,
  },
  avatarStack: {
    flexDirection: "row",
    marginTop: mobileTokens.spacing[3],
  },
  memberAvatar: {
    alignItems: "center",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.full,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    marginRight: -8,
    width: 32,
  },
  goldAvatar: {
    backgroundColor: "rgba(212, 175, 55, 0.24)",
  },
  copperAvatar: {
    backgroundColor: "rgba(255, 183, 123, 0.24)",
  },
  memberAvatarText: {
    color: mobileTokens.color.paper,
    fontFamily: labelFont,
    fontSize: 14,
    fontWeight: "700",
  },
  avatarCount: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.full,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  avatarCountText: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: labelFont,
    fontSize: 14,
  },
  voteButton: {
    alignItems: "center",
    backgroundColor: "#554500",
    borderRadius: mobileTokens.radius.lg,
    justifyContent: "center",
    marginTop: "auto",
    minHeight: 40,
  },
  voteButtonLabel: {
    color: "#F4E098",
    fontFamily: labelFont,
    fontSize: 14,
    fontWeight: "700",
  },
  detailStack: {
    gap: mobileTokens.spacing[3],
    marginTop: "auto",
  },
  detailLine: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: bodyFont,
    fontSize: 16,
    lineHeight: 24,
  },
  createCard: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.xl,
    borderStyle: "dashed",
    borderWidth: 2,
    gap: mobileTokens.spacing[3],
    justifyContent: "center",
    minHeight: 200,
    padding: mobileTokens.spacing[4],
    width: 160,
  },
  createIcon: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.full,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  createIconLabel: {
    color: mobileTokens.color.gold,
    fontFamily: bodyFont,
    fontSize: 28,
  },
  createTitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: bodyFont,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 28,
    textAlign: "center",
  },
  pastSection: {
    gap: mobileTokens.spacing[4],
    paddingHorizontal: mobileTokens.spacing[5],
  },
  pastTitle: {
    color: mobileTokens.color.paper,
    fontFamily: dashboardFont,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 40,
  },
  pastGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileTokens.spacing[3],
  },
  pastCard: {
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.lg,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    minHeight: 104,
    padding: mobileTokens.spacing[3],
    width: "48%",
  },
  pastCardTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pastIcon: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.full,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  pastCardTitle: {
    color: mobileTokens.color.paper,
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  pastBucket: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: labelFont,
    fontSize: 12,
    lineHeight: 16,
  },
  pastMeta: {
    color: mobileTokens.color.outline,
    fontFamily: bodyFont,
    fontSize: 12,
    lineHeight: 16,
  },
  confirmCard: {
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.copper,
    borderRadius: mobileTokens.radius.lg,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
  },
  confirmTitle: {
    color: mobileTokens.color.paper,
    fontFamily: bodyFont,
    fontSize: 16,
    fontWeight: "700",
  },
  confirmBody: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 20,
  },
  deleteError: {
    color: mobileTokens.color.danger,
    fontFamily: bodyFont,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  confirmActions: {
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
  },
  confirmDeleteButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.gold,
    borderRadius: mobileTokens.radius.md,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: mobileTokens.spacing[3],
  },
  confirmDeleteButtonLabel: {
    color: "#231A00",
    fontFamily: labelFont,
    fontSize: 12,
    fontWeight: "700",
  },
  confirmGhostButton: {
    alignItems: "center",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: mobileTokens.spacing[3],
  },
  confirmGhostButtonLabel: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: labelFont,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.xl,
    borderWidth: 1,
    gap: mobileTokens.spacing[2],
    marginHorizontal: mobileTokens.spacing[5],
    padding: mobileTokens.spacing[4],
  },
  emptyTitle: {
    color: mobileTokens.color.paper,
    fontFamily: bodyFont,
    fontSize: 20,
    fontWeight: "700",
  },
  emptyBody: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: bodyFont,
    fontSize: 16,
    lineHeight: 24,
  },
  bottomActions: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.divider,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    gap: mobileTokens.spacing[4],
    minHeight: 96,
    justifyContent: "space-between",
    left: 0,
    paddingBottom: mobileTokens.spacing[4],
    paddingHorizontal: mobileTokens.spacing[4],
    paddingTop: mobileTokens.spacing[3],
    position: "absolute",
    right: 0,
  },
  bottomActionCopy: {
    flex: 1,
    gap: mobileTokens.spacing[2],
  },
  bottomActionEyebrow: {
    color: mobileTokens.color.gold,
    fontFamily: labelFont,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    textTransform: "uppercase",
  },
  bottomActionTitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 20,
  },
  startPlanButton: {
    alignItems: "center",
    backgroundColor: "#6F6100",
    borderRadius: mobileTokens.radius.full,
    flexDirection: "row",
    gap: mobileTokens.spacing[2],
    justifyContent: "center",
    minHeight: 44,
    minWidth: 160,
    paddingHorizontal: mobileTokens.spacing[4],
  },
  startPlanButtonLabel: {
    color: mobileTokens.color.paper,
    fontFamily: labelFont,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  disabledAction: {
    opacity: 0.5,
  },
});
