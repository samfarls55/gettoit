import * as matchers from "@testing-library/react-native/matchers";

expect.extend(matchers);

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);

jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
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

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockMapView = React.forwardRef(
    (
      {
        children,
        ...props
      }: { children?: React.ReactNode; [key: string]: unknown },
      ref: React.Ref<unknown>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        animateToRegion: jest.fn(),
      }));

      return React.createElement(View, props, children);
    },
  );
  const MockMapChild = ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement(View, props, children);

  return {
    __esModule: true,
    Circle: MockMapChild,
    default: MockMapView,
    Marker: MockMapChild,
  };
});
