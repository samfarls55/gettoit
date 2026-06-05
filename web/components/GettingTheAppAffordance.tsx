// GetToIt web — "Getting the app?" claim-code mint affordance.
//
// tb-WF-13 — the web side of the web-invitee account-claim bridge
// (ADR 0015). A Web invitee who votes in the browser and then installs
// the mobile app gets a fresh, disjoint Apple `user_id` — their browser
// vote strands. This affordance is where the web side MINTS the
// single-use claim code that carries the browser's anonymous identity
// across; the app side that RECEIVES it is the S00a "Voted on the web?"
// entry (tb-WF-14).
//
// Canonical spec: `design-system/surfaces/web-01-invitee-shell.md`
// §"Getting the app?" mint affordance (sg-WF-8). This is pure
// composition of existing primitives — the `eyebrow`-token text-link
// treatment for the collapsed line, the `Glass` `soft` card + the
// `mono-tag` type token for the revealed code. No new design-system
// component, no new token, no inline hex.
//
// ── Lazy mint ───────────────────────────────────────────────────────
// The code is generated ON THE TAP, never eagerly (decision doc §Q4):
// it keeps the surface clean, never mints unused codes, and mints at
// the moment of intent because the code carries a live session key that
// can go stale. The `onMint` prop is the lazy-mint call — the host
// (`SessionRoom` for the Waiting screen, the shell for the verdict
// card) wires it to the `mint-claim-code` Edge Function.

"use client";

import { type CSSProperties, useCallback, useRef, useState } from "react";

import { Glass } from "./SunsetPop";

/** The async mint call. Resolves to the minted claim code string;
 *  rejects on a transport / server failure (the affordance then shows
 *  a quiet retry line). */
export type MintClaimCode = () => Promise<string>;

type MintState =
  // The collapsed quiet line — the default state.
  | { kind: "collapsed" }
  // A mint is in flight (first mint, or a re-mint).
  | { kind: "minting" }
  // A code is minted and shown.
  | { kind: "revealed"; code: string }
  // The mint failed — a non-blocking retry line is shown.
  | { kind: "error" };

// The collapsed quiet line — `eyebrow`-token text-link treatment:
// Inter 700 / 11 / tracking 0.18em / UPPERCASE, white 0.6, a 44pt-tall
// hit row. The same low-key treatment the rest of the design system
// uses for secondary text links.
const quietLine: CSSProperties = {
  appearance: "none",
  border: 0,
  background: "transparent",
  cursor: "pointer",
  width: "100%",
  minHeight: 44,
  fontFamily: "var(--ff-body)",
  fontWeight: 700,
  fontSize: "var(--fz-eyebrow)",
  letterSpacing: "var(--tr-eyebrow)",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.6)",
  textAlign: "center",
};

export function GettingTheAppAffordance({
  onMint,
}: {
  /** The lazy-mint call — fired on the "Getting the app?" tap and on a
   *  re-mint. Resolves to the claim code, rejects on failure. */
  onMint: MintClaimCode;
}) {
  const [state, setState] = useState<MintState>({ kind: "collapsed" });
  // Guard against a double-tap firing two mints before the first
  // resolves and flips the state.
  const mintInFlight = useRef(false);

  const runMint = useCallback(async () => {
    if (mintInFlight.current) return;
    mintInFlight.current = true;
    setState({ kind: "minting" });
    try {
      const code = await onMint();
      setState({ kind: "revealed", code });
    } catch {
      // Failure is visible and recoverable (ADR 0015 §Why #4) — a quiet
      // retry line, never a crash and never a silent loss.
      setState({ kind: "error" });
    } finally {
      mintInFlight.current = false;
    }
  }, [onMint]);

  // ── Collapsed — the quiet "Getting the app?" line ─────────────────
  if (state.kind === "collapsed") {
    return (
      <div data-testid="getting-the-app-affordance">
        <button
          type="button"
          onClick={runMint}
          style={quietLine}
          data-testid="getting-the-app-trigger"
        >
          Getting the app?
        </button>
      </div>
    );
  }

  // ── Minting — the in-flight line ──────────────────────────────────
  if (state.kind === "minting") {
    return (
      <div data-testid="getting-the-app-affordance">
        <div
          style={{ ...quietLine, cursor: "default" }}
          data-testid="getting-the-app-minting"
        >
          Getting your code&hellip;
        </div>
      </div>
    );
  }

  // ── Error — a non-blocking retry line ─────────────────────────────
  if (state.kind === "error") {
    return (
      <div data-testid="getting-the-app-affordance">
        <p
          data-testid="getting-the-app-error"
          style={{
            margin: "0 auto",
            maxWidth: 280,
            fontFamily: "var(--ff-body)",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.7)",
            textAlign: "center",
          }}
        >
          Couldn&apos;t get a code just now.
        </p>
        <button
          type="button"
          onClick={runMint}
          style={quietLine}
          data-testid="getting-the-app-retry"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Revealed — the minted code + instructions ─────────────────────
  // The revealed state replaces the quiet line in place (not a route
  // change). The code sits in a `Glass` `soft` card with the `mono-tag`
  // type treatment scaled up for legibility.
  return (
    <div
      data-testid="getting-the-app-affordance"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        animation: "gti-fade-up 320ms var(--ease-out-soft) both",
      }}
    >
      <Glass soft style={{ padding: "16px 18px" }}>
        <div
          // `key` on the code so a re-mint re-mounts the line and the
          // entrance fade replays for the fresh value.
          key={state.code}
          data-testid="getting-the-app-code"
          style={{
            fontFamily: "var(--ff-mono)",
            fontSize: 22,
            fontWeight: 500,
            // The `mono-tag` token treatment — UPPERCASE, generous
            // tracking — scaled up so an opaque token reads
            // character-by-character.
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--paper)",
            textAlign: "center",
            // Pull the tracking off the trailing edge so the block
            // stays optically centered.
            paddingLeft: "0.22em",
          }}
        >
          {state.code}
        </div>
      </Glass>
      <p
        data-testid="getting-the-app-instructions"
        style={{
          margin: 0,
          fontFamily: "var(--ff-body)",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.4,
          color: "rgba(255,255,255,0.78)",
          textAlign: "center",
          textWrap: "balance",
        }}
      >
        Enter this code in the app under &ldquo;Voted on the web?&rdquo; to
        bring this Plan with you.
      </p>
      <button
        type="button"
        onClick={runMint}
        style={quietLine}
        data-testid="getting-the-app-remint"
      >
        New code
      </button>
    </div>
  );
}
