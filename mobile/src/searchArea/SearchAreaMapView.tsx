import { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Circle, Marker, type Region } from "react-native-maps";

import {
  type DensityPreviewPin,
  milesToMeters,
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
  searchArea: SearchArea;
};

const milesPerLatitudeDegree = 69;
const minimumDelta = 0.005;

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

export const SearchAreaMapView = forwardRef<
  SearchAreaMapHandle,
  SearchAreaMapViewProps
>(function SearchAreaMapView({ onCameraMove, pins, searchArea }, ref) {
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

  return (
    <MapView
      ref={mapRef}
      initialRegion={regionForSearchArea(searchArea)}
      loadingEnabled
      mapType="standard"
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
    </MapView>
  );
});

const styles = StyleSheet.create({
  map: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
