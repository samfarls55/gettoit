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
//
// bug-02 (v1.1) — the og:image is a static placeholder PNG served
// from `web/public/og/invite.png`. Two deliberate choices here:
//   1. The path has NO query string. Apple iMessage's rich-link
//      cache is strict and prefers a clean static URL; query
//      params can cause it to fall back to plain-text rendering.
//   2. The image is intentionally generic (flat warm gray). The
//      branded version is deferred to the pre-public-launch
//      milestone — see bug-02 issue notes.
// Relative paths resolve against `metadata.metadataBase` (set in
// `app/layout.tsx`) to a fully-qualified `https://gettoit.app/...`
// URL, which iMessage requires.
export async function generateMetadata({
  params,
}: {
  params: { roomId: string };
}): Promise<Metadata> {
  const title = "GetToIt — Where we're eating tonight";
  const description =
    "Answer 5 questions. The verdict drops when everyone's in.";
  const canonical = `https://gettoit.app/join/${params.roomId}`;
  const ogImage = "/og/invite.png";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "GetToIt invite",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    appleWebApp: {
      title: "GetToIt",
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
