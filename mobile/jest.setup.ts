import * as matchers from "@testing-library/react-native/matchers";

expect.extend(matchers);

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-secure-store", () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock("expo-location", () => ({
  Accuracy: {
    Balanced: 3,
  },
  geocodeAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

jest.mock("expo-maps", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    AppleMaps: {
      MapType: {
        STANDARD: "STANDARD",
      },
      View: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
        React.useImperativeHandle(ref, () => ({
          setCameraPosition: jest.fn(),
        }));

        return React.createElement(View, {
          ...props,
          testID: "apple-mapkit-view",
        });
      }),
    },
  };
});
