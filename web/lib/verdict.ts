// GetToIt web — verdict shaping helpers.
//
// The web invitee verdict surface is the locked
// `design-system/surfaces/web-01-invitee-shell.md` §C "Read-only
// verdict card": plan name + verdict venue only. §C spells out,
// verbatim, "No receipts, no per-axis cuts, no rule chip" and "No
// primary CTA" — the web invitee card is a far smaller read than the
// mobile S05 Verdict surface.
//
// These helpers shape the rows the engine wrote (`verdicts`,
// `options`) into that §C surface. They carry NO receipt / cut
// machinery: `votes` is ephemeral and gone by the time a Plan is
// decided (decision doc §Q6), so a receipt surface has no live data
// source on web. the mobile app keeps its full receipt surface — web/mobile verdict
// parity is not a goal (bug-17).

export type OptionPayload = {
  fsq_place_id?: string;
  name?: string;
  price_tier?: number;
  walk_minutes_estimate?: number;
  dietary_tags?: string[];
  categories?: string[];
};

export type OptionRow = {
  id: string;
  payload: OptionPayload;
};

export type VerdictRow = {
  id: string;
  room_id: string;
  option_id: string | null;
  computed_at: string;
  method: "manual" | "quorum" | "deadline" | "no_survivor";
  rule_text: string;
};

/** The §C read-only verdict surface — plan name + verdict venue only.
 *
 *  - `default`: a venue was chosen. `verdictPlaceName` is the winning
 *    venue name.
 *  - `no-survivor`: the engine emitted `no_survivor`. §C does not spec
 *    this case (flagged as a separate design-system spec-gap
 *    follow-up); bug-17 ships a minimal variant — plan name plus a
 *    "No spot fits" card in the venue slot, no votes-derived meta line
 *    (its only data source, `votes`, is gone by decided-time). */
export type VerdictView =
  | {
      mode: "default";
      planName: string;
      verdictPlaceName: string;
    }
  | {
      mode: "no-survivor";
      planName: string;
    };

/** The "No spot fits" card copy shown in the venue slot of the §C
 *  no-survivor variant (bug-17 minimal no-survivor case). */
export const NO_SURVIVOR_VENUE = "No spot fits";

/** Shape the §C read-only verdict surface from the engine's rows.
 *
 *  `planName` comes from the joiner-readable `plans_decided_for_user` /
 *  `plans_history_for_user` RPCs (the `plans` table itself carries a
 *  creator-only SELECT policy, so a web invitee cannot read it
 *  directly). `winningOption` is the verdict's `options` row.
 *
 *  Returns `null` for a non-no-survivor verdict with no winning option
 *  — there is no §C surface to render without a venue. */
export function shapeVerdictView(args: {
  verdict: VerdictRow;
  planName: string;
  winningOption: OptionRow | null;
}): VerdictView | null {
  const { verdict, planName, winningOption } = args;

  if (verdict.method === "no_survivor") {
    return {
      mode: "no-survivor",
      planName,
    };
  }

  if (!winningOption) {
    return null;
  }

  return {
    mode: "default",
    planName,
    verdictPlaceName: winningOption.payload.name ?? "Unnamed",
  };
}
