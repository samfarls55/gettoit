import {
  createGroupInviteUrl,
  parseInviteUrl,
  resolveInviteLink,
  type InviteLookup,
} from "../src/invites/inviteLinks";

const lookup: InviteLookup = async (roomId) => {
  switch (roomId) {
    case "open-room":
      return { kind: "open", roomId };
    case "quiz-room":
      return { kind: "inProgress", roomId };
    case "waiting-room":
      return { kind: "waiting", roomId };
    case "decided-room":
      return { kind: "decided", roomId };
    case "stale-room":
      return { kind: "stale", roomId };
    default:
      return { kind: "stale", roomId };
  }
};

describe("inviteLinks", () => {
  it.each([
    ["https Universal Link", "https://gettoit.example/join/open-room"],
    ["custom scheme link", "gettoit://join/open-room"],
  ])("parses a %s into a typed invite payload", (_name, url) => {
    expect(parseInviteUrl(url)).toEqual({
      kind: "invite",
      roomId: "open-room",
    });
  });

  it("rejects non-invite URLs", () => {
    expect(parseInviteUrl("https://gettoit.example/privacy")).toEqual({
      kind: "invalid",
      reason: "unsupported-path",
    });
  });

  it("rejects invite URLs with malformed room id encoding", () => {
    expect(parseInviteUrl("https://gettoit.example/join/%E0%A4%A")).toEqual({
      kind: "invalid",
      reason: "malformed-url",
    });
  });

  it("creates group invite URLs through the local link shape", () => {
    expect(
      createGroupInviteUrl({
        baseUrl: "https://gettoit.example",
        roomId: "room-123",
      }),
    ).toBe("https://gettoit.example/join/room-123");
  });

  it.each([
    ["open-room", { kind: "join", roomId: "open-room" }],
    ["quiz-room", { kind: "quiz", roomId: "quiz-room" }],
    ["waiting-room", { kind: "waiting", roomId: "waiting-room" }],
    ["decided-room", { kind: "verdict", roomId: "decided-room" }],
    ["stale-room", { kind: "stale", roomId: "stale-room" }],
  ] as const)("resolves %s invite state", async (roomId, route) => {
    await expect(
      resolveInviteLink(`https://gettoit.example/join/${roomId}`, lookup),
    ).resolves.toEqual(route);
  });

  it("resolves malformed links as invalid", async () => {
    await expect(
      resolveInviteLink("https://gettoit.example/nope", lookup),
    ).resolves.toEqual({
      kind: "invalid",
      reason: "unsupported-path",
    });
  });
});
