import * as Location from "expo-location";

import type { SearchArea, SearchAreaAdapter, SearchAreaCoordinate } from "./searchArea";

function labelFromAddress(
  address: Location.LocationGeocodedAddress | undefined,
  fallback: string,
): string {
  if (!address) {
    return fallback;
  }

  const parts = [address.name, address.street, address.city, address.region]
    .filter((part): part is string => Boolean(part?.trim()))
    .filter((part, index, list) => list.indexOf(part) === index);

  return parts.length > 0 ? parts.slice(0, 3).join(", ") : fallback;
}

async function reverseGeocodeLabel(
  coordinate: Pick<SearchAreaCoordinate, "latitude" | "longitude">,
  fallback: string,
): Promise<string> {
  try {
    const [address] = await Location.reverseGeocodeAsync(coordinate);

    return labelFromAddress(address, fallback);
  } catch {
    return fallback;
  }
}

async function requireForegroundLocationPermission() {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error("Location permission denied.");
  }
}

export const nativeSearchAreaAdapter: SearchAreaAdapter = {
  async getCurrentLocation() {
    await requireForegroundLocationPermission();

    const servicesEnabled = await Location.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      throw new Error("Location services disabled.");
    }

    const position =
      (await Location.getLastKnownPositionAsync({
        maxAge: 5 * 60 * 1000,
        requiredAccuracy: 1000,
      })) ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }));
    const coordinate = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    return {
      ...coordinate,
      label: await reverseGeocodeLabel(coordinate, "Current location"),
    };
  },

  async searchPlace(query) {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      throw new Error("Search area query is empty.");
    }

    const [result] = await Location.geocodeAsync(trimmedQuery);

    if (!result) {
      throw new Error("Search area query returned no result.");
    }

    return {
      latitude: result.latitude,
      longitude: result.longitude,
      label: trimmedQuery,
    };
  },

  async fetchDensityPreviewPins(_searchArea: SearchArea) {
    return [];
  },
};
