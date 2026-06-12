// GetToIt web — /join/<roomId> route.
//
// tb-WF-11 — the web invitee shell. The iMessage / SMS deep link
// `/join/<roomId>` lands a cold invitee directly on the shell scaffold:
// `InviteShell` ensures the anonymous Supabase session, and on a first
// landing renders the name-entry surface (web-01 §A), then hands the
// invitee into the quiz once they have a `members` row.
//
// `generateMetadata` below still emits the OG / Twitter unfurl card the
// iMessage rich-link preview reads — that preview is separate from the
// rendered page body. The page itself is `force-dynamic` because the
// shell is a client component driven by the per-browser anon session.
//

import type { Metadata } from "next";

import { InviteShell } from "../../../components/InviteShell";

export const dynamic = "force-dynamic";

// Build OG/Twitter metadata at render time so iMessage and other
// unfurlers see a card. The roomId is opaque so we don't leak
// any session content into the unfurl preview.
//
// bug-02 (quiz redesign) — the og:image is a static branded PNG served
// from `web/public/og/invite.png`. Two deliberate choices here:
//   1. The path has NO query string. Apple iMessage's rich-link
//      cache is strict and prefers a clean static URL; query
//      params can cause it to fall back to plain-text rendering.
//   2. The image is intentionally room-agnostic so invite previews do
//      not leak Plan details.
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
  // wfr-30 — <main> flows as a flex child of the body column instead of
  // sitting `position: fixed; inset: 0` over the page. The wfr-10 global
  // Footer is a sibling below this <main> in the body's flex column; a
  // fixed-positioned <main> sat in a separate stacking context and
  // visually covered the footer, defeating wfr-10's "footer visible on
  // every web route" acceptance for `/join/[roomId]`. Sized as
  // `flex: 1; position: relative; min-height: 0` so the absolutely-
  // positioned `GradientSurface` (`inset: 0`) inside InviteShell still
  // fills <main> while the Footer renders in the column slot below it.
  return (
    <main
      style={{
        flex: 1,
        position: "relative",
        minHeight: 0,
      }}
    >
      <InviteShell roomId={params.roomId} />
    </main>
  );
}
