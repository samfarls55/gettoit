/** @jest-environment jsdom */

import { act } from "react";

import type { PlanListSnapshot } from "../src/plans/planRepository";
import { emptyPlanListSnapshot } from "../src/plans/planRepository";

jest.mock("react-native", () => jest.requireActual("react-native-web"));

import { PlanListScreen } from "../src/plans/PlanListScreen";

const { createRoot } = require("react-dom/client") as {
  createRoot: (container: Element) => {
    render: (children: unknown) => void;
    unmount: () => void;
  };
};

const createdPlanList: PlanListSnapshot = {
  ...emptyPlanListSnapshot,
  created: [
    {
      id: "brunch-plan",
      title: "Brunch plan",
      subtitle: "Pending setup",
      badge: "Created",
      routeTarget: "pending",
    },
  ],
};

describe("PlanListScreen on web", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: jest.fn(),
    });
  });

  it("does not nest the Created delete action inside the open-card button", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;

    const container = document.createElement("div");
    const root = createRoot(container);

    document.body.appendChild(container);

    await act(async () => {
      root.render(<PlanListScreen plans={createdPlanList} />);
    });

    expect(
      container.querySelector('[aria-label="Open Created Plan Brunch plan"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Delete Created Plan Brunch plan"]'),
    ).not.toBeNull();
    expect(container.querySelector("button button")).toBeNull();
    expect(container.textContent).toContain("Finish setup");
    expect(container.textContent).not.toContain("Vote Now");
    expect(
      container.querySelector(
        '[aria-label="Groups unavailable"][aria-disabled="true"]',
      ),
    ).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
