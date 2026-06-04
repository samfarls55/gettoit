import { render, screen } from "@testing-library/react-native";

import App from "../App";
import { mobileTokens } from "../src/design/tokens";

describe("App", () => {
  it("renders the GetToIt mobile scaffold", () => {
    render(<App />);

    expect(screen.getByText("GetToIt")).toBeOnTheScreen();
    expect(screen.getByText("Expo mobile rewrite scaffold")).toBeOnTheScreen();
    expect(screen.getByText("Design tokens wired")).toBeOnTheScreen();
    expect(mobileTokens.color.sun).toBe("#FFD23F");
  });
});
