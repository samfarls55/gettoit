// GetToIt web — global Footer.
//
// wfr-10. Renders on every web route via `app/layout.tsx`. Surfaces the
// canonical Privacy + Terms legal links.

import type { CSSProperties } from "react";
import Link from "next/link";

const footerStyle: CSSProperties = {
  // Token-driven. tokens.css provides --paper, --sun, --sp-*, --fz-sm,
  // --ff-body, --tr-eyebrow — no inline hex / px / fonts.
  width: "100%",
  padding: "var(--sp-6) var(--sp-6)",
  background: "transparent",
  color: "var(--paper)",
  fontFamily: "var(--ff-body)",
  fontSize: "var(--fz-sm)",
  // Anchor the footer at the bottom of the viewport when content is
  // short, but still flow inline on long pages (legal docs) so it sits
  // after the article rather than overlapping it. `mt: auto` requires
  // the body to be a flex column — layout.tsx sets that up.
  marginTop: "auto",
  // Mobile: stack the link row. Wider viewports: row layout with
  // generous spacing. `flex-wrap` gives graceful collapse without a
  // breakpoint — the dot separators wrap with their preceding link.
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "center",
  gap: "var(--sp-3)",
  opacity: 0.78,
};

const linkStyle: CSSProperties = {
  color: "var(--paper)",
  textDecoration: "underline",
  textUnderlineOffset: "0.18em",
};

const separatorStyle: CSSProperties = {
  // Inline dot separator. Decorative — `aria-hidden` so screen readers
  // hear "Privacy Terms" not "Privacy dot Terms".
  opacity: 0.5,
};

export function Footer() {
  return (
    <footer style={footerStyle}>
      <Link href="/privacy" style={linkStyle}>
        Privacy
      </Link>
      <span aria-hidden="true" style={separatorStyle}>
        {"\u00b7"}
      </span>
      <Link href="/terms" style={linkStyle}>
        Terms
      </Link>
    </footer>
  );
}
