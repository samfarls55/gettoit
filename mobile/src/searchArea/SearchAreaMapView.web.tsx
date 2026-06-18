import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { DensityPreviewPin, SearchArea } from "./searchArea";
import {
  maximumSearchAreaZoom,
  minimumSearchAreaZoom,
  zoomForRadiusMiles,
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

const earthRadiusMiles = 3958.8;
const radiusSourceId = "search-radius";
const radiusFillLayerId = "search-radius-fill";
const radiusStrokeLayerId = "search-radius-stroke";
const previewPinsSourceId = "preview-pins";
const previewPinsLayerId = "preview-pins-layer";
const defaultMapTilerStyleId = "dataviz-v4-dark";

type SourceData = Parameters<GeoJSONSource["setData"]>[0];

function mapStyle(): string | StyleSpecification {
  const mapTilerStyleUrl = process.env.EXPO_PUBLIC_MAPTILER_STYLE_URL;
  const mapTilerKey = process.env.EXPO_PUBLIC_MAPTILER_KEY;
  const mapTilerStyleId =
    process.env.EXPO_PUBLIC_MAPTILER_STYLE_ID ?? defaultMapTilerStyleId;

  if (mapTilerStyleUrl) {
    return mapTilerStyleUrl;
  }

  if (mapTilerKey) {
    return `https://api.maptiler.com/maps/${mapTilerStyleId}/style.json?key=${mapTilerKey}`;
  }

  return {
    version: 8,
    sources: {
      "carto-dark-matter-raster": {
        type: "raster",
        tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
        tileSize: 256,
      },
    },
    layers: [
      {
        id: "carto-dark-matter-raster",
        type: "raster",
        source: "carto-dark-matter-raster",
      },
    ],
  };
}

function attributionText(): string {
  if (
    process.env.EXPO_PUBLIC_MAPTILER_STYLE_URL ||
    process.env.EXPO_PUBLIC_MAPTILER_KEY
  ) {
    return "\u00A9 MapTiler \u00A9 OpenStreetMap contributors";
  }

  return "\u00A9 CARTO \u00A9 OpenStreetMap contributors";
}

function ensureMapLibreStyles() {
  if (typeof document === "undefined") {
    return;
  }

  if (document.getElementById("gettoit-maplibre-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "gettoit-maplibre-styles";
  style.textContent = `
    .maplibregl-map {
      font: 12px/20px Arial, Helvetica, sans-serif;
      overflow: hidden;
      position: relative;
      -webkit-tap-highlight-color: transparent;
    }

    .maplibregl-canvas {
      left: 0;
      position: absolute;
      top: 0;
    }

    .maplibregl-canvas-container.maplibregl-interactive {
      cursor: grab;
    }

    .maplibregl-canvas-container.maplibregl-interactive:active {
      cursor: grabbing;
    }
  `;

  document.head.appendChild(style);
}

function emptyFeatureCollection(): SourceData {
  return {
    type: "FeatureCollection",
    features: [],
  } as SourceData;
}

function previewPinsFeatureCollection(pins: DensityPreviewPin[]): SourceData {
  return {
    type: "FeatureCollection",
    features: pins.map((pin) => ({
      type: "Feature",
      properties: {
        id: pin.id,
        label: pin.label,
      },
      geometry: {
        type: "Point",
        coordinates: [pin.longitude, pin.latitude],
      },
    })),
  } as SourceData;
}

function radiusFeatureCollection(searchArea: SearchArea): SourceData {
  const latitude = (searchArea.center.latitude * Math.PI) / 180;
  const longitude = (searchArea.center.longitude * Math.PI) / 180;
  const angularDistance = searchArea.radiusMiles / earthRadiusMiles;
  const coordinates: number[][] = [];

  for (let index = 0; index <= 72; index += 1) {
    const bearing = ((index * 360) / 72) * (Math.PI / 180);
    const nextLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance) +
        Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const nextLongitude =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
        Math.cos(angularDistance) -
          Math.sin(latitude) * Math.sin(nextLatitude),
      );

    coordinates.push([
      (nextLongitude * 180) / Math.PI,
      (nextLatitude * 180) / Math.PI,
    ]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        },
      },
    ],
  } as SourceData;
}

function addOverlayLayers(map: MapLibreMap) {
  if (!map.getSource(radiusSourceId)) {
    map.addSource(radiusSourceId, {
      type: "geojson",
      data: emptyFeatureCollection(),
    });
  }

  if (!map.getLayer(radiusFillLayerId)) {
    map.addLayer({
      id: radiusFillLayerId,
      type: "fill",
      source: radiusSourceId,
      paint: {
        "fill-color": "#2F7B64",
        "fill-opacity": 0.18,
      },
    });
  }

  if (!map.getLayer(radiusStrokeLayerId)) {
    map.addLayer({
      id: radiusStrokeLayerId,
      type: "line",
      source: radiusSourceId,
      paint: {
        "line-color": "#175E49",
        "line-opacity": 0.86,
        "line-width": 2,
      },
    });
  }

  if (!map.getSource(previewPinsSourceId)) {
    map.addSource(previewPinsSourceId, {
      type: "geojson",
      data: emptyFeatureCollection(),
    });
  }

  if (!map.getLayer(previewPinsLayerId)) {
    map.addLayer({
      id: previewPinsLayerId,
      type: "circle",
      source: previewPinsSourceId,
      paint: {
        "circle-color": "#E2B04A",
        "circle-opacity": 0.94,
        "circle-radius": 6,
        "circle-stroke-color": "#14141E",
        "circle-stroke-width": 2,
      },
    });
  }
}

function updateOverlayData(
  map: MapLibreMap,
  searchArea: SearchArea,
  pins: DensityPreviewPin[],
) {
  (map.getSource(radiusSourceId) as GeoJSONSource | undefined)?.setData(
    radiusFeatureCollection(searchArea),
  );
  (map.getSource(previewPinsSourceId) as GeoJSONSource | undefined)?.setData(
    previewPinsFeatureCollection(pins),
  );
}

function boundsDeltas(map: MapLibreMap) {
  const bounds = map.getBounds();
  const latitudeDelta = Math.abs(bounds.getNorth() - bounds.getSouth());
  const rawLongitudeDelta = Math.abs(bounds.getEast() - bounds.getWest());

  return {
    latitudeDelta,
    longitudeDelta: rawLongitudeDelta > 180 ? 360 - rawLongitudeDelta : rawLongitudeDelta,
  };
}

export const SearchAreaMapView = forwardRef<
  SearchAreaMapHandle,
  SearchAreaMapViewProps
>(function SearchAreaMapView(
  { cameraPosition, onCameraMove, pins, searchArea },
  ref,
) {
  const containerRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const isProgrammaticMoveRef = useRef(false);
  const pendingSearchAreaRef = useRef<SearchArea | null>(null);

  useImperativeHandle(ref, () => ({
    setSearchArea: (nextSearchArea) => {
      const map = mapRef.current;

      if (!map) {
        pendingSearchAreaRef.current = nextSearchArea;
        return;
      }

      isProgrammaticMoveRef.current = true;
      map.once("moveend", () => {
        isProgrammaticMoveRef.current = false;
      });
      window.setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 500);
      map.easeTo({
        center: [
          nextSearchArea.center.longitude,
          nextSearchArea.center.latitude,
        ],
        duration: 250,
        zoom: zoomForRadiusMiles(nextSearchArea.radiusMiles),
      });
    },
  }));

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    ensureMapLibreStyles();

    const map = new maplibregl.Map({
      attributionControl: false,
      center: [
        cameraPosition.coordinates.longitude,
        cameraPosition.coordinates.latitude,
      ],
      container,
      maxZoom: maximumSearchAreaZoom,
      minZoom: minimumSearchAreaZoom,
      pitchWithRotate: false,
      style: mapStyle(),
      zoom: cameraPosition.zoom,
    });

    mapRef.current = map;
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    const handleLoad = () => {
      addOverlayLayers(map);
      updateOverlayData(map, searchArea, pins);

      if (pendingSearchAreaRef.current) {
        const nextSearchArea = pendingSearchAreaRef.current;
        pendingSearchAreaRef.current = null;
        isProgrammaticMoveRef.current = true;
        map.once("moveend", () => {
          isProgrammaticMoveRef.current = false;
        });
        window.setTimeout(() => {
          isProgrammaticMoveRef.current = false;
        }, 500);
        map.jumpTo({
          center: [
            nextSearchArea.center.longitude,
            nextSearchArea.center.latitude,
          ],
          zoom: zoomForRadiusMiles(nextSearchArea.radiusMiles),
        });
      }
    };

    const handleCameraInteractionEnd = () => {
      if (isProgrammaticMoveRef.current) {
        return;
      }

      const center = map.getCenter();
      const deltas = boundsDeltas(map);

      onCameraMove({
        latitude: center.lat,
        longitude: center.lng,
        ...deltas,
      });
    };

    map.on("load", handleLoad);
    map.on("dragend", handleCameraInteractionEnd);
    map.on("zoomend", handleCameraInteractionEnd);

    return () => {
      map.off("load", handleLoad);
      map.off("dragend", handleCameraInteractionEnd);
      map.off("zoomend", handleCameraInteractionEnd);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (!map.isStyleLoaded()) {
      map.once("load", () => updateOverlayData(map, searchArea, pins));
      return;
    }

    updateOverlayData(map, searchArea, pins);
  }, [pins, searchArea]);

  return (
    <View style={styles.root}>
      <View
        ref={(node) => {
          containerRef.current = node as unknown as HTMLElement | null;
        }}
        style={styles.map}
      />
      <Text style={styles.attribution}>
        {attributionText()}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  map: {
    height: "100%",
    width: "100%",
  },
  attribution: {
    backgroundColor: "rgba(255,255,255,0.82)",
    bottom: 0,
    color: "#14141E",
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
  },
});
