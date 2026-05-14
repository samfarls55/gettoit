// GetToIt web — Surface 02b (Invite web fallback).
//
// Web equivalent of `design-system/code/screens/ScreenInviteWeb.jsx`.
// Rendered at `/join/<roomId>`; routes the invitee to `/s/<roomId>`
// when they pick "Answer in browser". The "Open in app" affordance
// is a normal anchor to the canonical Universal Link — when the
// invitee has the iOS app installed, the browser hands off; when
// not, the link is harmless.

"use client";

import Link from "next/link";

import {
  CTADock,
  Eyebrow,
  GTIMark,
  GradientSurface,
  PillCTA,
} from "./SunsetPop";

export type InviteWebCardProps = {
  roomId: string;
  /** Short, share-friendly room id surfaced under the CTAs. */
  roomShortId?: string;
  /** Expiration hint surfaced under the room id ("expires in 27 min"). */
  expiresIn?: string;
  /** Display name of the initiator. Falls back to "A friend" when
   *  unknown — the web fallback rarely has a display-name source. */
  initiatorName?: string;
};

export function InviteWebCard({
  roomId,
  roomShortId,
  expiresIn,
  initiatorName,
}: InviteWebCardProps) {
  const short = roomShortId ?? roomId.split("-")[0] ?? roomId;
  const initiator = initiatorName ?? "A friend";
  const universalLink = `https://gettoit.app/join/${roomId}`;

  return (
    <GradientSurface stop="initiator">
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "64px 22px 24px",
          display: "flex",
          flexDirection: "column",
          color: "var(--paper)",
        }}
      >
        <GTIMark size={20} />
        <div style={{ marginTop: 40 }}>
          <Eyebrow style={{ marginBottom: 12 }}>
            {initiator} sent you a session
          </Eyebrow>
          <h1
            className="gti-display"
            style={{
              fontSize: 50,
              lineHeight: 0.88,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            Where
            <br />
            we&apos;re
            <br />
            eating
            <br />
            tonight
          </h1>
          <p
            style={{
              margin: "20px 0 0",
              fontSize: 15,
              fontWeight: 600,
              color: "rgba(255,255,255,0.82)",
              maxWidth: 300,
            }}
          >
            Answer 5 questions, the verdict drops when everyone&apos;s in.
          </p>
        </div>
        <CTADock>
          <Link
            href={`/s/${roomId}`}
            style={{ textDecoration: "none" }}
            aria-label="Answer in browser"
            data-testid="invite-cta-answer"
          >
            <PillCTA label="Answer in browser" fill="white" />
          </Link>
          <a
            href={universalLink}
            style={{ textDecoration: "none" }}
            aria-label="Open in app"
            data-testid="invite-cta-open-app"
          >
            <PillCTA label="Open in app" fill="ghost" />
          </a>
          <div
            style={{
              fontSize: 11,
              opacity: 0.6,
              textAlign: "center",
              marginTop: 4,
              letterSpacing: 0.1,
            }}
          >
            gettoit.app/s/{short}
            {expiresIn ? ` · expires in ${expiresIn}` : null}
          </div>
        </CTADock>
      </div>
    </GradientSurface>
  );
}
