export type SearchAreaCoordinate = {
  latitude: number;
  longitude: number;
  label: string;
};

export type SearchArea = {
  center: SearchAreaCoordinate;
  radiusMiles: number;
};

export type DensityPreviewPin = SearchAreaCoordinate & {
  id: string;
};

export type SearchAreaDraft = SearchArea;

export type SearchAreaAdapter = {
  getCurrentLocation: () => Promise<SearchAreaCoordinate>;
  searchPlace: (query: string) => Promise<SearchAreaCoordinate>;
  fetchDensityPreviewPins: (searchArea: SearchArea) => Promise<DensityPreviewPin[]>;
};

export type SearchAreaDraftEvent =
  | {
      type: "mapCameraChanged";
      center: SearchAreaCoordinate;
      radiusMiles: number;
    }
  | { type: "jumpToCurrentLocation"; center: SearchAreaCoordinate }
  | { type: "jumpToPlace"; center: SearchAreaCoordinate }
  | { type: "stepRadiusDown" }
  | { type: "stepRadiusUp" };

const metersPerMile = 1609.344;
const milesPerLatitudeDegree = 69;

export const searchAreaRadiusBounds = {
  minMiles: 0.25,
  maxMiles: 10,
} as const;

export const searchAreaRadiusRangeMeters = {
  min: Math.round(searchAreaRadiusBounds.minMiles * metersPerMile),
  max: Math.round(searchAreaRadiusBounds.maxMiles * metersPerMile),
} as const;

export const searchAreaRadiusStopsMiles = [
  searchAreaRadiusBounds.minMiles,
  0.5,
  1,
  1.5,
  2,
  3.5,
  5,
  7.5,
  searchAreaRadiusBounds.maxMiles,
] as const;

export const defaultSearchArea: SearchArea = {
  center: {
    latitude: 37.7749,
    longitude: -122.4194,
    label: "San Francisco",
  },
  radiusMiles: 2,
};

export function createSearchAreaDraft(
  committedSearchArea: SearchArea | null,
): SearchAreaDraft {
  return committedSearchArea ?? defaultSearchArea;
}

export function formatRadiusMiles(radiusMiles: number): string {
  return radiusMiles < 0.5 ? radiusMiles.toFixed(2) : radiusMiles.toFixed(1);
}

export function radiusLabel(radiusMiles: number): string {
  return `${formatRadiusMiles(radiusMiles)} MI RADIUS`;
}

export function clampRadiusMiles(radiusMiles: number): number {
  return Math.min(
    searchAreaRadiusBounds.maxMiles,
    Math.max(searchAreaRadiusBounds.minMiles, radiusMiles),
  );
}

export function milesToMeters(miles: number): number {
  return miles * metersPerMile;
}

export function radiusMilesFromCameraDeltas(
  latitudeDelta: number,
  longitudeDelta: number,
  latitude: number,
): number {
  const latitudeMiles = Math.abs(latitudeDelta) * milesPerLatitudeDegree;
  const longitudeMiles =
    Math.abs(longitudeDelta) *
    milesPerLatitudeDegree *
    Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);
  const nearestEdgeMiles = Math.min(latitudeMiles, longitudeMiles) / 2;

  return clampRadiusMiles(nearestEdgeMiles);
}

export function zoomForRadiusMiles(radiusMiles: number): number {
  const clampedRadiusMiles = clampRadiusMiles(radiusMiles);
  const latitudeDelta = Math.max((clampedRadiusMiles * 2) / milesPerLatitudeDegree, 0.001);

  return Math.min(18, Math.max(4, Math.log2(360 / latitudeDelta)));
}

export const minimumSearchAreaZoom = zoomForRadiusMiles(
  searchAreaRadiusBounds.maxMiles,
);
export const maximumSearchAreaZoom = zoomForRadiusMiles(
  searchAreaRadiusBounds.minMiles,
);

function nearestRadiusStopIndex(radiusMiles: number): number {
  return searchAreaRadiusStopsMiles.reduce((nearestIndex, stop, index) => {
    const nearestStop = searchAreaRadiusStopsMiles[nearestIndex];
    const stopDistance = Math.abs(stop - radiusMiles);
    const nearestDistance = Math.abs(nearestStop - radiusMiles);

    if (stopDistance < nearestDistance) {
      return index;
    }

    return nearestIndex;
  }, 0);
}

function stepRadius(radiusMiles: number, direction: -1 | 1): number {
  const currentIndex = nearestRadiusStopIndex(radiusMiles);
  const nextIndex = Math.min(
    searchAreaRadiusStopsMiles.length - 1,
    Math.max(0, currentIndex + direction),
  );

  return searchAreaRadiusStopsMiles[nextIndex];
}

export function searchAreaDraftReducer(
  draft: SearchAreaDraft,
  event: SearchAreaDraftEvent,
): SearchAreaDraft {
  switch (event.type) {
    case "mapCameraChanged":
      return {
        center: event.center,
        radiusMiles: clampRadiusMiles(event.radiusMiles),
      };
    case "jumpToCurrentLocation":
    case "jumpToPlace":
      return { ...draft, center: event.center };
    case "stepRadiusDown":
      return { ...draft, radiusMiles: stepRadius(draft.radiusMiles, -1) };
    case "stepRadiusUp":
      return { ...draft, radiusMiles: stepRadius(draft.radiusMiles, 1) };
  }
}

export function commitSearchAreaDraft(draft: SearchAreaDraft): SearchArea {
  return draft;
}

export function cancelSearchAreaDraft(
  _draft: SearchAreaDraft,
  committedSearchArea: SearchArea | null,
): SearchAreaDraft {
  return createSearchAreaDraft(committedSearchArea);
}

export function isSearchAreaDraftDirty(
  draft: SearchAreaDraft,
  committedSearchArea: SearchArea | null,
): boolean {
  if (committedSearchArea === null) {
    return true;
  }

  return (
    draft.center.latitude !== committedSearchArea.center.latitude ||
    draft.center.longitude !== committedSearchArea.center.longitude ||
    draft.center.label !== committedSearchArea.center.label ||
    draft.radiusMiles !== committedSearchArea.radiusMiles
  );
}

export const deterministicSearchAreaAdapter: SearchAreaAdapter = {
  async getCurrentLocation() {
    return {
      latitude: 37.7897,
      longitude: -122.3972,
      label: "Current location",
    };
  },
  async searchPlace(query) {
    const trimmedQuery = query.trim();

    return {
      latitude: 37.7609,
      longitude: -122.435,
      label: trimmedQuery.length > 0 ? trimmedQuery : "Typed place",
    };
  },
  async fetchDensityPreviewPins(searchArea) {
    return Array.from({ length: 6 }, (_, index) => ({
      id: `preview-${index + 1}`,
      latitude: searchArea.center.latitude + (index - 2) * 0.002,
      longitude: searchArea.center.longitude + (index - 2) * 0.002,
      label: `Preview ${index + 1}`,
    }));
  },
};
