// GetToIt web — the web invitee verdict surface (web-01 §C).
//
// The web invitee verdict surface is the locked
// verdict card": plan name + verdict venue only — "No receipts, no
// per-axis cuts, no rule chip", "No primary CTA". This is a far
// smaller read than the mobile S05 Verdict surface; web/mobile verdict
// parity is not a goal (bug-17).
//
// `SessionRoom` reaches this surface when a room flips to
// `verdict_ready` while the invitee has the Waiting screen open, or
// when a late-joiner boots into a decided room. It is the same §C
// surface the `/join/<roomId>` web invitee shell renders on a
// re-click of a decided Plan — both render through `WebVerdictCard`,
// the one §C-conformant component, so there is a single source of
// truth for the §C layout.
//
// bug-17 — this component previously rendered a TB-15-era full
// verdict (venue hero, meta line, a fixed time badge, rule text,
// per-member receipt chips, a "what got cut" drawer, a "Start a new
// decision" CTA). None of that conforms to §C; it has been removed.

"use client";

import { NO_SURVIVOR_VENUE, type VerdictView } from "../lib/verdict";

import { WebVerdictCard } from "./InviteShellSurfaces";
import type { MintClaimCode } from "./GettingTheAppAffordance";

export function VerdictReadOnly({
  view,
  onMintClaimCode,
}: {
  view: VerdictView;
  /** sg-WF-8 / tb-WF-13 — the lazy claim-code mint call. §C requires
   *  the "Getting the app?" mint line on the verdict card: a returning
   *  invitee of a decided Plan lands on §C, not Waiting, so a
   *  Waiting-only affordance would strand them (bug-17 grill Q3). When
   *  wired, the affordance renders below the verdict card. */
  onMintClaimCode?: MintClaimCode;
}) {
  // §C no-survivor (bug-17 minimal variant) — the same minimal
  // register as the default case: plan name plus a "No spot fits"
  // card in the venue slot. No votes-derived meta line.
  const verdictPlaceName =
    view.mode === "no-survivor" ? NO_SURVIVOR_VENUE : view.verdictPlaceName;

  return (
    <WebVerdictCard
      planName={view.planName}
      verdictPlaceName={verdictPlaceName}
      onMintClaimCode={onMintClaimCode}
    />
  );
}
