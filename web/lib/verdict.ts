// GetToIt web — verdict shaping helpers.
//
// The web invitee verdict surface is the locked `web-01-invitee-shell`
// §C verdict card: plan name + verdict venue only. §C spells out,
// verbatim, "No receipts, no per-axis cuts, no rule chip" and "No
// primary CTA" — the web invitee card is a far smaller read than the
// mobile S05 Verdict surface.
//
// These helpers shape the engine's verdict row plus the current
// Plan-state display name into that §C surface. They carry NO receipt / cut
// machinery: `votes` is ephemeral and gone by the time a Plan is
// decided (decision doc §Q6), so a receipt surface has no live data
// source on web. The mobile app keeps its full receipt surface — web/mobile verdict
// parity is not a goal (bug-17).

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
 *  `planName` and `verdictPlaceName` come from the joiner-readable
 *  Plan-state RPCs or current Google display refetch path. This helper
 *  intentionally does not read `options.payload` display fields; those
 *  are stale provider display snapshots in Google-backed flows.
 *
 *  Returns `null` for a non-no-survivor verdict with no place name
 *  — there is no §C surface to render without a venue. */
export function shapeVerdictView(args: {
  verdict: VerdictRow;
  planName: string;
  verdictPlaceName: string | null;
}): VerdictView | null {
  const { verdict, planName, verdictPlaceName } = args;

  if (verdict.method === "no_survivor") {
    return {
      mode: "no-survivor",
      planName,
    };
  }

  const placeName = verdictPlaceName?.trim() ?? "";
  if (!placeName) {
    return null;
  }

  return {
    mode: "default",
    planName,
    verdictPlaceName: placeName,
  };
}
