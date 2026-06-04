import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { mobileTokens } from "../design/tokens";
import { SearchAreaPickerPreview } from "../searchArea/SearchAreaPickerPreview";
import type {
  PlanMealTime,
  PlanParticipantScope,
  PlanServiceShape,
  PlanSetup,
} from "./planRepository";

type SetupScreenMode = "create" | "edit";

type SetupScreenProps = {
  initialPlan: PlanSetup;
  mode: SetupScreenMode;
  onLaunch: (plan: PlanSetup) => Promise<void>;
  onSave: (plan: PlanSetup) => Promise<void>;
};

type ChipOption<TValue extends string> = {
  label: string;
  value: TValue;
};

const participantOptions: ChipOption<PlanParticipantScope>[] = [
  { label: "Just me", value: "solo" },
  { label: "Two of us", value: "duo" },
  { label: "A group", value: "group" },
];

const mealTimeOptions: ChipOption<PlanMealTime>[] = [
  { label: "Breakfast", value: "breakfast" },
  { label: "Lunch", value: "lunch" },
  { label: "Dinner", value: "dinner" },
  { label: "Late night", value: "lateNight" },
];

const serviceOptions: ChipOption<PlanServiceShape>[] = [
  { label: "Dine in", value: "dineIn" },
  { label: "Outdoor seating", value: "outdoor" },
  { label: "Takeout", value: "takeout" },
  { label: "Delivery", value: "delivery" },
];

function primaryLabel(participantScope: PlanParticipantScope): string {
  return participantScope === "solo" ? "Start the quiz" : "Drop the invite link";
}

function secondaryLabel(mode: SetupScreenMode): string {
  return mode === "edit" ? "SAVE CHANGES" : "SAVE FOR LATER";
}

export function SetupScreen({
  initialPlan,
  mode,
  onLaunch,
  onSave,
}: SetupScreenProps) {
  const [plan, setPlan] = useState<PlanSetup>(initialPlan);
  const [isSearchAreaOpen, setIsSearchAreaOpen] = useState(false);
  const [searchAreaError, setSearchAreaError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasName = plan.name.trim().length > 0;
  const canSubmit = hasName && !isSubmitting;

  const updatePlan = (patch: Partial<PlanSetup>) => {
    setPlan((current) => ({ ...current, ...patch }));
  };

  const save = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({ ...plan, name: plan.name.trim() });
    } finally {
      setIsSubmitting(false);
    }
  };

  const launch = async () => {
    if (!canSubmit) {
      return;
    }

    if (!plan.searchArea) {
      setSearchAreaError(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await onLaunch({ ...plan, name: plan.name.trim() });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSearchAreaOpen) {
    return (
      <SearchAreaPickerPreview
        initialSearchArea={plan.searchArea}
        onCancel={() => setIsSearchAreaOpen(false)}
        onCommit={(searchArea) => {
          updatePlan({ searchArea });
          setSearchAreaError(false);
          setIsSearchAreaOpen(false);
        }}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.root}>
      <Text style={styles.eyebrow}>GetToIt</Text>
      <Text style={styles.title}>
        {mode === "edit" ? "Edit your plan" : "Start a new plan"}
      </Text>
      <Text style={styles.subtitle}>
        One screen. Set it once. Share when you're ready.
      </Text>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.fieldLabel}>Name this plan</Text>
          <Text style={styles.hint}>Up to 40 characters</Text>
        </View>
        <TextInput
          accessibilityLabel="Name this plan"
          maxLength={40}
          onChangeText={(name) => updatePlan({ name })}
          placeholder="Name this plan"
          placeholderTextColor={mobileTokens.color.textTertiaryOnGradient}
          style={styles.input}
          value={plan.name}
        />
      </View>

      <ChipGroup
        label="Who's coming"
        onSelect={(participantScope) => updatePlan({ participantScope })}
        options={participantOptions}
        value={plan.participantScope}
      />

      <View style={styles.field}>
        <Text style={styles.sectionLabel}>Search area</Text>
        <Pressable
          accessibilityLabel={
            plan.searchArea
              ? `Search area, ${plan.searchArea.center.label}, ${plan.searchArea.radiusMiles.toFixed(1)} miles`
              : "Set search area"
          }
          accessibilityRole="button"
          onPress={() => setIsSearchAreaOpen(true)}
          style={styles.searchAreaChip}
        >
          <Text style={styles.searchAreaMain}>
            {plan.searchArea?.center.label ?? "Set search area"}
          </Text>
          <Text style={styles.searchAreaSupport}>
            {plan.searchArea
              ? `Search area - ${plan.searchArea.radiusMiles.toFixed(1)} mi`
              : "Tap to choose on map"}
          </Text>
        </Pressable>
        {searchAreaError ? (
          <Text style={styles.inlineError}>Set search area before launch.</Text>
        ) : null}
      </View>

      <ChipGroup
        label="When are you eating"
        onSelect={(mealTime) => updatePlan({ mealTime })}
        options={mealTimeOptions}
        value={plan.mealTime}
      />

      <ChipGroup
        label="How you want to eat"
        onSelect={(serviceShape) => updatePlan({ serviceShape })}
        options={serviceOptions}
        value={plan.serviceShape}
      />

      <View style={styles.dock}>
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={launch}
          style={[styles.primaryButton, !canSubmit && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonLabel}>
            {primaryLabel(plan.participantScope)}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={save}
          style={styles.textButton}
        >
          <Text style={[styles.textButtonLabel, !canSubmit && styles.disabledText]}>
            {secondaryLabel(mode)}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ChipGroup<TValue extends string>({
  label,
  onSelect,
  options,
  value,
}: {
  label: string;
  onSelect: (value: TValue) => void;
  options: ChipOption<TValue>[];
  value: TValue;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[styles.chip, selected && styles.selectedChip]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  selected && styles.selectedChipLabel,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileTokens.color.ink,
  },
  content: {
    gap: mobileTokens.spacing[4],
    padding: mobileTokens.spacing[8],
    paddingTop: 72,
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
  field: {
    gap: mobileTokens.spacing[3],
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fieldLabel: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: 14,
    fontWeight: "700",
  },
  hint: {
    color: mobileTokens.color.textTertiaryOnGradient,
    fontSize: 14,
  },
  sectionLabel: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  input: {
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 8,
    borderWidth: 1,
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    minHeight: 56,
    paddingHorizontal: mobileTokens.spacing[4],
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileTokens.spacing[3],
  },
  chip: {
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: mobileTokens.spacing[4],
  },
  selectedChip: {
    backgroundColor: mobileTokens.color.sun,
    borderColor: mobileTokens.color.sun,
  },
  chipLabel: {
    color: mobileTokens.color.paper,
    fontSize: 14,
    fontWeight: "700",
  },
  selectedChipLabel: {
    color: mobileTokens.color.ink,
  },
  searchAreaChip: {
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 8,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    minHeight: 64,
    justifyContent: "center",
    padding: mobileTokens.spacing[4],
  },
  searchAreaMain: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
  },
  searchAreaSupport: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: 13,
    fontWeight: "700",
  },
  inlineError: {
    color: mobileTokens.color.sun,
    fontSize: 13,
    fontWeight: "700",
  },
  dock: {
    gap: mobileTokens.spacing[3],
    paddingTop: mobileTokens.spacing[4],
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.paper,
    borderRadius: 999,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: mobileTokens.spacing[4],
  },
  primaryButtonLabel: {
    color: mobileTokens.color.ink,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  textButton: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  textButtonLabel: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 1.5,
  },
  disabledButton: {
    opacity: 0.45,
  },
  disabledText: {
    opacity: 0.45,
  },
});
