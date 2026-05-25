// GetToIt web fallback — root layout.
//
// Pulls `design-system/code/tokens.css` directly so the placeholder
// surface (and every future surface) renders against the canonical
// Sunset Pop tokens — no token duplication on the web side.

import type { Metadata } from "next";
import "../../design-system/code/tokens.css";

// `metadataBase` anchors every relative URL emitted into <meta> tags
// (og:image, twitter:image, canonical, etc.) to the production origin.
// Apple iMessage's rich-link parser rejects relative paths, so anchoring
// here is what lets `/og/invite.png` resolve to the absolute
// `https://gettoit.app/og/invite.png` URL it expects.
export const metadata: Metadata = {
  metadataBase: new URL("https://gettoit.app"),
  title: "GetToIt",
  description: "Group decision-paralysis killer. Food vertical 0.1.0.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
