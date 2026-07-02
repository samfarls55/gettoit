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

const planListWithManyClosedPlans: PlanListSnapshot = {
  ...emptyPlanListSnapshot,
  history: Array.from({ length: 6 }, (_, index) => ({
    id: `closed-plan-${index + 1}`,
    title: `Closed plan ${index + 1}`,
    subtitle: "Closed verdict",
    badge: "History",
    routeTarget: "history",
  })),
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

function getRequiredElement(container: Element, selector: string) {
  const element = container.querySelector<HTMLElement>(selector);

  if (!element) {
    throw new Error(`Expected element matching selector: ${selector}`);
  }

  return element;
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
        '[aria-label="Open Needs you now Plan Brunch plan"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[aria-label="Delete Setup needed Plan Brunch plan"]',
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
      '[aria-label="Create group Plan"]',
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
      "Lock the basics, then send the quiz link.",
    );
    expect(container.textContent).toContain(
      "Your answers unblock the group's pick.",
    );
    expect(container.textContent).toContain(
      "Review the verdict and share the plan.",
    );
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
    expect(dashboardText).toContain("Other active Plans");
    expect(dashboardText).toContain("Closed Plans");
    expect(dashboardText).toContain("Setup needed");
    expect(dashboardText).toContain("Answer needed");
    expect(dashboardText).toContain("Verdict ready");
    expect(dashboardText).toContain("Closed");
    expect(dashboardText).not.toContain("Created");
    expect(dashboardText).not.toContain("Joined");
    expect(dashboardText).not.toContain("Decided");
    expect(dashboardText).not.toContain("History");

    const joinedPlanButton = container.querySelector<HTMLElement>(
      '[aria-label="Open Answer needed Plan Birthday dinner"]',
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

  it("keeps all closed Plans selectable from the dashboard", async () => {
    const onOpenPlan = jest.fn();
    const { container, unmount } = await renderPlanListScreen({
      onOpenPlan,
      plans: planListWithManyClosedPlans,
    });

    expect(container.textContent).toContain("Closed plan 1");
    expect(container.textContent).toContain("Closed plan 6");

    const closedPlanButton = container.querySelector<HTMLElement>(
      '[aria-label="Open Closed Plan Closed plan 6"]',
    );

    expect(closedPlanButton).not.toBeNull();

    await act(async () => {
      closedPlanButton?.click();
    });

    expect(onOpenPlan).toHaveBeenCalledWith(
      planListWithManyClosedPlans.history[5],
    );

    await unmount();
  });

  it("exposes mobile dashboard accessibility affordances", async () => {
    const onOpenPlan = jest.fn();
    const { container, unmount } = await renderPlanListScreen({
      onOpenPlan,
      plans: mixedPlanList,
    });

    const settingsButton = getRequiredElement(
      container,
      '[aria-label="Open Settings"]',
    );
    const accountAvatar = getRequiredElement(
      container,
      '[aria-label="Account avatar"]',
    );
    const currentPlansTab = getRequiredElement(
      container,
      '[aria-label="Plans current section"]',
    );
    const plansInMotionRail = getRequiredElement(
      container,
      '[aria-label="Other active Plans"]',
    );
    const nextUpButton = getRequiredElement(
      container,
      '[aria-label="Open Needs you now Plan Brunch plan"]',
    );

    expect(getComputedStyle(settingsButton).width).toBe("44px");
    expect(getComputedStyle(settingsButton).height).toBe("44px");
    expect(accountAvatar.getAttribute("role")).toBe("img");
    expect(currentPlansTab.getAttribute("aria-selected")).toBe("true");
    expect(plansInMotionRail).toBeDefined();
    expect(nextUpButton.getAttribute("tabindex")).toBe("0");

    await act(async () => {
      nextUpButton.focus();
    });
    expect(document.activeElement).toBe(nextUpButton);

    await act(async () => {
      nextUpButton.click();
    });

    expect(onOpenPlan).toHaveBeenCalledWith(mixedPlanList.created[0]);

    await unmount();
  });
});
