// GetToIt web fallback — root layout.
//
// Pulls `design-system/code/tokens.css` directly so the placeholder
// surface (and every future surface) renders against the canonical
// Sunset Pop tokens — no token duplication on the web side.

import type { Metadata } from "next";
import "../../design-system/code/tokens.css";

export const metadata: Metadata = {
  title: "GetToIt",
  description: "Group decision-paralysis killer. Food vertical v1.",
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
