/** @jest-environment jsdom */

import { act, type ComponentProps } from "react";

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

async function renderPlanListScreen(
  props: ComponentProps<typeof PlanListScreen>,
) {
  const container = document.createElement("div");
  const root = createRoot(container);

  document.body.appendChild(container);

  await act(async () => {
    root.render(<PlanListScreen {...props} />);
  });

  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("PlanListScreen on web", () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: jest.fn(),
    });
  });

  it("does not nest the Created delete action inside the open-card button", async () => {
    const { container, unmount } = await renderPlanListScreen({
      plans: createdPlanList,
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

    await unmount();
  });

  it("keeps Start Plan reachable in the bottom action area", async () => {
    const onCreatePlan = jest.fn();
    const { container, unmount } = await renderPlanListScreen({
      onCreatePlan,
      plans: emptyPlanListSnapshot,
    });

    const startPlanButton = container.querySelector<HTMLElement>(
      '[aria-label="Start a group Plan"]',
    );

    expect(startPlanButton).not.toBeNull();
    expect(startPlanButton?.getAttribute("aria-disabled")).toBeNull();

    await act(async () => {
      startPlanButton?.click();
    });

    expect(onCreatePlan).toHaveBeenCalledWith("group");

    await unmount();
  });
});
