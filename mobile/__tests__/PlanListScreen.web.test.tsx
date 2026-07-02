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

const mixedPlanList: PlanListSnapshot = {
  ...createdPlanList,
  joined: [
    {
      id: "joined-plan",
      title: "Birthday dinner",
      subtitle: "Quiz in progress",
      badge: "Joined",
      routeTarget: "joined",
    },
  ],
  decided: [
    {
      id: "decided-plan",
      title: "Sushi night",
      subtitle: "Live verdict",
      badge: "Decided",
      routeTarget: "decided",
    },
  ],
};

const planListWithLegacyBadges: PlanListSnapshot = {
  ...mixedPlanList,
  history: [
    {
      id: "closed-plan",
      title: "Taco Tuesday",
      subtitle: "Closed last night",
      badge: "History",
      routeTarget: "history",
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

  it("does not nest the setup delete action inside the open-card button", async () => {
    const { container, unmount } = await renderPlanListScreen({
      plans: createdPlanList,
    });

    expect(
      container.querySelector(
        '[aria-label="Open Needs setup Plan Brunch plan"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[aria-label="Delete Needs setup Plan Brunch plan"]',
      ),
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

  it("replaces fake social card state with honest Plan action copy", async () => {
    const { container, unmount } = await renderPlanListScreen({
      plans: mixedPlanList,
    });

    const renderedElementTexts = new Set(
      Array.from(
        container.querySelectorAll("span, div"),
        (element) => element.textContent,
      ),
    );

    expect(renderedElementTexts).not.toContain("A");
    expect(renderedElementTexts).not.toContain("M");
    expect(renderedElementTexts).not.toContain("+3");
    expect(container.textContent).toContain(
      "Finish setup, then invite the group.",
    );
    expect(container.textContent).toContain(
      "Answer the quiz or check whether the group is waiting.",
    );
    expect(container.textContent).toContain("Open the live verdict.");
    expect(container.textContent).not.toContain("□ Dinner");

    await unmount();
  });

  it("uses Plan action language and still opens the selected Plan", async () => {
    const onOpenPlan = jest.fn();
    const { container, unmount } = await renderPlanListScreen({
      onOpenPlan,
      plans: planListWithLegacyBadges,
    });
    const dashboardText = container.textContent ?? "";

    expect(dashboardText).toContain("Needs you now");
    expect(dashboardText).toContain("Plans in motion");
    expect(dashboardText).toContain("Closed Plans");
    expect(dashboardText).toContain("Needs setup");
    expect(dashboardText).toContain("Quiz open");
    expect(dashboardText).toContain("Pick ready");
    expect(dashboardText).toContain("Closed");
    expect(dashboardText).not.toContain("Created");
    expect(dashboardText).not.toContain("Joined");
    expect(dashboardText).not.toContain("Decided");
    expect(dashboardText).not.toContain("History");

    const joinedPlanButton = container.querySelector<HTMLElement>(
      '[aria-label="Open Quiz open Plan Birthday dinner"]',
    );
    const closedPlanButton = container.querySelector<HTMLElement>(
      '[aria-label="Open Closed Plan Taco Tuesday"]',
    );

    expect(joinedPlanButton).not.toBeNull();
    expect(closedPlanButton).not.toBeNull();

    await act(async () => {
      joinedPlanButton?.click();
      closedPlanButton?.click();
    });

    expect(onOpenPlan).toHaveBeenNthCalledWith(
      1,
      planListWithLegacyBadges.joined[0],
    );
    expect(onOpenPlan).toHaveBeenNthCalledWith(
      2,
      planListWithLegacyBadges.history[0],
    );

    await unmount();
  });

  it("exposes mobile dashboard accessibility affordances", async () => {
    const onOpenPlan = jest.fn();
    const { container, unmount } = await renderPlanListScreen({
      onOpenPlan,
      plans: mixedPlanList,
    });

    const settingsButton = container.querySelector<HTMLElement>(
      '[aria-label="Open Settings"]',
    );
    const accountAvatar = container.querySelector<HTMLElement>(
      '[aria-label="Account avatar"]',
    );
    const currentPlansSection = container.querySelector<HTMLElement>(
      '[aria-label="Plans current section"]',
    );
    const secondaryPlanRail = container.querySelector<HTMLElement>(
      '[aria-label="Plans in motion secondary browsing"]',
    );
    const nextUpButton = container.querySelector<HTMLElement>(
      '[aria-label="Open Needs you now Plan Brunch plan"]',
    );

    expect(settingsButton).not.toBeNull();
    expect(getComputedStyle(settingsButton as Element).width).toBe("44px");
    expect(getComputedStyle(settingsButton as Element).height).toBe("44px");
    expect(accountAvatar?.getAttribute("role")).toBe("img");
    expect(currentPlansSection?.getAttribute("aria-selected")).toBe("true");
    expect(secondaryPlanRail).not.toBeNull();
    expect(nextUpButton?.getAttribute("tabindex")).toBe("0");

    await act(async () => {
      nextUpButton?.focus();
    });
    expect(document.activeElement).toBe(nextUpButton);

    await act(async () => {
      nextUpButton?.click();
    });

    expect(onOpenPlan).toHaveBeenCalledWith(mixedPlanList.created[0]);

    await unmount();
  });
});
