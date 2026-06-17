import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { SearchAreaPickerPreview } from "../src/searchArea/SearchAreaPickerPreview";
import type {
  SearchAreaAdapter,
  SearchAreaCoordinate,
} from "../src/searchArea/searchArea";
import {
  cancelSearchAreaDraft,
  commitSearchAreaDraft,
  createSearchAreaDraft,
  isSearchAreaDraftDirty,
  radiusLabel,
  radiusMilesFromCameraDeltas,
  searchAreaDraftReducer,
  zoomForRadiusMiles,
} from "../src/searchArea/searchArea";

const center: SearchAreaCoordinate = {
  latitude: 40.7128,
  longitude: -74.006,
  label: "Lower Manhattan",
};

const currentLocation: SearchAreaCoordinate = {
  latitude: 40.7306,
  longitude: -73.9352,
  label: "Current location",
};

function makeAdapter(): SearchAreaAdapter {
  return {
    getCurrentLocation: jest.fn(async () => currentLocation),
    searchPlace: jest.fn(async (query: string) => ({
      latitude: 40.6782,
      longitude: -73.9442,
      label: query,
    })),
    fetchDensityPreviewPins: jest.fn(async () => [
      { id: "pin-a", latitude: 40.7138, longitude: -74.005, label: "Preview A" },
      { id: "pin-b", latitude: 40.7118, longitude: -74.007, label: "Preview B" },
    ]),
  };
}

describe("Search area state", () => {
  it("commits and cancels center and radius as one Search area", () => {
    const committed = {
      center,
      radiusMiles: 2,
    };
    const initialDraft = createSearchAreaDraft(committed);

    const movedDraft = searchAreaDraftReducer(initialDraft, {
      type: "mapCameraChanged",
      center: currentLocation,
      radiusMiles: 3.5,
    });

    expect(isSearchAreaDraftDirty(movedDraft, committed)).toBe(true);
    expect(radiusLabel(movedDraft.radiusMiles)).toBe("3.5 MI RADIUS");
    expect(commitSearchAreaDraft(movedDraft)).toEqual({
      center: currentLocation,
      radiusMiles: 3.5,
    });
    expect(cancelSearchAreaDraft(movedDraft, committed)).toEqual(initialDraft);
  });

  it("steps radius through the allowed stops and clamps viewport-derived radius", () => {
    const draft = createSearchAreaDraft({
      center,
      radiusMiles: 2,
    });

    const steppedUp = searchAreaDraftReducer(draft, { type: "stepRadiusUp" });
    const steppedDown = searchAreaDraftReducer(steppedUp, { type: "stepRadiusDown" });
    const tooWide = searchAreaDraftReducer(draft, {
      type: "mapCameraChanged",
      center,
      radiusMiles: 18,
    });

    expect(steppedUp.radiusMiles).toBe(3.5);
    expect(steppedDown.radiusMiles).toBe(2);
    expect(tooWide.radiusMiles).toBe(10);
  });

  it("derives Search area radius from nearest visible map edge", () => {
    expect(radiusMilesFromCameraDeltas(0.1, 0.1, 0)).toBeCloseTo(3.45);
    expect(radiusMilesFromCameraDeltas(2, 2, 40)).toBe(10);
    expect(zoomForRadiusMiles(2)).toBeGreaterThan(12);
  });
});

describe("SearchAreaPickerPreview", () => {
  it(
    "uses fakeable adapter contracts for current-location jumps, typed jumps, and preview pins",
    async () => {
    const adapter = makeAdapter();
    const onCommit = jest.fn();

    render(
      <SearchAreaPickerPreview
        adapter={adapter}
        initialSearchArea={{ center, radiusMiles: 2 }}
        onCommit={onCommit}
      />,
    );

    expect(screen.getByText("Lower Manhattan")).toBeOnTheScreen();
    expect(screen.getByText("2.0 MI RADIUS")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("+"));
    expect(screen.getByText("3.5 MI RADIUS")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Use current location"));
    await waitFor(() => expect(adapter.getCurrentLocation).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Current location")).toBeOnTheScreen());

    fireEvent.changeText(
      screen.getByPlaceholderText("Search city, neighborhood, or address"),
      "Brooklyn",
    );
    fireEvent.press(screen.getByText("Jump"));

    await waitFor(() => expect(adapter.searchPlace).toHaveBeenCalledWith("Brooklyn"));
    await waitFor(() => expect(screen.getByText("Brooklyn")).toBeOnTheScreen());
    await waitFor(() => expect(adapter.fetchDensityPreviewPins).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Preview pins: 2")).toBeOnTheScreen());

    fireEvent.press(screen.getByText("USE THIS AREA"));

    expect(onCommit).toHaveBeenCalledWith({
      center: {
        latitude: 40.6782,
        longitude: -73.9442,
        label: "Brooklyn",
      },
      radiusMiles: 3.5,
    });
    },
    10000,
  );

  it("surfaces dirty close choices without committing until the user chooses", () => {
    const adapter = makeAdapter();
    const onCommit = jest.fn();
    const onCancel = jest.fn();

    render(
      <SearchAreaPickerPreview
        adapter={adapter}
        initialSearchArea={{ center, radiusMiles: 2 }}
        onCancel={onCancel}
        onCommit={onCommit}
      />,
    );

    fireEvent.press(screen.getByText("+"));
    fireEvent.press(screen.getByText("Close"));

    expect(screen.getByText("Discard changes")).toBeOnTheScreen();
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Use this area"));

    expect(onCommit).toHaveBeenCalledWith({
      center,
      radiusMiles: 3.5,
    });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
