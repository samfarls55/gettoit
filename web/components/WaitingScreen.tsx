// GetToIt web — Surface 04 (Waiting), web fallback variant.
//
// Differences from the mobile app version, enforced by TB-15 scope:
//   * No Auth Upgrade Chip (ADR 0007 forbids Apple Sign-in on web).
//   * No "Decide now" CTA — the web fallback never has the initiator
//     role (initiators created the room in the mobile app) and the migration's
//     fire_verdict() RPC checks `creator_user_id = auth.uid()`.
//   * No "Nudge" CTA — no nudge plumbing is in scope pre-launch.
// What stays: avatar row, "N of M are in" headline, low-emphasis
// countdown, the same animated copy register as the mobile app.
//
// TB-02 (quiz redesign) addition — sg-03 "Download the app" CTA. Renders in
// the dock when the caller is on the web fallback AND anonymous (the
// canonical web invitee state). Suppressed when the user has a real
// identity. Mirrors the conditional render in

// tb-WF-13 (workflow-overhaul) addition — the sg-WF-8 "Getting the app?"
// claim-code mint affordance. Renders as a quiet line below the
// "Download the app" dock when `onMintClaimCode` is wired (the web
// invitee shell on the Waiting screen). It is the same affordance the
// §C read-only verdict card carries; it is absent from the quiz chrome
// and from the §D / §E terminals. See

"use client";

import { type CSSProperties } from "react";

import {
  GettingTheAppAffordance,
  type MintClaimCode,
} from "./GettingTheAppAffordance";
import { AvatarDot, GTIMark, GradientSurface, PillCTA } from "./SunsetPop";
import { MEMBER_COLORS } from "./sunset-pop-data";

export type WaitingMemberView = {
  id: string;
  /** Display initial for the avatar (single character). */
  initial: string;
  /** Whether the member has submitted their vote. */
  answered: boolean;
  /** Whether this member is the current user. The current user gets
   *  the `--sun` chip; everyone else cycles through MEMBER_COLORS. */
  isSelf: boolean;
};

export type WaitingScreenProps = {
  members: ReadonlyArray<WaitingMemberView>;
  /** Seconds remaining until verdict auto-fires. */
  secondsRemaining: number | null;
  /** Name of the next member the surface highlights ("Sam is still
   *  answering…"). Falls back to a generic line when omitted. */
  outstandingName?: string;
  /** sg-03 / TB-02 (quiz redesign) — when both are true, render the
   *  "Download the app" CTA in the dock. Web-fallback anonymous
   *  invitees are the canonical caller; mobile app users and Apple-linked
   *  web users (currently impossible per ADR 0007, but the prop is
   *  here so the suppression is explicit) suppress the CTA. */
  isAnonymous?: boolean;
  /** sg-03 / TB-02 (quiz redesign) — handler for the "Download the app" tap.
   *  The caller is responsible for opening the App Store URL AND
   *  emitting the `waiting_download_cta_tapped` telemetry event per
   *  ADR 0005 before the navigation. The component never opens the
   *  URL itself; the side effects belong to the host page so they
   *  stay testable in isolation. */
  onDownloadApp?: () => void;
  /** sg-WF-8 / tb-WF-13 — the lazy claim-code mint call. When provided,
   *  the "Getting the app?" affordance renders as a quiet line below
   *  the Download dock; tapping it lazily mints a single-use claim code
   *  via this handler (the `mint-claim-code` Edge Function). The web
   *  invitee shell wires it on the Waiting screen; off the shell (the
   *  `/s/` session route) it is omitted and the affordance does not
   *  render. */
  onMintClaimCode?: MintClaimCode;
};

function colorForMember(member: WaitingMemberView, index: number): string {
  if (member.isSelf) return "var(--sun)";
  const palette = MEMBER_COLORS.slice(1);
  return palette[index % palette.length];
}

const canvasWrap: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  color: "var(--paper)",
};

const contentWrap: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  paddingTop: 56,
  paddingBottom: 32,
};

const countdownStyle: CSSProperties = {
  padding: "0 22px",
  textAlign: "center",
  fontFamily: "var(--ff-mono)",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.6)",
  marginBottom: 14,
};

const downloadDockStyle: CSSProperties = {
  padding: "0 22px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const downloadSubscriptStyle: CSSProperties = {
  fontFamily: "var(--ff-body)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.6)",
  textAlign: "center",
};

const mintDockStyle: CSSProperties = {
  padding: "0 22px 18px",
};

export function WaitingScreen({
  members,
  secondsRemaining,
  outstandingName,
  isAnonymous = false,
  onDownloadApp,
  onMintClaimCode,
}: WaitingScreenProps) {
  const answered = members.filter((m) => m.answered).length;
  const total = members.length;

  const mm = secondsRemaining != null
    ? Math.max(0, Math.floor(secondsRemaining / 60))
    : null;
  const ss = secondsRemaining != null
    ? String(Math.max(0, secondsRemaining) % 60).padStart(2, "0")
    : null;
  const countdownLabel =
    mm != null && ss != null ? `Auto-fires in ${mm}:${ss}` : null;

  return (
    <GradientSurface stop="waiting">
      <div style={canvasWrap}>
        <div style={contentWrap}>
          <div
            style={{
              padding: "0 22px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <GTIMark size={16} />
            <div
              className="gti-eyebrow"
              style={{ color: "var(--paper)", opacity: 0.6 }}
            >
              You&apos;re in
            </div>
          </div>

          <div
            style={{
              flex: 1,
              padding: "40px 22px 0",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div
              className="gti-display"
              style={{
                fontSize: 76,
                color: "var(--paper)",
                letterSpacing: "-0.03em",
                lineHeight: 0.95,
              }}
              data-testid="waiting-count"
            >
              {answered} of {total}
            </div>
            <div
              className="gti-display"
              style={{
                fontSize: 34,
                color: "rgba(255,255,255,0.85)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                marginTop: 6,
                textTransform: "uppercase",
              }}
            >
              are in
            </div>

            <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
              {members.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AvatarDot
                    name={m.initial}
                    color={colorForMember(m, i)}
                    answered={m.answered}
                    size={48}
                  />
                </div>
              ))}
            </div>

            {outstandingName ? (
              <div
                style={{
                  marginTop: 36,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.78)",
                  maxWidth: 260,
                }}
              >
                <span style={{ fontWeight: 800 }}>{outstandingName}</span> is
                still answering. We&apos;ll surface the verdict the second
                they&apos;re done — no spinners, promise.
              </div>
            ) : null}
          </div>

          {countdownLabel ? (
            <div
              style={countdownStyle}
              data-testid="waiting-countdown"
            >
              {countdownLabel}
            </div>
          ) : null}

          {/*
            sg-03 / TB-02 (quiz redesign) — "Download the app" CTA dock. Mirrors
            the `platform === 'web' && isAnonymous` branch in
            check `platform` explicitly because this component IS the
            web-fallback render path; the mobile app never instantiates
            it (per the TB-15 comment at the top of the file). Apple-
            linked web users (impossible today per ADR 0007 but
            modeled for forward compatibility) hide the CTA via
            `isAnonymous = false`.
          */}
          {isAnonymous && onDownloadApp ? (
            <div
              style={downloadDockStyle}
              data-testid="waiting-download-dock"
            >
              <PillCTA
                label="Download the app"
                fill="white"
                onClick={onDownloadApp}
              />
              <div
                style={downloadSubscriptStyle}
                data-testid="waiting-download-subscript"
              >
                Then your votes save with you
              </div>
            </div>
          ) : null}

          {/*
            sg-WF-8 / tb-WF-13 — the "Getting the app?" claim-code mint
            affordance. A quiet line in the dock, BELOW the "Download
            the app" CTA, never above the primary "N of M are in" state
            (surface doc §"Getting the app?" — Position (web Waiting)).
            Renders only when the host wired `onMintClaimCode` (the web
            invitee shell on the Waiting screen).
          */}
          {onMintClaimCode ? (
            <div
              style={mintDockStyle}
              data-testid="waiting-getting-the-app-dock"
            >
              <GettingTheAppAffordance onMint={onMintClaimCode} />
            </div>
          ) : null}
        </div>
      </div>
    </GradientSurface>
  );
}
