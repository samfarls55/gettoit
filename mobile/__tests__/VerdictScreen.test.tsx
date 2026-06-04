import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import { VerdictScreen } from "../src/verdict/VerdictScreen";

const groupVerdict = {
  kind: "live" as const,
  roomId: "room-1",
  flavor: "group" as const,
  placeName: "Pico's Taqueria",
  metaLine: "Mexican - $$ - 8 min walk",
  ruleText: "Best fit for the table.",
  timeBadge: {
    time: "7:00 PM",
    audience: "All 2 of you",
  },
  receipts: [
    { id: "user-1", name: "Ava", action: "wanted social" },
    { id: "user-2", name: "Morgan", action: "wanted calm" },
  ],
  primaryActionLabel: "I'm in",
  reroll: {
    burnsRemaining: 3,
    ineligibleReason: null,
    isEligible: true,
    windowClosesAt: null,
  },
};

describe("VerdictScreen", () => {
  it("renders group live verdict details, receipts, and live actions", () => {
    render(<VerdictScreen verdict={groupVerdict} />);

    expect(screen.getByText("Tonight, the verdict is")).toBeOnTheScreen();
    expect(screen.getByText("Pico's Taqueria")).toBeOnTheScreen();
    expect(screen.getByText("Mexican - $$ - 8 min walk")).toBeOnTheScreen();
    expect(screen.getByText("7:00 PM")).toBeOnTheScreen();
    expect(screen.getByText("All 2 of you")).toBeOnTheScreen();
    expect(screen.getByText("Best fit for the table.")).toBeOnTheScreen();
    expect(screen.getByText("Ava")).toBeOnTheScreen();
    expect(screen.getByText("wanted social")).toBeOnTheScreen();
    expect(screen.getByText("Morgan")).toBeOnTheScreen();
    expect(screen.getByText("wanted calm")).toBeOnTheScreen();
    expect(screen.getByText("I'm in")).toBeOnTheScreen();
    expect(screen.getByText("Reroll · 3 left")).toBeOnTheScreen();
  });

  it("renders solo live verdict copy and suppresses group-only behavior", () => {
    render(
      <VerdictScreen
        verdict={{
          ...groupVerdict,
          flavor: "solo",
          timeBadge: { time: "7:00 PM", audience: "" },
          receipts: [],
          primaryActionLabel: "Save taste profile",
        }}
      />,
    );

    expect(screen.getByText("Your solo pick")).toBeOnTheScreen();
    expect(screen.getByText("Pico's Taqueria")).toBeOnTheScreen();
    expect(screen.getByText("7:00 PM")).toBeOnTheScreen();
    expect(screen.queryByText("All 2 of you")).toBeNull();
    expect(screen.queryByText("Ava")).toBeNull();
    expect(screen.queryByText("wanted social")).toBeNull();
    expect(screen.getByText("Save taste profile")).toBeOnTheScreen();
  });

  it("renders ineligible reroll constraints without an action", () => {
    render(
      <VerdictScreen
        verdict={{
          ...groupVerdict,
          reroll: {
            burnsRemaining: 0,
            ineligibleReason: "No rerolls left. Tonight is locked.",
            isEligible: false,
            windowClosesAt: "2026-06-05T23:59:59Z",
          },
        }}
      />,
    );

    expect(
      screen.getByText("No rerolls left. Tonight is locked."),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Reroll · 3 left")).toBeNull();
  });

  it("runs eligible rerolls through the repository action", async () => {
    const onReroll = jest.fn().mockResolvedValue(undefined);

    render(<VerdictScreen verdict={groupVerdict} onReroll={onReroll} />);

    fireEvent.press(screen.getByText("Reroll · 3 left"));

    await waitFor(() => {
      expect(onReroll).toHaveBeenCalledWith({
        roomId: "room-1",
        reason: "mood",
      });
    });
  });

  it("renders no-survivor widen controls and reruns through the repository action", async () => {
    const onWidenAndRerun = jest.fn().mockResolvedValue(undefined);

    render(
      <VerdictScreen
        onWidenAndRerun={onWidenAndRerun}
        verdict={{
          kind: "noSurvivor",
          roomId: "room-1",
          currentRadiusMiles: 2,
          maxRadiusMiles: 5,
          minRadiusMiles: 1,
          stepMiles: 0.5,
        }}
      />,
    );

    expect(screen.getByText("No spot fits tonight")).toBeOnTheScreen();
    expect(screen.getByText("2.0 mi")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Widen search area"));
    expect(screen.getByText("2.5 mi")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Re-run · 2.5 mi"));

    await waitFor(() => {
      expect(onWidenAndRerun).toHaveBeenCalledWith({
        roomId: "room-1",
        radiusMiles: 2.5,
      });
    });
  });

  it("surfaces no-survivor rerun errors", async () => {
    const onWidenAndRerun = jest.fn().mockRejectedValue(new Error("offline"));

    render(
      <VerdictScreen
        onWidenAndRerun={onWidenAndRerun}
        verdict={{
          kind: "noSurvivor",
          roomId: "room-1",
          currentRadiusMiles: 2,
          maxRadiusMiles: 5,
          minRadiusMiles: 1,
          stepMiles: 0.5,
        }}
      />,
    );

    fireEvent.press(screen.getByText("Re-run · 2.0 mi"));

    await waitFor(() => {
      expect(screen.getByText("Could not re-run. Try again.")).toBeOnTheScreen();
    });
  });

  it("renders read-only verdict records without live-only actions", () => {
    render(<VerdictScreen mode="readOnly" verdict={groupVerdict} />);

    expect(screen.getByText("Closed verdict record")).toBeOnTheScreen();
    expect(screen.getByText("Pico's Taqueria")).toBeOnTheScreen();
    expect(screen.getByText("Mexican - $$ - 8 min walk")).toBeOnTheScreen();
    expect(screen.getByText("Best fit for the table.")).toBeOnTheScreen();
    expect(screen.getByText("Ava")).toBeOnTheScreen();
    expect(screen.getByText("wanted social")).toBeOnTheScreen();
    expect(screen.queryByText("7:00 PM")).toBeNull();
    expect(screen.queryByText("All 2 of you")).toBeNull();
    expect(screen.queryByText("I'm in")).toBeNull();
    expect(screen.queryByText("Reroll")).toBeNull();
    expect(screen.getByText("Start a new decision")).toBeOnTheScreen();
  });
});
