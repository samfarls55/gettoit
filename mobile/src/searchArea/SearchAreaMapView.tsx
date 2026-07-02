import { type Ref, useImperativeHandle, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type MapView from "react-native-maps";
import type { Region } from "react-native-maps";

import { mobileTokens } from "../design/tokens";
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
    return <SearchAreaMapPreview pins={pins} />;
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
        fillColor="rgba(212, 175, 55, 0.16)"
        radius={milesToMeters(searchArea.radiusMiles)}
        strokeColor="rgba(255, 183, 123, 0.78)"
        strokeWidth={2}
      />
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          coordinate={pin}
          pinColor={mobileTokens.color.sun}
          title={pin.label}
        />
      ))}
    </NativeMapView>
  );
}

function SearchAreaMapPreview({
  pins,
}: {
  pins: DensityPreviewPin[];
}) {
  return (
    <View style={styles.webRoot}>
      <View style={styles.webGridHorizontal} />
      <View style={styles.webGridVertical} />
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
    backgroundColor: mobileTokens.color.ink,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
  webGridHorizontal: {
    backgroundColor: mobileTokens.color.divider,
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: "37%",
  },
  webGridVertical: {
    backgroundColor: mobileTokens.color.divider,
    bottom: 0,
    left: "58%",
    position: "absolute",
    top: 0,
    width: 1,
  },
  webRadius: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: mobileTokens.color.glow,
    borderColor: mobileTokens.color.copper,
    borderRadius: mobileTokens.radius.full,
    borderWidth: 2,
    justifyContent: "center",
    width: "64%",
  },
  webInnerRadius: {
    aspectRatio: 1,
    backgroundColor: "rgba(255, 183, 123, 0.14)",
    borderColor: mobileTokens.color.sun,
    borderRadius: mobileTokens.radius.full,
    borderWidth: 1,
    width: "36%",
  },
  webPin: {
    backgroundColor: mobileTokens.color.sun,
    borderColor: mobileTokens.color.ink,
    borderRadius: mobileTokens.radius.sm,
    borderWidth: 2,
    height: 12,
    position: "absolute",
    width: 12,
  },
});
