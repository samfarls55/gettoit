export type InvitePayload =
  | { kind: "invite"; roomId: string }
  | { kind: "invalid"; reason: "malformed-url" | "unsupported-path" };

export type InviteRoomState =
  | { kind: "open"; roomId: string }
  | { kind: "inProgress"; roomId: string }
  | { kind: "waiting"; roomId: string }
  | { kind: "decided"; roomId: string }
  | { kind: "stale"; roomId: string };

export type InviteRouteResolution =
  | { kind: "join"; roomId: string }
  | { kind: "quiz"; roomId: string }
  | { kind: "waiting"; roomId: string }
  | { kind: "verdict"; roomId: string }
  | { kind: "stale"; roomId: string }
  | {
      kind: "invalid";
      reason: Extract<InvitePayload, { kind: "invalid" }>["reason"];
    };

export type InviteLookup = (roomId: string) => Promise<InviteRoomState>;

export function parseInviteUrl(url: string): InvitePayload {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return { kind: "invalid", reason: "malformed-url" };
  }

  const pathParts =
    parsedUrl.protocol === "gettoit:"
      ? [parsedUrl.hostname, ...parsedUrl.pathname.split("/").filter(Boolean)]
      : parsedUrl.pathname.split("/").filter(Boolean);

  if (pathParts.length !== 2 || pathParts[0] !== "join" || !pathParts[1]) {
    return { kind: "invalid", reason: "unsupported-path" };
  }

  return {
    kind: "invite",
    roomId: decodeURIComponent(pathParts[1]),
  };
}

export function createGroupInviteUrl({
  baseUrl,
  roomId,
}: {
  baseUrl: string;
  roomId: string;
}): string {
  return `${baseUrl.replace(/\/$/, "")}/join/${encodeURIComponent(roomId)}`;
}

export async function resolveInviteLink(
  url: string,
  lookup: InviteLookup,
): Promise<InviteRouteResolution> {
  const payload = parseInviteUrl(url);

  if (payload.kind === "invalid") {
    return payload;
  }

  const inviteState = await lookup(payload.roomId);

  switch (inviteState.kind) {
    case "open":
      return { kind: "join", roomId: inviteState.roomId };
    case "inProgress":
      return { kind: "quiz", roomId: inviteState.roomId };
    case "waiting":
      return { kind: "waiting", roomId: inviteState.roomId };
    case "decided":
      return { kind: "verdict", roomId: inviteState.roomId };
    case "stale":
      return { kind: "stale", roomId: inviteState.roomId };
  }
}
