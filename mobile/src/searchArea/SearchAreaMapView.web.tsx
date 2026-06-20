import { forwardRef, useImperativeHandle } from "react";
import { StyleSheet, Text, View } from "react-native";

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
>(function SearchAreaMapView({ pins, searchArea }, ref) {
  useImperativeHandle(ref, () => ({
    setSearchArea: () => {
      // Web is a read-only preview; native owns interactive map movement.
    },
  }));

  return (
    <View style={styles.root}>
      <View style={styles.radius}>
        <View style={styles.innerRadius} />
      </View>
      {pins.slice(0, 8).map((pin, index) => (
        <View
          key={pin.id}
          style={[
            styles.pin,
            {
              left: `${18 + ((index * 17) % 62)}%`,
              top: `${22 + ((index * 23) % 52)}%`,
            },
          ]}
        />
      ))}
      <View style={styles.summary}>
        <Text style={styles.primaryText}>
          {searchArea.radiusMiles.toFixed(1)} mi
        </Text>
        <Text style={styles.secondaryText}>
          {searchArea.center.latitude.toFixed(4)},{" "}
          {searchArea.center.longitude.toFixed(4)}
        </Text>
        <Text style={styles.secondaryText}>
          {pins.length} nearby options
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    backgroundColor: "#DDE8DF",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
  radius: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: "rgba(47, 123, 100, 0.16)",
    borderColor: "#2F7B64",
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: "center",
    width: "64%",
  },
  innerRadius: {
    aspectRatio: 1,
    backgroundColor: "rgba(226, 176, 74, 0.18)",
    borderColor: "#E2B04A",
    borderRadius: 999,
    borderWidth: 1,
    width: "36%",
  },
  pin: {
    backgroundColor: "#E2B04A",
    borderColor: "#14141E",
    borderRadius: 8,
    borderWidth: 2,
    height: 12,
    position: "absolute",
    width: 12,
  },
  summary: {
    backgroundColor: "rgba(20, 20, 30, 0.82)",
    borderRadius: 8,
    bottom: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: "absolute",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryText: {
    color: "#F4F2EA",
    fontSize: 12,
    marginTop: 2,
  },
});
