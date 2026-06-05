// GetToIt web — web-01 re-click surfaces (tb-WF-12).
//
// The terminal-or-card surfaces the web invitee shell renders on a
// re-click of a `/join/<roomId>` link, plus the leave-confirm sheet:
//
//   §C `WebVerdictCard`     — a read-only verdict card for a decided
//                             Plan: plan name + verdict venue, no CTA.
//   §D `PlanClosedTerminal` — the "this plan is closed" terminal for an
//                             unresolved membership (anon-TTL purge, or
//                             a stranger opening a forwarded link).
//   §E `PlanLeftTerminal`   — the "you left this plan" terminal.
//   §E `LeaveConfirmSheet`  — the confirm step reusing the locked
//                             `joinedLeave` copy from S00 Plan list.
//
// §C / §D / §E. Behavior is locked in the decision doc
// `gti-vault/50_product/workflow-overhaul-web-invitee-flow.md`
// §Q6 (decided re-click) and §Q7 (leave).
//
// rather than importing the JSX; every color resolves to a registered
// Sunset Pop token (CSS custom properties from `tokens.css`) or an
// rgba-white the orphan-hex sweep ignores — no new token, no new
// component, no inline hex.

"use client";

import Link from "next/link";
import { type CSSProperties } from "react";

import {
  GettingTheAppAffordance,
  type MintClaimCode,
} from "./GettingTheAppAffordance";
import { GTIMark, Glass, GradientSurface, PillCTA } from "./SunsetPop";

// The shared content column from the surface doc §"Shared shell chrome":
// centered, max-width 360, h-padding 22. The terminals and the verdict
// card all use it.
const shellColumn: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  width: "100%",
  maxWidth: 360,
  marginInline: "auto",
  textAlign: "center",
};

const shellWrap: CSSProperties = {
  position: "absolute",
  inset: 0,
  padding: "22px 22px 24px",
  display: "flex",
  flexDirection: "column",
  color: "var(--paper)",
};

// ───────────────────────────────────────────────────────────────────
// §C — Read-only verdict card
// ───────────────────────────────────────────────────────────────────

/** The read-only verdict card a web invitee reaches on a re-click of a
 *  decided Plan (surface doc §C). A web invitee never has a reroll
 *  affordance, so `decided-active` and `decided-expired` are
 *  indistinguishable to them and collapse to this one card.
 *
 *  Plan name + verdict venue only — no receipts, no per-axis cuts
 *  (`votes` is ephemeral and gone by the time a Plan is decided). No
 *  primary CTA: the card is terminal-by-completion.
 *
 *  sg-WF-8 / tb-WF-13 — the one install-adjacent affordance the card
 *  carries is the low-key "Getting the app?" claim-code mint line. When
 *  `onMintClaimCode` is wired, it renders as a quiet footer below the
 *  verdict card; it is not a primary CTA and never competes with the
 *  plan name + venue for the eye (surface doc §C — No primary CTA). */
export function WebVerdictCard({
  planName,
  verdictPlaceName,
  onMintClaimCode,
}: {
  planName: string;
  verdictPlaceName: string;
  /** sg-WF-8 / tb-WF-13 — the lazy claim-code mint call. When provided,
   *  the "Getting the app?" affordance renders below the verdict card.
   *  The web invitee shell wires it; absent it the card stays purely
   *  CTA-less. */
  onMintClaimCode?: MintClaimCode;
}) {
  return (
    <GradientSurface stop="verdict">
      <div style={shellWrap} data-testid="web-verdict-card">
        <GTIMark size={20} />
        <div style={shellColumn}>
          {/* eyebrow → 10 → plan name → 18 → verdict card */}
          <div
            className="gti-eyebrow"
            style={{ opacity: 0.78, color: "var(--paper)" }}
          >
            Tonight&apos;s verdict
          </div>
          <h1
            className="gti-display"
            style={{
              fontSize: 32,
              margin: "10px 0 0",
              textWrap: "balance",
            }}
          >
            {planName}
          </h1>
          <Glass style={{ marginTop: 18, padding: "20px 18px" }}>
            <div
              // `key` on the venue so a reroll-driven live update
              // re-mounts the line and the fade plays (§C cross-fade).
              key={verdictPlaceName}
              style={{
                fontFamily: "var(--ff-body)",
                fontWeight: 800,
                fontSize: 22,
                color: "var(--paper)",
                textAlign: "center",
                lineHeight: 1.2,
                // §C — the venue cross-fades to a new value when a
                // reroll changes the verdict while the card is open.
                animation: "gti-fade-up 320ms var(--ease-out) both",
              }}
              data-testid="web-verdict-venue"
            >
              {verdictPlaceName}
            </div>
          </Glass>
        </div>
        {/*
          sg-WF-8 / tb-WF-13 — the "Getting the app?" mint affordance.
          Below the verdict card, before the bottom `auto` spacer — a
          quiet footer line (surface doc §C — Position (§C verdict
          card)). `shellColumn` carries the centered max-width 360
          column the card uses, so the footer aligns with it.
        */}
        {onMintClaimCode ? (
          <div
            style={{ ...shellColumn, flex: "0 0 auto", paddingTop: 20 }}
            data-testid="web-verdict-getting-the-app"
          >
            <GettingTheAppAffordance onMint={onMintClaimCode} />
          </div>
        ) : null}
      </div>
    </GradientSurface>
  );
}

// ───────────────────────────────────────────────────────────────────
// §D — "This plan is closed" terminal
// ───────────────────────────────────────────────────────────────────

/** The terminal for a re-click whose membership does not resolve —
 *  the member row was purged by the 30-day anonymous-user TTL
 *  (ADR 0006), or a stranger opened a forwarded link (surface doc §D).
 *
 *  `midnight` gradient — calm and final, never a red error register
 *  (Sunset Pop has no red). No CTA: there is nothing the invitee can
 *  do; the body points them at the human who shared the link.
 *
 *  wfr-20 — the body still names the human as the next step, but a
 *  quiet tertiary "Back to GetToIt" link below the body gives the
 *  stranded invitee a contextual escape hatch to the landing surface,
 *  duplicating the global wfr-18 GTIMark wordmark link as a
 *  strict-secondary affordance (Escape Hatch pattern). */
export function PlanClosedTerminal() {
  return (
    <PostFlowTerminal
      testId="plan-closed-terminal"
      headline="This plan is closed"
      body="This invite has wrapped up. Ask whoever shared it to start a new one."
    />
  );
}

// ───────────────────────────────────────────────────────────────────
// §E — "You left this plan" terminal
// ───────────────────────────────────────────────────────────────────

/** The terminal a web invitee lands on after a confirmed leave
 *  (surface doc §E). No upsell — the web fallback is plumbing, not a
 *  growth surface. No CTA: re-clicking the link is the rejoin path,
 *  and the body copy says so.
 *
 *  wfr-20 — same quiet tertiary "Back to GetToIt" link as §D. The
 *  rejoin path is the invite link the invitee already has; this link
 *  is the GetToIt-home escape hatch for the invitee who is done. */
export function PlanLeftTerminal() {
  return (
    <PostFlowTerminal
      testId="plan-left-terminal"
      headline="You left this plan"
      body="Your answers were removed. Tap the link again any time to rejoin."
    />
  );
}

/** The shared §D / §E post-flow terminal shape — both are calm
 *  `midnight` dead-ends with the bare `"This plan"` eyebrow, a flat
 *  factual headline, and a one-line body. No primary CTA on either.
 *
 *  wfr-20 — Below the body, a contextual "Back to GetToIt" tertiary
 *  link gives the stranded invitee an Escape Hatch back to the
 *  landing surface (`/`). It duplicates the destination of the global
 *  wfr-18 GTIMark wordmark link but lives in body-flow so the user
 *  whose eye is on the copy ("Ask whoever shared it…" / "Tap the
 *  link again…") has the home affordance in their gaze.
 *
 *  Styled as an `eyebrow`-token tertiary link (uppercase, small,
 *  white 0.6, no underline, 44pt-tall hit row) — explicitly NOT a
 *  CTA. It does not compete with the headline for the eye; it sits
 *  as the same quiet weight as the §E `LeaveConfirmSheet` `STAY`
 *  dismiss row, so the visual register is consistent across the
 *  shell's quiet exits. */
function PostFlowTerminal({
  testId,
  headline,
  body,
}: {
  testId: string;
  headline: string;
  body: string;
}) {
  return (
    <GradientSurface stop="midnight">
      <div style={shellWrap} data-testid={testId}>
        <GTIMark size={20} />
        <div style={shellColumn}>
          {/* eyebrow → 10 → headline → 12 → body → 20 → home link */}
          <div
            className="gti-eyebrow"
            style={{ opacity: 0.6, color: "var(--paper)" }}
          >
            This plan
          </div>
          <h1
            className="gti-display"
            style={{
              fontSize: 32,
              margin: "10px 0 0",
              textWrap: "balance",
            }}
          >
            {headline}
          </h1>
          <p
            style={{
              margin: "12px auto 0",
              fontFamily: "var(--ff-body)",
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.78)",
              maxWidth: 280,
              textWrap: "balance",
            }}
          >
            {body}
          </p>
          <Link
            href="/"
            data-testid={`${testId}-home-link`}
            aria-label="Back to GetToIt — home"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
              minHeight: 44,
              marginTop: 20,
              padding: "0 12px",
              fontFamily: "var(--ff-body)",
              fontWeight: 700,
              fontSize: "var(--fz-eyebrow)",
              letterSpacing: "var(--tr-eyebrow)",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.6)",
              textDecoration: "none",
            }}
          >
            Back to GetToIt
          </Link>
        </div>
      </div>
    </GradientSurface>
  );
}

// ───────────────────────────────────────────────────────────────────
// §E — Leave confirm sheet
// ───────────────────────────────────────────────────────────────────

/** The confirm step the quiz-chrome `Leave` affordance opens
 *  (surface doc §E). Reuses the locked `joinedLeave` copy from
 *  surfaces/00-plan-list.md verbatim — title, body, primary, dismiss.
 *
 *  The destructive weight is carried by the copy, never by a colored
 *  button: the primary pill is `fill="white"`, never sun, never any
 *  red token (the S00 confirm-sheet rule). */
export function LeaveConfirmSheet({
  onConfirm,
  onDismiss,
  leaving = false,
}: {
  onConfirm: () => void;
  onDismiss: () => void;
  /** True while the `members` row delete is in flight — disables both
   *  actions so the invitee can't double-fire the leave. */
  leaving?: boolean;
}) {
  return (
    <div
      data-testid="leave-confirm-backdrop"
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.42)",
        display: "grid",
        placeItems: "center",
        padding: "0 22px",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Leave this plan?"
        // Stop the card from bubbling the backdrop's dismiss handler.
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 340,
          background: "rgba(16,17,42,0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "var(--r-sheet)",
          padding: "24px 22px 18px",
          color: "var(--paper)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--ff-body)",
            fontWeight: 800,
            fontSize: 18,
            textAlign: "center",
          }}
        >
          Leave this plan?
        </h2>
        <p
          style={{
            margin: "10px 0 20px",
            fontFamily: "var(--ff-body)",
            fontWeight: 600,
            fontSize: 14,
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.78)",
            textAlign: "center",
            textWrap: "balance",
          }}
        >
          Your answers will be removed. The room continues for everyone else.
        </p>
        <PillCTA
          label={leaving ? "Leaving…" : "Leave plan"}
          fill="white"
          disabled={leaving}
          onClick={onConfirm}
        />
        <button
          type="button"
          onClick={onDismiss}
          disabled={leaving}
          style={{
            appearance: "none",
            border: 0,
            background: "transparent",
            cursor: leaving ? "not-allowed" : "pointer",
            width: "100%",
            minHeight: 44,
            marginTop: 4,
            fontFamily: "var(--ff-body)",
            fontWeight: 700,
            fontSize: "var(--fz-eyebrow)",
            letterSpacing: "var(--tr-eyebrow)",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          STAY
        </button>
      </div>
    </div>
  );
}
