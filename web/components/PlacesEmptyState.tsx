// PlacesEmptyState — web-fallback empty state for the PlacesProxy.
//
// Shown when the PlacesProxy Edge Function returns a thin response or
// errors on the web side. ADR 0002 documents the divergence from the
// mobile app: the web client has no native maps escape hatch, so this is the terminal
// surface when Foursquare can't supply candidates.
//
// — no hand-coded hex / px / easing literals (CLAUDE.md hard rule).
// The fallback retries the original quiz state on the user's tap
// rather than navigating away; TB-15 wires the retry handler into
// the quiz coordinator.

import type { CSSProperties } from "react";

import { APP_STORE_URL } from "../lib/app-store";

export interface PlacesEmptyStateProps {
  /** Optional handler — TB-15 wires this to the quiz coordinator's
   *  retry path. Without a handler the button is rendered as a
   *  link to `/` so the route is reachable as a standalone QA surface. */
  onRetry?: () => void;
}

const containerStyle: CSSProperties = {
  display: "grid",
  gap: "var(--sp-4)",
  textAlign: "center",
  color: "var(--paper)",
  fontFamily: "var(--ff-display)",
  maxWidth: "32rem",
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--ff-body)",
  fontWeight: 700,
  fontSize: "var(--fz-eyebrow)",
  letterSpacing: "var(--tr-eyebrow)",
  textTransform: "uppercase",
  opacity: 0.78,
};

const headlineStyle: CSSProperties = {
  fontFamily: "var(--ff-display)",
  fontWeight: 900,
  fontSize: "var(--fz-display-m)",
  letterSpacing: "var(--tr-display)",
  lineHeight: 0.92,
  margin: 0,
};

const bodyStyle: CSSProperties = {
  fontFamily: "var(--ff-body)",
  fontWeight: 500,
  fontSize: "var(--fz-body)",
  lineHeight: 1.45,
  opacity: 0.86,
  margin: 0,
};

// wfr-31 — the fallback mentions the mobile app as the way out, so the
// app phrase itself is the App Store link. Inline (rather than a dedicated
// CTA) keeps "Try again" / "Start over" as the dominant action while
// still making the mobile path reachable. The link inherits the body
// color and underlines so it reads as a link without inventing new
// chrome — consistent with the SessionRoom S04 web-fallback affordance
// in `app-store.ts`.
const appLinkStyle: CSSProperties = {
  color: "inherit",
  textDecoration: "underline",
};

const ctaStyle: CSSProperties = {
  marginTop: "var(--sp-4)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--ff-body)",
  fontWeight: 700,
  fontSize: "var(--fz-body)",
  padding: "var(--sp-3) var(--sp-5)",
  background: "var(--paper)",
  color: "var(--ink)",
  border: "none",
  borderRadius: "var(--r-pill)",
  cursor: "pointer",
  textDecoration: "none",
};

export function PlacesEmptyState({ onRetry }: PlacesEmptyStateProps) {
  return (
    <section
      role="alert"
      aria-live="polite"
      data-testid="places-empty-state"
      style={containerStyle}
    >
      <p style={eyebrowStyle}>Nearby</p>
      <h1 style={headlineStyle}>Couldn&apos;t load options nearby.</h1>
      <p style={bodyStyle}>
        We hit a snag pulling places from Foursquare. Try again in a moment —
        or open the{" "}
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={appLinkStyle}
          data-testid="places-empty-app-link"
        >
          GetToIt mobile app
        </a>
        , which can fall back to Apple Maps.
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={ctaStyle}
          data-testid="places-empty-retry"
        >
          Try again
        </button>
      ) : (
        <a href="/" style={ctaStyle} data-testid="places-empty-retry">
          Start over
        </a>
      )}
    </section>
  );
}
