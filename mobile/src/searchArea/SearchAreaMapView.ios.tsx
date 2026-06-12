import { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import { AppleMaps, type CameraMoveEvent } from "expo-maps";

import { mobileTokens } from "../design/tokens";
import type { DensityPreviewPin, SearchArea } from "./searchArea";
import { milesToMeters, zoomForRadiusMiles } from "./searchArea";
import type {
  SearchAreaMapCameraMoveEvent,
  SearchAreaMapHandle,
} from "./SearchAreaMapView";

type AppleMapsViewRef = AppleMaps.MapView;

type SearchAreaMapViewProps = {
  cameraPosition: {
    coordinates: {
      latitude: number;
      longitude: number;
    };
    zoom: number;
  };
  onCameraMove: (event: SearchAreaMapCameraMoveEvent) => void;
  pins: DensityPreviewPin[];
  searchArea: SearchArea;
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

export const SearchAreaMapView = forwardRef<
  SearchAreaMapHandle,
  SearchAreaMapViewProps
>(function SearchAreaMapView(
  { cameraPosition, onCameraMove, pins, searchArea },
  ref,
) {
  const mapRef = useRef<AppleMapsViewRef | null>(null);
  const previewMarkers = pins.map((pin) => ({
    id: pin.id,
    coordinates: {
      latitude: pin.latitude,
      longitude: pin.longitude,
    },
    title: pin.label,
    tintColor: mobileTokens.color.sun,
  }));
  const selectedCircle = [
    {
      id: "selected-search-area",
      center: {
        latitude: searchArea.center.latitude,
        longitude: searchArea.center.longitude,
      },
      radius: milesToMeters(searchArea.radiusMiles),
      color: "rgba(244,201,93,0.18)",
      lineColor: mobileTokens.color.sun,
      lineWidth: 2,
    },
  ];

  useImperativeHandle(ref, () => ({
    setSearchArea: (nextSearchArea) => {
      mapRef.current?.setCameraPosition(mapCameraForSearchArea(nextSearchArea));
    },
  }));

  const handleCameraMove = (event: CameraMoveEvent) => {
    const latitude = event.coordinates.latitude;
    const longitude = event.coordinates.longitude;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return;
    }

    onCameraMove({
      latitude,
      longitude,
      latitudeDelta: event.latitudeDelta,
      longitudeDelta: event.longitudeDelta,
    });
  };

  return (
    <AppleMaps.View
      ref={mapRef}
      cameraPosition={cameraPosition}
      circles={selectedCircle}
      markers={previewMarkers}
      onCameraMove={handleCameraMove}
      properties={{
        isMyLocationEnabled: true,
        mapType: AppleMaps.MapType.STANDARD,
        pointsOfInterest: { excluding: [] },
      }}
      uiSettings={{
        compassEnabled: true,
        myLocationButtonEnabled: true,
        scaleBarEnabled: true,
      }}
      style={StyleSheet.absoluteFill}
    />
  );
});
