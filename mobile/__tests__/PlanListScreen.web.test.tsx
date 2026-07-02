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
    expect(container.textContent).not.toContain("Groups");
    expect(container.textContent).not.toContain("Activity");
    expect(container.textContent).not.toContain("Profile");
    expect(
      container.querySelector('[aria-label="Groups unavailable"]'),
    ).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps Start Plan reachable in the bottom action area", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;

    const container = document.createElement("div");
    const root = createRoot(container);
    const onCreatePlan = jest.fn();

    document.body.appendChild(container);

    await act(async () => {
      root.render(
        <PlanListScreen
          onCreatePlan={onCreatePlan}
          plans={emptyPlanListSnapshot}
        />,
      );
    });

    const startPlanButton = container.querySelector(
      '[aria-label="Start a group Plan"]',
    ) as HTMLButtonElement | null;

    expect(startPlanButton).not.toBeNull();
    expect(startPlanButton?.getAttribute("aria-disabled")).toBeNull();

    await act(async () => {
      startPlanButton?.click();
    });

    expect(onCreatePlan).toHaveBeenCalledWith("group");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
