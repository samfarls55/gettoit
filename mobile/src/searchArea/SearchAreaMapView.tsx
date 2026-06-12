import { forwardRef, useImperativeHandle } from "react";
import { StyleSheet, View } from "react-native";

import type { DensityPreviewPin, SearchArea } from "./searchArea";

export type SearchAreaMapCameraMoveEvent = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type SearchAreaMapHandle = {
  setSearchArea: (searchArea: SearchArea) => void;
};

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

export const SearchAreaMapView = forwardRef<
  SearchAreaMapHandle,
  SearchAreaMapViewProps
>(function SearchAreaMapView(_props, ref) {
  useImperativeHandle(ref, () => ({
    setSearchArea: () => undefined,
  }));

  return <View style={styles.fallbackMap} />;
});

const styles = StyleSheet.create({
  fallbackMap: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#DDE8E3",
  },
});
