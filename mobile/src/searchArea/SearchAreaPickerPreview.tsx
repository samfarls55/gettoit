import { useReducer, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { mobileTokens } from "../design/tokens";
import type {
  DensityPreviewPin,
  SearchArea,
  SearchAreaAdapter,
} from "./searchArea";
import {
  cancelSearchAreaDraft,
  commitSearchAreaDraft,
  createSearchAreaDraft,
  deterministicSearchAreaAdapter,
  isSearchAreaDraftDirty,
  radiusLabel,
  searchAreaDraftReducer,
} from "./searchArea";

type SearchAreaPickerPreviewProps = {
  adapter?: SearchAreaAdapter;
  initialSearchArea?: SearchArea | null;
  onCancel?: () => void;
  onCommit?: (searchArea: SearchArea) => void;
};

export function SearchAreaPickerPreview({
  adapter = deterministicSearchAreaAdapter,
  initialSearchArea = null,
  onCancel,
  onCommit,
}: SearchAreaPickerPreviewProps) {
  const [draft, dispatch] = useReducer(
    searchAreaDraftReducer,
    initialSearchArea,
    createSearchAreaDraft,
  );
  const [query, setQuery] = useState("");
  const [pins, setPins] = useState<DensityPreviewPin[]>([]);
  const [showDirtyPrompt, setShowDirtyPrompt] = useState(false);
  const dirty = isSearchAreaDraftDirty(draft, initialSearchArea);

  const commitDraft = () => {
    onCommit?.(commitSearchAreaDraft(draft));
  };

  const closeEditor = () => {
    if (dirty) {
      setShowDirtyPrompt(true);
      return;
    }

    onCancel?.();
  };

  const refreshPins = async (searchArea: SearchArea) => {
    try {
      const nextPins = await adapter.fetchDensityPreviewPins(searchArea);
      setPins(nextPins.slice(0, 20));
    } catch {
      setPins([]);
    }
  };

  const jumpToCurrentLocation = async () => {
    const center = await adapter.getCurrentLocation();
    const nextDraft = { ...draft, center };
    dispatch({ type: "jumpToCurrentLocation", center });
    await refreshPins(nextDraft);
  };

  const jumpToTypedPlace = async () => {
    const center = await adapter.searchPlace(query);
    const nextDraft = { ...draft, center };
    dispatch({ type: "jumpToPlace", center });
    await refreshPins(nextDraft);
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={closeEditor} style={styles.textButton}>
          <Text style={styles.textButtonLabel}>Close</Text>
        </Pressable>
        <Text style={styles.eyebrow}>Search area</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="Search area jump"
          onChangeText={setQuery}
          placeholder="Search city, neighborhood, or address"
          placeholderTextColor="rgba(255,255,255,0.58)"
          style={styles.searchInput}
          value={query}
        />
        <Pressable accessibilityRole="button" onPress={jumpToTypedPlace} style={styles.jumpButton}>
          <Text style={styles.jumpButtonLabel}>Jump</Text>
        </Pressable>
      </View>

      <View style={styles.mapMock}>
        <Text style={styles.mapLabel}>{draft.center.label}</Text>
        <Text style={styles.coordinateText}>
          {draft.center.latitude.toFixed(4)}, {draft.center.longitude.toFixed(4)}
        </Text>
        <View style={styles.circle}>
          <Text style={styles.circleText}>Selected circle</Text>
        </View>
        <Text style={styles.previewText}>Preview pins: {pins.length}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          onPress={() => dispatch({ type: "stepRadiusDown" })}
          style={styles.stepButton}
        >
          <Text style={styles.stepButtonLabel}>-</Text>
        </Pressable>
        <Text style={styles.radiusBadge}>{radiusLabel(draft.radiusMiles)}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => dispatch({ type: "stepRadiusUp" })}
          style={styles.stepButton}
        >
          <Text style={styles.stepButtonLabel}>+</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={jumpToCurrentLocation}
        style={styles.currentLocationButton}
      >
        <Text style={styles.currentLocationLabel}>Use current location</Text>
      </Pressable>

      {showDirtyPrompt ? (
        <View style={styles.dirtyPrompt}>
          <Text style={styles.promptTitle}>Unsaved Search area</Text>
          <View style={styles.promptActions}>
            <Pressable accessibilityRole="button" onPress={commitDraft} style={styles.promptButton}>
              <Text style={styles.promptButtonLabel}>Use this area</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                cancelSearchAreaDraft(draft, initialSearchArea);
                onCancel?.();
              }}
              style={styles.promptButton}
            >
              <Text style={styles.promptButtonLabel}>Discard changes</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" onPress={commitDraft} style={styles.primaryButton}>
        <Text style={styles.primaryButtonLabel}>USE THIS AREA</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: mobileTokens.spacing[4],
    padding: mobileTokens.spacing[4],
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  textButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  textButtonLabel: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
  },
  eyebrow: {
    color: mobileTokens.color.sun,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    textTransform: "uppercase",
  },
  searchRow: {
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
  },
  searchInput: {
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    color: mobileTokens.color.paper,
    flex: 1,
    fontSize: mobileTokens.typography.body.size,
    minHeight: 48,
    paddingHorizontal: mobileTokens.spacing[4],
  },
  jumpButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.paper,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: mobileTokens.spacing[4],
  },
  jumpButtonLabel: {
    color: mobileTokens.color.ink,
    fontWeight: "800",
  },
  mapMock: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 260,
    overflow: "hidden",
    padding: mobileTokens.spacing[4],
  },
  mapLabel: {
    color: mobileTokens.color.paper,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  coordinateText: {
    color: mobileTokens.color.textSecondaryOnGradient,
    marginTop: mobileTokens.spacing[3],
  },
  circle: {
    alignItems: "center",
    aspectRatio: 1,
    borderColor: mobileTokens.color.sun,
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: "center",
    marginTop: mobileTokens.spacing[4],
    width: "54%",
  },
  circleText: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontWeight: "700",
  },
  previewText: {
    color: mobileTokens.color.paper,
    fontWeight: "700",
    marginTop: mobileTokens.spacing[4],
  },
  controls: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    justifyContent: "center",
  },
  stepButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 8,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  stepButtonLabel: {
    color: mobileTokens.color.paper,
    fontSize: 22,
    fontWeight: "900",
  },
  radiusBadge: {
    backgroundColor: mobileTokens.color.paper,
    borderRadius: 8,
    color: mobileTokens.color.ink,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: "900",
    minHeight: 40,
    paddingHorizontal: mobileTokens.spacing[4],
    paddingVertical: mobileTokens.spacing[3],
    textAlign: "center",
  },
  currentLocationButton: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
  },
  currentLocationLabel: {
    color: mobileTokens.color.paper,
    fontWeight: "800",
  },
  dirtyPrompt: {
    backgroundColor: "rgba(20,20,30,0.92)",
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 8,
    borderWidth: 1,
    padding: mobileTokens.spacing[4],
  },
  promptTitle: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
    marginBottom: mobileTokens.spacing[3],
  },
  promptActions: {
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
  },
  promptButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  promptButtonLabel: {
    color: mobileTokens.color.sun,
    fontWeight: "800",
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.paper,
    borderRadius: 8,
    minHeight: 52,
    justifyContent: "center",
  },
  primaryButtonLabel: {
    color: mobileTokens.color.ink,
    fontWeight: "900",
  },
});
