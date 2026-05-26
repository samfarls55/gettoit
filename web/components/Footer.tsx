// GetToIt web — global Footer.
//
// wfr-10. Renders on every web route via `app/layout.tsx`. Surfaces the
// canonical Privacy + Terms legal links and a Help affordance so every
// page (including terminal join states and the legal pages themselves)
// has a discoverable escape to support material.
//
// Help affordance is a labelled placeholder: it is NOT yet wired to
// `mailto:support@gettoit.app` because that mailbox does not exist
// (v1 launch blocker tracked in TB-16). We render "Help (coming soon)"
// so the affordance is discoverable and copy honest, without dropping
// the user into a bounced inbox. When TB-16 ships the mailbox, swap
// the span for an `<a href="mailto:support@gettoit.app">` element.

import type { CSSProperties } from "react";

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

const helpStyle: CSSProperties = {
  // Placeholder Help affordance — visually consistent with the links
  // but explicitly non-interactive until the mailbox exists. Marked
  // with `aria-disabled` so assistive tech surfaces the state.
  color: "var(--paper)",
  opacity: 0.6,
};

const separatorStyle: CSSProperties = {
  // Inline dot separator. Decorative — `aria-hidden` so screen readers
  // hear "Privacy Terms Help" not "Privacy dot Terms dot Help".
  opacity: 0.5,
};

export function Footer() {
  return (
    <footer style={footerStyle}>
      <a href="/privacy" style={linkStyle}>
        Privacy
      </a>
      <span aria-hidden="true" style={separatorStyle}>
        ·
      </span>
      <a href="/terms" style={linkStyle}>
        Terms
      </a>
      <span aria-hidden="true" style={separatorStyle}>
        ·
      </span>
      <span aria-disabled="true" style={helpStyle}>
        Help (coming soon)
      </span>
    </footer>
  );
}
