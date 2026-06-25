// PlacesEmptyState — web-fallback empty state for the PlacesProxy.
//
// Shown when the PlacesProxy Edge Function cannot supply candidates on
// the web side.
//
// — no hand-coded hex / px / easing literals (CLAUDE.md hard rule).
// The fallback retries the original quiz state on the user's tap
// rather than navigating away; TB-15 wires the retry handler into
// the quiz coordinator.

import type { CSSProperties } from "react";
import Link from "next/link";

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
  width: "100%",
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
  overflowWrap: "break-word",
  textWrap: "balance",
};

const bodyStyle: CSSProperties = {
  fontFamily: "var(--ff-body)",
  fontWeight: 500,
  fontSize: "var(--fz-body)",
  lineHeight: 1.45,
  opacity: 0.86,
  maxWidth: 320,
  margin: "0 auto",
};

const appLinkStyle: CSSProperties = {
  color: "inherit",
  textDecoration: "underline",
};

const ctaStyle: CSSProperties = {
  marginTop: "var(--sp-4)",
  display: "inline-flex",
  justifySelf: "center",
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
        We hit a snag pulling places nearby. Try again in a moment
        {APP_STORE_URL ? (
          <>
            {" "}
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
            {" "}for the full experience
          </>
        ) : null}
        .
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
        <Link href="/" style={ctaStyle} data-testid="places-empty-retry">
          Start over
        </Link>
      )}
    </section>
  );
}
