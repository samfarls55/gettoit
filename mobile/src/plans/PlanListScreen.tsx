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

type PlanBucketKey = keyof PlanListSnapshot;
type LivePlanBucketKey = Exclude<PlanBucketKey, "history">;

type PlanBucket = {
  key: PlanBucketKey;
  title: string;
};

type LivePlanBucket = {
  key: LivePlanBucketKey;
  title: string;
  actionLabel: string;
  stateBody: string;
};

type PlanBucketWithPlans = LivePlanBucket & {
  plans: PlanListItem[];
};

type NextUpPlan = {
  bucket: LivePlanBucket;
  plan: PlanListItem;
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

const livePlanBuckets: LivePlanBucket[] = [
  {
    key: "created",
    title: "Setup needed",
    actionLabel: "Finish setup",
    stateBody: "Lock the basics, then send the quiz link.",
  },
  {
    key: "joined",
    title: "Answer needed",
    actionLabel: "Answer quiz",
    stateBody: "Your answers unblock the group's pick.",
  },
  {
    key: "decided",
    title: "Verdict ready",
    actionLabel: "Open pick",
    stateBody: "Review the verdict and share the plan.",
  },
];

const pastPlanBucket: PlanBucket = { key: "history", title: "Closed" };
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
  const nextUp = getNextUpPlan(liveBuckets);
  const secondaryLiveBuckets: PlanBucketWithPlans[] = [];
  for (const bucket of liveBuckets) {
    const secondaryPlans = bucket.plans.filter(
      (plan) => plan.id !== nextUp?.plan.id,
    );

    if (secondaryPlans.length > 0) {
      secondaryLiveBuckets.push({ ...bucket, plans: secondaryPlans });
    }
  }
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
        <View
          accessibilityLabel="Account avatar"
          accessibilityRole="image"
          style={styles.avatarButton}
        >
          <Image
            accessibilityElementsHidden
            importantForAccessibility="no"
            source={{ uri: avatarUri }}
            style={styles.avatarImage}
          />
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
          <Text style={styles.subtitle}>The next decision lives here.</Text>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {nextUp ? (
          <NextUpPlanCard
            bucket={nextUp.bucket}
            deleteError={
              planPendingDelete?.id === nextUp.plan.id ? deleteError : null
            }
            isDeleting={deletingPlanId === nextUp.plan.id}
            onOpenPlan={onOpenPlan}
            onConfirmDelete={handleConfirmDelete}
            onRequestDelete={setPlanPendingDelete}
            pendingDelete={planPendingDelete?.id === nextUp.plan.id}
            plan={nextUp.plan}
          />
        ) : null}

        {secondaryLiveBuckets.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, styles.sectionLabelInset]}>
              Other active Plans
            </Text>
            <View
              accessibilityLabel="Other active Plans"
              style={styles.liveList}
            >
              {secondaryLiveBuckets.flatMap((bucket) =>
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
            </View>
          </View>
        ) : null}

        <View style={styles.pastSection}>
          <Text style={styles.sectionLabel}>Closed Plans</Text>
          {pastPlans.length > 0 ? (
            <View style={styles.pastList}>
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
            <Text style={styles.emptyBody}>Closed Plans will land here.</Text>
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
        <View
          aria-selected
          accessibilityLabel="Plans current section"
          accessibilityRole="tab"
          accessibilityState={{ selected: true }}
          style={styles.bottomActionCopy}
        >
          <Text style={styles.bottomActionEyebrow}>Plans</Text>
          <Text style={styles.bottomActionTitle}>Ready when you are.</Text>
        </View>
        <Pressable
          accessibilityLabel="Create group Plan"
          accessibilityRole="button"
          onPress={handleCreateGroupPlan}
          style={styles.startPlanButton}
        >
          <DashboardIcon
            color={mobileTokens.color.ink}
            fallback="+"
            name="add"
            size={20}
          />
          <Text style={styles.startPlanButtonLabel}>New Plan</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NextUpPlanCard({
  bucket,
  deleteError,
  isDeleting,
  onConfirmDelete,
  onOpenPlan,
  onRequestDelete,
  pendingDelete,
  plan,
}: {
  bucket: LivePlanBucket;
  deleteError: string | null;
  isDeleting: boolean;
  onConfirmDelete: (plan: PlanListItem) => Promise<void> | void;
  onOpenPlan?: (plan: PlanListItem) => void;
  onRequestDelete: (plan: PlanListItem | null) => void;
  pendingDelete: boolean;
  plan: PlanListItem;
}) {
  return (
    <View style={styles.nextUpSection}>
      <Text style={styles.nextUpEyebrow}>Needs you now</Text>
      <View style={styles.nextUpCard}>
        <View style={styles.nextUpHeader}>
          <View style={styles.nextUpTitleGroup}>
            <Text numberOfLines={2} style={styles.nextUpTitle}>
              {plan.title}
            </Text>
          </View>
          <View style={styles.cardHeaderActions}>
            <View style={styles.statusChip}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{bucket.title}</Text>
            </View>
            {bucket.key === "created" ? (
              <DeletePlanButton
                bucket={bucket}
                isDeleting={isDeleting}
                onRequestDelete={onRequestDelete}
                plan={plan}
              />
            ) : null}
          </View>
        </View>
        <Text numberOfLines={2} style={styles.nextUpSubtitle}>
          {bucket.stateBody}
        </Text>
        <Pressable
          accessibilityLabel={`Open Needs you now Plan ${plan.title}`}
          accessibilityRole="button"
          onPress={() => onOpenPlan?.(plan)}
          style={[styles.voteButton, styles.nextUpAction]}
        >
          <Text style={[styles.voteButtonLabel, styles.nextUpActionLabel]}>
            {bucket.actionLabel}
          </Text>
          <DashboardIcon
            color={mobileTokens.color.ink}
            fallback=">"
            name="arrow_forward"
            size={20}
          />
        </Pressable>
      </View>
      {pendingDelete ? (
        <DeleteConfirmationCard
          deleteError={deleteError}
          isDeleting={isDeleting}
          onConfirmDelete={onConfirmDelete}
          onRequestDelete={onRequestDelete}
          plan={plan}
        />
      ) : null}
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
  bucket: LivePlanBucket;
  deleteError: string | null;
  isDeleting: boolean;
  onConfirmDelete: (plan: PlanListItem) => Promise<void> | void;
  onOpenPlan?: (plan: PlanListItem) => void;
  onRequestDelete: (plan: PlanListItem | null) => void;
  pendingDelete: boolean;
  plan: PlanListItem;
}) {
  return (
    <View style={styles.liveCardShell}>
      <View style={styles.liveCard}>
        <View style={styles.liveCardOpenArea}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleGroup}>
              <Text style={styles.bucketTitle}>{bucket.title}</Text>
              <Text numberOfLines={2} style={styles.planTitle}>
                {plan.title}
              </Text>
            </View>
            <View style={styles.cardHeaderActions}>
              {bucket.key === "created" ? (
                <DeletePlanButton
                  bucket={bucket}
                  isDeleting={isDeleting}
                  onRequestDelete={onRequestDelete}
                  plan={plan}
                />
              ) : null}
            </View>
          </View>

          <Text numberOfLines={2} style={styles.stateBody}>
            {bucket.stateBody}
          </Text>
          <Pressable
            accessibilityLabel={`Open ${bucket.title} Plan ${plan.title}`}
            accessibilityRole="button"
            onPress={() => onOpenPlan?.(plan)}
            style={styles.voteButton}
          >
            <Text style={styles.voteButtonLabel}>{bucket.actionLabel}</Text>
          </Pressable>
        </View>
      </View>

      {pendingDelete ? (
        <DeleteConfirmationCard
          deleteError={deleteError}
          isDeleting={isDeleting}
          onConfirmDelete={onConfirmDelete}
          onRequestDelete={onRequestDelete}
          plan={plan}
        />
      ) : null}
    </View>
  );
}

function DeletePlanButton({
  bucket,
  isDeleting,
  onRequestDelete,
  plan,
}: {
  bucket: LivePlanBucket;
  isDeleting: boolean;
  onRequestDelete: (plan: PlanListItem | null) => void;
  plan: PlanListItem;
}) {
  return (
    <Pressable
      accessibilityLabel={`Delete ${bucket.title} Plan ${plan.title}`}
      accessibilityRole="button"
      disabled={isDeleting}
      hitSlop={8}
      onPress={() => onRequestDelete(plan)}
      style={[styles.deleteIconButton, isDeleting && styles.disabledAction]}
    >
      <DashboardIcon
        color={mobileTokens.color.danger}
        fallback="x"
        name="delete"
        size={20}
      />
    </Pressable>
  );
}

function DeleteConfirmationCard({
  deleteError,
  isDeleting,
  onConfirmDelete,
  onRequestDelete,
  plan,
}: {
  deleteError: string | null;
  isDeleting: boolean;
  onConfirmDelete: (plan: PlanListItem) => Promise<void> | void;
  onRequestDelete: (plan: PlanListItem | null) => void;
  plan: PlanListItem;
}) {
  return (
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
  );
}

function getNextUpPlan(liveBuckets: PlanBucketWithPlans[]): NextUpPlan | null {
  const bucket = liveBuckets.find((planBucket) => planBucket.plans.length > 0);

  if (!bucket) {
    return null;
  }

  return { bucket, plan: bucket.plans[0] };
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
      <View style={styles.pastIcon}>
        <DashboardIcon fallback="*" name="event_note" size={18} />
      </View>
      <View style={styles.pastCardCopy}>
        <Text numberOfLines={1} style={styles.pastCardTitle}>
          {plan.title}
        </Text>
        <Text style={styles.pastBucket}>{bucket.title}</Text>
        <Text numberOfLines={1} style={styles.pastMeta}>
          {plan.subtitle}
        </Text>
      </View>
      <DashboardIcon
        color={mobileTokens.color.textSecondaryOnGradient}
        fallback=">"
        name="chevron_right"
        size={22}
      />
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
    height: 44,
    justifyContent: "center",
    width: 44,
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
    fontWeight: "700",
    lineHeight: 36,
  },
  avatarButton: {
    alignItems: "center",
    borderRadius: mobileTokens.radius.full,
    height: 44,
    justifyContent: "center",
    overflow: "hidden",
    width: 44,
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
    paddingBottom: 160,
    paddingTop: mobileTokens.spacing[10],
  },
  hero: {
    gap: mobileTokens.spacing[2],
    paddingHorizontal: mobileTokens.spacing[5],
  },
  title: {
    color: mobileTokens.color.paper,
    fontFamily: dashboardFont,
    fontSize: mobileTokens.typography.display.size,
    fontWeight: mobileTokens.typography.display.weight,
    lineHeight: mobileTokens.typography.display.lineHeight,
  },
  subtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: bodyFont,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  notice: {
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.default,
    borderWidth: 1,
    color: mobileTokens.color.sun,
    fontFamily: bodyFont,
    fontSize: 14,
    marginHorizontal: mobileTokens.spacing[5],
    padding: mobileTokens.spacing[3],
  },
  nextUpSection: {
    gap: mobileTokens.spacing[3],
    paddingHorizontal: mobileTokens.spacing[5],
  },
  nextUpEyebrow: {
    color: mobileTokens.color.gold,
    fontFamily: labelFont,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  nextUpCard: {
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.gold,
    borderRadius: mobileTokens.radius.default,
    borderWidth: 1,
    gap: mobileTokens.spacing[4],
    minHeight: 184,
    padding: mobileTokens.spacing[5],
  },
  nextUpHeader: {
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    justifyContent: "space-between",
  },
  nextUpTitleGroup: {
    flex: 1,
    gap: mobileTokens.spacing[2],
  },
  nextUpTitle: {
    color: mobileTokens.color.paper,
    fontFamily: bodyFont,
    fontSize: mobileTokens.typography.title.size,
    fontWeight: mobileTokens.typography.title.weight,
    lineHeight: mobileTokens.typography.title.lineHeight,
  },
  nextUpSubtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: bodyFont,
    fontSize: 16,
    lineHeight: 24,
  },
  nextUpAction: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: mobileTokens.spacing[2],
    minHeight: 48,
    paddingHorizontal: mobileTokens.spacing[4],
  },
  nextUpActionLabel: {
    fontWeight: "700",
  },
  section: {
    gap: mobileTokens.spacing[2],
  },
  sectionLabel: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: labelFont,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  sectionLabelInset: {
    paddingHorizontal: mobileTokens.spacing[5],
  },
  liveList: {
    gap: mobileTokens.spacing[4],
    paddingHorizontal: mobileTokens.spacing[5],
  },
  liveCardShell: {
    gap: mobileTokens.spacing[3],
    width: "100%",
  },
  liveCard: {
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.default,
    borderTopColor: mobileTokens.color.glassTop,
    borderWidth: 1,
    minHeight: 168,
  },
  liveCardOpenArea: {
    gap: mobileTokens.spacing[4],
    minHeight: 168,
    padding: mobileTokens.spacing[4],
  },
  cardHeader: {
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    justifyContent: "space-between",
  },
  cardHeaderActions: {
    alignItems: "flex-end",
    gap: mobileTokens.spacing[2],
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
    fontSize: mobileTokens.typography.title.size,
    fontWeight: mobileTokens.typography.title.weight,
    lineHeight: mobileTokens.typography.title.lineHeight,
  },
  statusChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "transparent",
    borderColor: mobileTokens.color.copper,
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
    color: mobileTokens.color.copper,
    fontFamily: labelFont,
    fontSize: 12,
    fontWeight: "500",
  },
  deleteIconButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.danger,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  stateBody: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 20,
  },
  voteButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.gold,
    borderRadius: mobileTokens.radius.md,
    justifyContent: "center",
    marginTop: "auto",
    minHeight: 40,
    paddingHorizontal: mobileTokens.spacing[4],
  },
  voteButtonLabel: {
    color: mobileTokens.color.ink,
    fontFamily: labelFont,
    fontSize: 14,
    fontWeight: "700",
  },
  pastSection: {
    gap: mobileTokens.spacing[4],
    paddingHorizontal: mobileTokens.spacing[5],
  },
  pastList: {
    gap: mobileTokens.spacing[3],
  },
  pastCard: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.default,
    borderTopColor: mobileTokens.color.glassTop,
    borderWidth: 1,
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    minHeight: 88,
    padding: mobileTokens.spacing[3],
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
  pastCardCopy: {
    flex: 1,
    gap: 2,
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
    borderRadius: mobileTokens.radius.default,
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
    color: mobileTokens.color.ink,
    fontFamily: labelFont,
    fontSize: 12,
    fontWeight: "700",
  },
  confirmGhostButton: {
    alignItems: "center",
    borderColor: mobileTokens.color.copper,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: mobileTokens.spacing[3],
  },
  confirmGhostButtonLabel: {
    color: mobileTokens.color.copper,
    fontFamily: labelFont,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.default,
    borderTopColor: mobileTokens.color.glassTop,
    borderWidth: 1,
    gap: mobileTokens.spacing[2],
    marginHorizontal: mobileTokens.spacing[5],
    padding: mobileTokens.spacing[4],
  },
  emptyTitle: {
    color: mobileTokens.color.paper,
    fontFamily: bodyFont,
    fontSize: mobileTokens.typography.title.size,
    fontWeight: mobileTokens.typography.title.weight,
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
    borderTopLeftRadius: mobileTokens.radius.default,
    borderTopRightRadius: mobileTokens.radius.default,
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
    backgroundColor: mobileTokens.color.gold,
    borderRadius: mobileTokens.radius.md,
    flexDirection: "row",
    gap: mobileTokens.spacing[2],
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: mobileTokens.spacing[3],
  },
  startPlanButtonLabel: {
    color: mobileTokens.color.ink,
    fontFamily: labelFont,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  disabledAction: {
    opacity: 0.5,
  },
});
