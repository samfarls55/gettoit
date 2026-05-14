// GetToIt web — /join/<roomId> route.
//
// Universal-Link landing surface for the web fallback. The iMessage
// preview unfurls this route on hosts that don't have the iOS app
// installed. We render the canonical S02b invite card and route the
// "Answer in browser" CTA to `/s/<roomId>` (the actual session).
//
// Server-rendered. We don't fetch the room here (RLS would block
// anonymous fetches anyway) — the page is a pure marketing surface
// keyed by the URL.

import type { Metadata } from "next";

import { InviteWebCard } from "../../../components/InviteWebCard";

export const dynamic = "force-dynamic";

// Build OG/Twitter metadata at render time so iMessage and other
// unfurlers see a card. The roomId is opaque so we don't leak
// any session content into the unfurl preview.
export async function generateMetadata({
  params,
}: {
  params: { roomId: string };
}): Promise<Metadata> {
  const short = params.roomId.split("-")[0] ?? params.roomId;
  const title = "GetToIt — Where we're eating tonight";
  const description = "Answer 5 questions. The verdict drops when everyone's in.";
  const canonical = `https://gettoit.app/join/${params.roomId}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [`/og/invite.png?room=${short}`],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function JoinPage({
  params,
}: {
  params: { roomId: string };
}) {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
      }}
    >
      <InviteWebCard roomId={params.roomId} />
    </main>
  );
}
