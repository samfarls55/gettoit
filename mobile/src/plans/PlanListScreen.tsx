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
  PlanMealTime,
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
const recentPastPlanLimit = 3;

type WebPressableState = {
  focused?: boolean;
  pressed: boolean;
};

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
  const [showAllPastPlans, setShowAllPastPlans] = useState(false);
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
  const visiblePastPlans = showAllPastPlans
    ? pastPlans
    : pastPlans.slice(0, recentPastPlanLimit);
  const hiddenPastPlanCount = Math.max(
    pastPlans.length - visiblePastPlans.length,
    0,
  );
  const secondaryLivePlanCount = secondaryLiveBuckets.reduce(
    (total, bucket) => total + bucket.plans.length,
    0,
  );
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
      <View role="banner" style={styles.topAppBar}>
        <Pressable
          accessibilityLabel="Open Settings"
          accessibilityRole="button"
          onPress={onOpenSettings}
          style={(state) => [
            styles.iconButton,
            state.pressed && styles.pressedAction,
            webFocusRing(state),
          ]}
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
        accessibilityLabel="Plans dashboard"
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        role="main"
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
      >
        <View style={styles.hero}>
          <Text accessibilityRole="header" role="heading" style={styles.title}>
            Your Plans
          </Text>
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
          <View
            accessibilityLabel={`Other active Plans, ${formatPlanCount(
              secondaryLivePlanCount,
            )}`}
            role="region"
            style={styles.section}
          >
            <View style={[styles.sectionHeader, styles.sectionHeaderInset]}>
              <Text
                accessibilityRole="header"
                role="heading"
                style={styles.sectionLabel}
              >
                Other active Plans
              </Text>
              <Text style={styles.sectionCount}>
                {formatPlanCount(secondaryLivePlanCount)}
              </Text>
            </View>
            <View
              accessibilityLabel={`Other active Plans list, ${formatPlanCount(
                secondaryLivePlanCount,
              )}`}
              role="list"
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

        <View
          accessibilityLabel={`Closed Plans, showing ${visiblePastPlans.length} of ${pastPlans.length}`}
          role="region"
          style={styles.pastSection}
        >
          <View style={styles.sectionHeader}>
            <Text
              accessibilityRole="header"
              role="heading"
              style={styles.sectionLabel}
            >
              Closed Plans
            </Text>
            {pastPlans.length > 0 ? (
              <Text style={styles.sectionCount}>
                {formatPlanCount(pastPlans.length)}
              </Text>
            ) : null}
          </View>
          {pastPlans.length > 0 ? (
            <>
              <View
                accessibilityLabel={`Closed Plans list, showing ${visiblePastPlans.length} of ${pastPlans.length}`}
                role="list"
                style={styles.pastList}
              >
                {visiblePastPlans.map((plan) => (
                  <PastPlanCard
                    bucket={pastPlanBucket}
                    key={plan.id}
                    onOpenPlan={onOpenPlan}
                    plan={plan}
                  />
                ))}
              </View>
              {hiddenPastPlanCount > 0 || showAllPastPlans ? (
                <Pressable
                  accessibilityHint="Expands or collapses the closed Plans list"
                  accessibilityLabel={
                    showAllPastPlans
                      ? "Show recent closed Plans"
                      : `See all ${pastPlans.length} closed Plans`
                  }
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAllPastPlans }}
                  aria-expanded={showAllPastPlans}
                  onPress={() =>
                    setShowAllPastPlans((isShowingAll) => !isShowingAll)
                  }
                  style={(state) => [
                    styles.archiveToggleButton,
                    state.pressed && styles.pressedAction,
                    webFocusRing(state),
                  ]}
                >
                  <Text style={styles.archiveToggleButtonLabel}>
                    {showAllPastPlans
                      ? "Show recent closed Plans"
                      : `See all ${pastPlans.length} closed Plans`}
                  </Text>
                  <DashboardIcon
                    color={mobileTokens.color.copper}
                    fallback={showAllPastPlans ? "^" : "v"}
                    name={showAllPastPlans ? "expand_less" : "expand_more"}
                    size={20}
                  />
                </Pressable>
              ) : null}
            </>
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

      <View
        accessibilityLabel="Plan actions"
        role="toolbar"
        style={styles.bottomActions}
      >
        <Pressable
          accessibilityLabel="Create group Plan"
          accessibilityRole="button"
          onPress={handleCreateGroupPlan}
          style={(state) => [
            styles.startPlanButton,
            state.pressed && styles.pressedAction,
            webFocusRing(state),
          ]}
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
    <View
      accessibilityLabel={`Needs you now, ${bucket.title} Plan ${plan.title}`}
      role="region"
      style={styles.nextUpSection}
    >
      <Text
        accessibilityRole="header"
        role="heading"
        style={styles.nextUpEyebrow}
      >
        Needs you now
      </Text>
      <Text style={styles.nextUpReason}>
        First active Plan waiting on your action.
      </Text>
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
          style={(state) => [
            styles.voteButton,
            styles.nextUpAction,
            state.pressed && styles.pressedAction,
            webFocusRing(state),
          ]}
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
    <View role="listitem" style={styles.liveCardShell}>
      <View style={styles.liveCard}>
        <View style={styles.liveRowCopy}>
          <Text style={styles.bucketTitle}>{bucket.title}</Text>
          <Text numberOfLines={1} style={styles.planTitle}>
            {plan.title}
          </Text>
          <Text numberOfLines={1} style={styles.stateBody}>
            {bucket.stateBody}
          </Text>
        </View>

        <View style={styles.liveRowActions}>
          {bucket.key === "created" ? (
            <DeletePlanButton
              bucket={bucket}
              isDeleting={isDeleting}
              onRequestDelete={onRequestDelete}
              plan={plan}
            />
          ) : null}
          <Pressable
            accessibilityLabel={`Open ${bucket.title} Plan ${plan.title}`}
            accessibilityRole="button"
            onPress={() => onOpenPlan?.(plan)}
            style={(state) => [
              styles.secondaryOpenButton,
              state.pressed && styles.pressedAction,
              webFocusRing(state),
            ]}
          >
            <Text style={styles.secondaryOpenButtonLabel}>
              {bucket.actionLabel}
            </Text>
            <DashboardIcon
              color={mobileTokens.color.copper}
              fallback=">"
              name="chevron_right"
              size={18}
            />
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
      style={(state) => [
        styles.deleteIconButton,
        state.pressed && styles.pressedAction,
        webFocusRing(state),
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
          style={(state) => [
            styles.confirmGhostButton,
            state.pressed && styles.pressedAction,
            webFocusRing(state),
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
          style={(state) => [
            styles.confirmDeleteButton,
            state.pressed && styles.pressedAction,
            webFocusRing(state),
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

function webFocusRing(state: { pressed: boolean }) {
  return isWeb && (state as WebPressableState).focused
    ? styles.webFocusRing
    : null;
}

function formatPlanCount(count: number): string {
  return `${count} Plan${count === 1 ? "" : "s"}`;
}

function formatPastPlanDetail(plan: PlanListItem): string {
  const details = [
    formatClosedDate(plan.closedAt),
    plan.setup?.searchArea?.center.label,
    plan.setup ? participantScopeLabels[plan.setup.participantScope] : null,
    plan.setup ? mealTimeLabels[plan.setup.mealTime] : null,
  ].filter((detail): detail is string => Boolean(detail));

  if (details.length > 0) {
    return details.join(" / ");
  }

  if (!isGenericPastSubtitle(plan.subtitle)) {
    return plan.subtitle;
  }

  return "Verdict record";
}

const pastDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
});

function formatClosedDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return pastDateFormatter.format(date);
}

function isGenericPastSubtitle(subtitle: string): boolean {
  const normalizedSubtitle = subtitle.trim().toLowerCase();

  return (
    normalizedSubtitle === "closed verdict" || normalizedSubtitle === "history"
  );
}

const participantScopeLabels: Record<PlanParticipantScope, string> = {
  duo: "Duo",
  group: "Group",
  solo: "Solo",
};

const mealTimeLabels: Record<PlanMealTime, string> = {
  breakfast: "Breakfast",
  dinner: "Dinner",
  lateNight: "Late night",
  lunch: "Lunch",
};

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
  const detail = formatPastPlanDetail(plan);

  return (
    <Pressable
      accessibilityHint={detail}
      accessibilityLabel={`Open ${bucket.title} Plan ${plan.title}`}
      accessibilityRole="button"
      onPress={() => onOpenPlan?.(plan)}
      style={(state) => [
        styles.pastCard,
        state.pressed && styles.pressedAction,
        webFocusRing(state),
      ]}
    >
      <View style={styles.pastIcon}>
        <DashboardIcon fallback="*" name="event_note" size={18} />
      </View>
      <View style={styles.pastCardCopy}>
        <Text numberOfLines={1} style={styles.pastCardTitle}>
          {plan.title}
        </Text>
        <Text numberOfLines={1} style={styles.pastMeta}>
          {detail}
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
    paddingBottom: 128,
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
    gap: mobileTokens.spacing[2],
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
  nextUpReason: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 18,
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
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionHeaderInset: {
    paddingHorizontal: mobileTokens.spacing[5],
  },
  sectionLabel: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: labelFont,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  sectionCount: {
    color: mobileTokens.color.outline,
    fontFamily: labelFont,
    fontSize: 12,
    lineHeight: 16,
  },
  liveList: {
    gap: mobileTokens.spacing[3],
    paddingHorizontal: mobileTokens.spacing[5],
  },
  liveCardShell: {
    gap: mobileTokens.spacing[3],
    width: "100%",
  },
  liveCard: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.default,
    borderTopColor: mobileTokens.color.glassTop,
    borderWidth: 1,
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    minHeight: 96,
    padding: mobileTokens.spacing[3],
  },
  cardHeaderActions: {
    alignItems: "flex-end",
    gap: mobileTokens.spacing[2],
  },
  liveRowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  liveRowActions: {
    alignItems: "flex-end",
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
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
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
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  stateBody: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryOpenButton: {
    alignItems: "center",
    borderColor: mobileTokens.color.copper,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: mobileTokens.spacing[2],
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: mobileTokens.spacing[3],
  },
  secondaryOpenButtonLabel: {
    color: mobileTokens.color.copper,
    fontFamily: labelFont,
    fontSize: 12,
    fontWeight: "700",
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
    gap: mobileTokens.spacing[3],
    paddingHorizontal: mobileTokens.spacing[5],
  },
  pastList: {
    gap: mobileTokens.spacing[2],
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
    minHeight: 72,
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
  pastMeta: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: bodyFont,
    fontSize: 12,
    lineHeight: 16,
  },
  archiveToggleButton: {
    alignItems: "center",
    borderColor: mobileTokens.color.copper,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: mobileTokens.spacing[2],
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: mobileTokens.spacing[3],
  },
  archiveToggleButtonLabel: {
    color: mobileTokens.color.copper,
    fontFamily: labelFont,
    fontSize: 12,
    fontWeight: "700",
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
    minHeight: 84,
    justifyContent: "space-between",
    left: 0,
    paddingBottom: mobileTokens.spacing[4],
    paddingHorizontal: mobileTokens.spacing[4],
    paddingTop: mobileTokens.spacing[3],
    position: "absolute",
    right: 0,
  },
  startPlanButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.gold,
    borderRadius: mobileTokens.radius.md,
    flex: 1,
    flexDirection: "row",
    gap: mobileTokens.spacing[2],
    justifyContent: "center",
    minHeight: 48,
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
  pressedAction: {
    opacity: 0.84,
  },
  webFocusRing: {
    outlineColor: mobileTokens.color.gold,
    outlineOffset: 3,
    outlineStyle: "solid",
    outlineWidth: 2,
  },
});
