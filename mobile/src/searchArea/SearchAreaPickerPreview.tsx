import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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
  commitSearchAreaDraft,
  createSearchAreaDraft,
  defaultSearchArea,
  isSearchAreaDraftDirty,
  radiusLabel,
  radiusMilesFromCameraDeltas,
  searchAreaDraftReducer,
  zoomForRadiusMiles,
} from "./searchArea";
import { nativeSearchAreaAdapter } from "./nativeSearchAreaAdapter";
import {
  SearchAreaMapView,
  type SearchAreaMapCameraMoveEvent,
  type SearchAreaMapHandle,
} from "./SearchAreaMapView";

type SearchAreaPickerPreviewProps = {
  adapter?: SearchAreaAdapter;
  initialSearchArea?: SearchArea | null;
  onCancel?: () => void;
  onCommit?: (searchArea: SearchArea) => void;
};

function mapCameraForSearchArea(searchArea: SearchArea) {
  return {
    coordinates: {
      latitude: searchArea.center.latitude,
      longitude: searchArea.center.longitude,
    },
    zoom: zoomForRadiusMiles(searchArea.radiusMiles),
  };
}

export function SearchAreaPickerPreview({
  adapter = nativeSearchAreaAdapter,
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
  const [actionError, setActionError] = useState<string | null>(null);
  const didSeedCurrentLocationRef = useRef(initialSearchArea !== null);
  const mapRef = useRef<SearchAreaMapHandle | null>(null);
  const dirty = isSearchAreaDraftDirty(draft, initialSearchArea);
  const cameraPosition = useMemo(() => mapCameraForSearchArea(draft), [draft]);

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

  const discardDraft = () => {
    onCancel?.();
  };

  const syncMapCamera = (searchArea: SearchArea) => {
    mapRef.current?.setSearchArea(searchArea);
  };

  useEffect(() => {
    if (didSeedCurrentLocationRef.current) {
      return;
    }

    let isCurrent = true;

    adapter
      .getCurrentLocation()
      .then((center) => {
        if (!isCurrent) {
          return;
        }

        const nextDraft = { center, radiusMiles: defaultSearchArea.radiusMiles };

        dispatch({ type: "jumpToCurrentLocation", center });
        mapRef.current?.setSearchArea(nextDraft);
      })
      .catch(() => undefined)
      .finally(() => {
        if (isCurrent) {
          didSeedCurrentLocationRef.current = true;
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [adapter]);

  useEffect(() => {
    let isCurrent = true;
    const timer = setTimeout(() => {
      adapter
        .fetchDensityPreviewPins(draft)
        .then((nextPins) => {
          if (isCurrent) {
            setPins(nextPins.slice(0, 20));
          }
        })
        .catch(() => {
          if (isCurrent) {
            setPins([]);
          }
        });
    }, 300);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [adapter, draft]);

  const jumpToCurrentLocation = async () => {
    setActionError(null);

    try {
      const center = await adapter.getCurrentLocation();
      const nextDraft = { ...draft, center };

      dispatch({ type: "jumpToCurrentLocation", center });
      syncMapCamera(nextDraft);
    } catch {
      setActionError("Current location unavailable.");
    }
  };

  const jumpToTypedPlace = async () => {
    setActionError(null);

    try {
      const center = await adapter.searchPlace(query);
      const nextDraft = { ...draft, center };

      dispatch({ type: "jumpToPlace", center });
      syncMapCamera(nextDraft);
    } catch {
      setActionError("Place not found.");
    }
  };

  const stepRadius = (direction: "down" | "up") => {
    const event =
      direction === "down"
        ? ({ type: "stepRadiusDown" } as const)
        : ({ type: "stepRadiusUp" } as const);
    const nextDraft = searchAreaDraftReducer(draft, event);

    dispatch(event);
    syncMapCamera(nextDraft);
  };

  const handleCameraMove = (event: SearchAreaMapCameraMoveEvent) => {
    dispatch({
      type: "mapCameraChanged",
      center: {
        latitude: event.latitude,
        longitude: event.longitude,
        label: "Map center",
      },
      radiusMiles: radiusMilesFromCameraDeltas(
        event.latitudeDelta,
        event.longitudeDelta,
        event.latitude,
      ),
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.mapLayer}>
        <SearchAreaMapView
          ref={mapRef}
          cameraPosition={cameraPosition}
          onCameraMove={handleCameraMove}
          pins={pins}
          searchArea={draft}
        />
      </View>

      <View style={styles.topOverlay}>
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
            placeholder="Search city or address"
            placeholderTextColor={mobileTokens.color.textTertiaryOnGradient}
            style={styles.searchInput}
            value={query}
          />
          <Pressable accessibilityRole="button" onPress={jumpToTypedPlace} style={styles.jumpButton}>
            <Text style={styles.jumpButtonLabel}>Jump</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.centerReadout}>
        <Text style={styles.mapLabel}>{draft.center.label}</Text>
        <Text style={styles.coordinateText}>
          {draft.center.latitude.toFixed(4)}, {draft.center.longitude.toFixed(4)}
        </Text>
        <Text style={styles.previewText}>Preview pins: {pins.length}</Text>
      </View>

      <View style={styles.bottomOverlay}>
        {actionError ? <Text style={styles.inlineError}>{actionError}</Text> : null}
        <View style={styles.controls}>
          <Pressable
            accessibilityLabel="Decrease search area radius"
            accessibilityRole="button"
            onPress={() => stepRadius("down")}
            style={styles.stepButton}
          >
            <Text style={styles.stepButtonLabel}>-</Text>
          </Pressable>
          <Text style={styles.radiusBadge}>{radiusLabel(draft.radiusMiles)}</Text>
          <Pressable
            accessibilityLabel="Increase search area radius"
            accessibilityRole="button"
            onPress={() => stepRadius("up")}
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
                onPress={discardDraft}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: mobileTokens.color.ink,
    flex: 1,
  },
  mapLayer: {
    backgroundColor: "#E9ECE8",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  topOverlay: {
    gap: mobileTokens.spacing[3],
    left: mobileTokens.spacing[4],
    position: "absolute",
    right: mobileTokens.spacing[4],
    top: 56,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  textButton: {
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: mobileTokens.spacing[4],
  },
  textButtonLabel: {
    color: mobileTokens.color.copper,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
  },
  eyebrow: {
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    color: mobileTokens.color.sun,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    overflow: "hidden",
    paddingHorizontal: mobileTokens.spacing[4],
    paddingVertical: mobileTokens.spacing[3],
    textTransform: "uppercase",
  },
  searchRow: {
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
  },
  searchInput: {
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    color: mobileTokens.color.paper,
    flex: 1,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    minHeight: 48,
    paddingHorizontal: mobileTokens.spacing[4],
  },
  jumpButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.sun,
    borderRadius: mobileTokens.radius.md,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: mobileTokens.spacing[4],
    width: 86,
  },
  jumpButtonLabel: {
    color: mobileTokens.color.ink,
    fontFamily: mobileTokens.typography.family.label,
    fontWeight: "800",
  },
  centerReadout: {
    alignItems: "center",
    left: mobileTokens.spacing[4],
    pointerEvents: "none",
    position: "absolute",
    right: mobileTokens.spacing[4],
    top: "42%",
  },
  mapLabel: {
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: 16,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: mobileTokens.spacing[4],
    paddingVertical: 8,
    textAlign: "center",
  },
  coordinateText: {
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderRadius: mobileTokens.radius.md,
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.label,
    marginTop: 8,
    overflow: "hidden",
    paddingHorizontal: mobileTokens.spacing[3],
    paddingVertical: 8,
  },
  previewText: {
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderRadius: mobileTokens.radius.md,
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.label,
    fontWeight: "700",
    marginTop: 8,
    overflow: "hidden",
    paddingHorizontal: mobileTokens.spacing[3],
    paddingVertical: 8,
  },
  bottomOverlay: {
    bottom: mobileTokens.spacing[4],
    gap: mobileTokens.spacing[3],
    left: mobileTokens.spacing[4],
    position: "absolute",
    right: mobileTokens.spacing[4],
  },
  controls: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    justifyContent: "center",
  },
  stepButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  stepButtonLabel: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: 22,
    fontWeight: "900",
  },
  radiusBadge: {
    backgroundColor: mobileTokens.color.sun,
    borderRadius: mobileTokens.radius.md,
    color: mobileTokens.color.ink,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: "900",
    minHeight: 40,
    paddingHorizontal: mobileTokens.spacing[4],
    paddingVertical: mobileTokens.spacing[3],
    textAlign: "center",
  },
  currentLocationButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  currentLocationLabel: {
    color: mobileTokens.color.copper,
    fontFamily: mobileTokens.typography.family.label,
    fontWeight: "800",
  },
  dirtyPrompt: {
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.lg,
    borderWidth: 1,
    padding: mobileTokens.spacing[4],
  },
  promptTitle: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.body,
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
    justifyContent: "center",
    minHeight: 44,
  },
  promptButtonLabel: {
    color: mobileTokens.color.copper,
    fontFamily: mobileTokens.typography.family.label,
    fontWeight: "800",
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.sun,
    borderRadius: mobileTokens.radius.md,
    justifyContent: "center",
    minHeight: 52,
  },
  primaryButtonLabel: {
    color: mobileTokens.color.ink,
    fontFamily: mobileTokens.typography.family.label,
    fontWeight: "900",
  },
  inlineError: {
    color: mobileTokens.color.danger,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
