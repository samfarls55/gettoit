import { type Ref, useImperativeHandle, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type MapView from "react-native-maps";
import type { Region } from "react-native-maps";

import {
  type DensityPreviewPin,
  maximumSearchAreaZoom,
  milesToMeters,
  minimumSearchAreaZoom,
  type SearchArea,
} from "./searchArea";

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
  ref?: Ref<SearchAreaMapHandle>;
  searchArea: SearchArea;
};

const milesPerLatitudeDegree = 69;
const minimumDelta = 0.005;
type NativeMapsModule = typeof import("react-native-maps");

function regionForSearchArea(searchArea: SearchArea): Region {
  const latitudeDelta = Math.max(
    (searchArea.radiusMiles * 2) / milesPerLatitudeDegree,
    minimumDelta,
  );
  const longitudeDelta = Math.max(
    latitudeDelta /
      Math.max(Math.cos((searchArea.center.latitude * Math.PI) / 180), 0.01),
    minimumDelta,
  );

  return {
    latitude: searchArea.center.latitude,
    longitude: searchArea.center.longitude,
    latitudeDelta,
    longitudeDelta,
  };
}

function getNativeMaps(): NativeMapsModule {
  return require("react-native-maps") as NativeMapsModule;
}

export function SearchAreaMapView({
  onCameraMove,
  pins,
  ref,
  searchArea,
}: SearchAreaMapViewProps) {
  const mapRef = useRef<MapView | null>(null);
  const isProgrammaticMoveRef = useRef(false);

  useImperativeHandle(ref, () => ({
    setSearchArea: (nextSearchArea) => {
      isProgrammaticMoveRef.current = true;
      mapRef.current?.animateToRegion(regionForSearchArea(nextSearchArea), 250);
    },
  }));

  const handleRegionChangeComplete = (region: Region) => {
    if (isProgrammaticMoveRef.current) {
      isProgrammaticMoveRef.current = false;
      return;
    }

    onCameraMove(region);
  };

  if (Platform.OS === "web") {
    return <SearchAreaMapPreview pins={pins} searchArea={searchArea} />;
  }

  const { default: NativeMapView, Circle, Marker } = getNativeMaps();

  return (
    <NativeMapView
      ref={mapRef}
      initialRegion={regionForSearchArea(searchArea)}
      loadingEnabled
      mapType="standard"
      maxZoomLevel={maximumSearchAreaZoom}
      minZoomLevel={minimumSearchAreaZoom}
      onRegionChangeComplete={handleRegionChangeComplete}
      pitchEnabled={false}
      rotateEnabled={false}
      showsCompass={false}
      showsPointsOfInterests
      style={styles.map}
    >
      <Circle
        center={searchArea.center}
        fillColor="rgba(47, 123, 100, 0.18)"
        radius={milesToMeters(searchArea.radiusMiles)}
        strokeColor="rgba(23, 94, 73, 0.78)"
        strokeWidth={2}
      />
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          coordinate={pin}
          pinColor="#E2B04A"
          title={pin.label}
        />
      ))}
    </NativeMapView>
  );
}

function SearchAreaMapPreview({
  pins,
  searchArea,
}: {
  pins: DensityPreviewPin[];
  searchArea: SearchArea;
}) {
  return (
    <View style={styles.webRoot}>
      <View style={styles.webRadius}>
        <View style={styles.webInnerRadius} />
      </View>
      {pins.slice(0, 8).map((pin, index) => (
        <View
          key={pin.id}
          style={[
            styles.webPin,
            {
              left: `${18 + ((index * 17) % 62)}%`,
              top: `${22 + ((index * 23) % 52)}%`,
            },
          ]}
        />
      ))}
      <View style={styles.webSummary}>
        <Text style={styles.webPrimaryText}>
          {searchArea.radiusMiles.toFixed(1)} mi
        </Text>
        <Text style={styles.webSecondaryText}>
          {searchArea.center.latitude.toFixed(4)},{" "}
          {searchArea.center.longitude.toFixed(4)}
        </Text>
        <Text style={styles.webSecondaryText}>
          {pins.length} nearby options
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  webRoot: {
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
  webRadius: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: "rgba(47, 123, 100, 0.16)",
    borderColor: "#2F7B64",
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: "center",
    width: "64%",
  },
  webInnerRadius: {
    aspectRatio: 1,
    backgroundColor: "rgba(226, 176, 74, 0.18)",
    borderColor: "#E2B04A",
    borderRadius: 999,
    borderWidth: 1,
    width: "36%",
  },
  webPin: {
    backgroundColor: "#E2B04A",
    borderColor: "#14141E",
    borderRadius: 8,
    borderWidth: 2,
    height: 12,
    position: "absolute",
    width: 12,
  },
  webSummary: {
    backgroundColor: "rgba(20, 20, 30, 0.82)",
    borderRadius: 8,
    bottom: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: "absolute",
  },
  webPrimaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  webSecondaryText: {
    color: "#F4F2EA",
    fontSize: 12,
    marginTop: 2,
  },
});
