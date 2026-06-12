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
  formattedAddress: "1 Main St",
  googleMapsUri: "https://maps.google.example/picos",
  attributionText: "Powered by Google",
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

    expect(screen.getByText("Live verdict")).toBeOnTheScreen();
    expect(screen.getByText("LOCKED")).toBeOnTheScreen();
    expect(screen.getByText("Tonight at 7:00 PM")).toBeOnTheScreen();
    expect(screen.getByText("PICO'S\nTAQUERIA")).toBeOnTheScreen();
    expect(screen.getByText("1 Main St")).toBeOnTheScreen();
    expect(screen.getByText("https://maps.google.example/picos")).toBeOnTheScreen();
    expect(screen.getByText("Powered by Google")).toBeOnTheScreen();
    expect(screen.queryByText("4.8")).toBeNull();
    expect(screen.queryByText("Open now")).toBeNull();
    expect(screen.queryByText("Best rated nearby")).toBeNull();
    expect(screen.getByText("7:00 PM")).toBeOnTheScreen();
    expect(screen.getByText("Meet there")).toBeOnTheScreen();
    expect(screen.getByText("All 2 of you")).toBeOnTheScreen();
    expect(screen.getByText("Rule proof")).toBeOnTheScreen();
    expect(screen.getByText("Best fit for the table.")).toBeOnTheScreen();
    expect(screen.getByText("Member receipts")).toBeOnTheScreen();
    expect(screen.getByText("Ava: wanted social")).toBeOnTheScreen();
    expect(screen.getByText("Morgan: wanted calm")).toBeOnTheScreen();
    expect(screen.getByText("I'm in")).toBeOnTheScreen();
    expect(screen.getByText("Reroll with reason, 3 left")).toBeOnTheScreen();
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

    expect(screen.getByText("Solo verdict")).toBeOnTheScreen();
    expect(screen.getByText("PICO'S\nTAQUERIA")).toBeOnTheScreen();
    expect(screen.getByText("7:00 PM")).toBeOnTheScreen();
    expect(screen.queryByText("All 2 of you")).toBeNull();
    expect(screen.queryByText("Member receipts")).toBeNull();
    expect(screen.queryByText("Ava: wanted social")).toBeNull();
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
    expect(screen.queryByText("Reroll with reason, 3 left")).toBeNull();
  });

  it("runs eligible rerolls through the repository action", async () => {
    const onReroll = jest.fn().mockResolvedValue(undefined);

    render(<VerdictScreen verdict={groupVerdict} onReroll={onReroll} />);

    fireEvent.press(screen.getByText("Reroll with reason, 3 left"));

    await waitFor(() => {
      expect(onReroll).toHaveBeenCalledWith({
        roomId: "room-1",
        reason: "mood",
      });
    });
  });

  it("renders no-survivor copy without dead rerun controls", () => {
    render(
      <VerdictScreen
        verdict={{
          kind: "noSurvivor",
          roomId: "room-1",
        }}
      />,
    );

    expect(screen.getByText("No spot fits tonight")).toBeOnTheScreen();
    expect(
      screen.getByText("Start a new Plan with a wider search area."),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText("Widen search area")).toBeNull();
    expect(screen.queryByText(/Re-run/)).toBeNull();
  });

  it("renders read-only verdict records without live-only actions", () => {
    render(<VerdictScreen mode="readOnly" verdict={groupVerdict} />);

    expect(screen.getByText("Verdict record")).toBeOnTheScreen();
    expect(screen.getByText("Closed record")).toBeOnTheScreen();
    expect(screen.getByText("PICO'S\nTAQUERIA")).toBeOnTheScreen();
    expect(screen.getByText("1 Main St")).toBeOnTheScreen();
    expect(screen.getByText("https://maps.google.example/picos")).toBeOnTheScreen();
    expect(screen.getByText("Powered by Google")).toBeOnTheScreen();
    expect(screen.getByText("Rule proof")).toBeOnTheScreen();
    expect(screen.getByText("Best fit for the table.")).toBeOnTheScreen();
    expect(screen.getByText("Member receipts")).toBeOnTheScreen();
    expect(screen.getByText("Ava: wanted social")).toBeOnTheScreen();
    expect(screen.queryByText("7:00 PM")).toBeNull();
    expect(screen.queryByText("All 2 of you")).toBeNull();
    expect(screen.queryByText("I'm in")).toBeNull();
    expect(screen.queryByText("Reroll")).toBeNull();
    expect(screen.getByText("Start a new decision")).toBeOnTheScreen();
  });

  it("renders available history records with current refetched Google display", () => {
    render(
      <VerdictScreen
        verdict={{
          kind: "history",
          roomId: "room-history",
          planName: "Taco crawl",
          decidedAtLabel: "Decided Jun 4",
          display: {
            status: "available",
            placeName: "Current Taco",
            formattedAddress: "9 Fresh St",
            googleMapsUri: "https://maps.google.example/current",
            attributionText: "Powered by Google",
          },
        }}
      />,
    );

    expect(screen.getByText("Verdict record")).toBeOnTheScreen();
    expect(screen.getByText("Decided Jun 4")).toBeOnTheScreen();
    expect(screen.getByText("Taco crawl")).toBeOnTheScreen();
    expect(screen.getByText("CURRENT\nTACO")).toBeOnTheScreen();
    expect(screen.getByText("9 Fresh St")).toBeOnTheScreen();
    expect(screen.getByText("https://maps.google.example/current")).toBeOnTheScreen();
    expect(screen.getByText("Powered by Google")).toBeOnTheScreen();
  });

  it("renders degraded history records without stale Google display content", () => {
    render(
      <VerdictScreen
        verdict={{
          kind: "history",
          roomId: "room-history",
          planName: "Taco crawl",
          decidedAtLabel: "Decided Jun 4",
          display: {
            status: "unavailable",
            placeName: "Place unavailable",
            details: "Unavailable details. Current place data could not be refetched.",
          },
        }}
      />,
    );

    expect(screen.getByText("Verdict record")).toBeOnTheScreen();
    expect(screen.getByText("Decided Jun 4")).toBeOnTheScreen();
    expect(screen.getByText("Taco crawl")).toBeOnTheScreen();
    expect(screen.getByText("PLACE\nUNAVAILABLE")).toBeOnTheScreen();
    expect(
      screen.getByText("Unavailable details. Current place data could not be refetched."),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Stale Taco")).toBeNull();
    expect(screen.queryByText("https://maps.google.example/stale")).toBeNull();
    expect(screen.queryByText("Powered by Google")).toBeNull();
  });
});
