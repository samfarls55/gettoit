// sg-WF-6 — reroll-window deadline reference computation.
//
// The canonical implementation of the reroll-window deadline lives in
// SQL: `set_plan_decided_active` in
// `supabase/migrations/20260523000000000_reroll_window_deadline.sql`
// computes it inside the `pending → decided-active` UPDATE.
//
// This module is a faithful JS port of that SQL formula, used only by
// the test suite. It exists so the Deno test lane can exercise the
// deadline math end-to-end — feed an instant + an IANA timezone, get
// the deadline instant back — rather than only string-matching the
// migration SQL. The two must stay in lockstep; the SQL is canonical.
//
// The SQL formula (ADR 0016 §1):
//
//   v_area_tz := coalesce(plans.location->>'timeZoneIdentifier', 'UTC')
//   reroll_window_closes_at =
//       (date_trunc('day', now() AT TIME ZONE v_area_tz)
//          + interval '2 days' - interval '1 second') AT TIME ZONE v_area_tz
//
// Reading it: render the verdict-fire instant as the search area's
// wall clock, truncate to that day's midnight, add two days, step back
// one second (→ 23:59:59 on the NEXT calendar day), then re-anchor
// that wall-clock instant to a fixed `timestamptz`.

/// The IANA timezone the deadline is anchored to when a Plan has no
/// `location->>'timeZoneIdentifier'`. Matches the SQL `coalesce(..., 'UTC')`.
export const REROLL_WINDOW_TZ_FALLBACK = "UTC";

/// Resolve the timezone the reroll-window deadline is anchored to for a
/// given Plan `location` jsonb value. Mirrors the SQL
/// `coalesce(plans.location->>'timeZoneIdentifier', 'UTC')`.
///
/// A null/absent `location`, or a `location` with no
/// `timeZoneIdentifier` key, falls back to UTC — defensive only, since
/// a Plan cannot fire a verdict without a location in practice.
export function resolveRerollWindowTz(
  location: Record<string, unknown> | null | undefined,
): string {
  const raw = location?.["timeZoneIdentifier"];
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }
  return REROLL_WINDOW_TZ_FALLBACK;
}

// The wall-clock parts of an instant rendered in a given IANA zone.
interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
}

// Render a UTC instant as wall-clock parts in `timeZone`. This is the
// JS analogue of `<timestamptz> AT TIME ZONE <tz>`.
function partsInZone(instant: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const lookup: Record<string, number> = {};
  for (const part of fmt.formatToParts(instant)) {
    if (part.type !== "literal") {
      // `hour` can come back as "24" at midnight in some runtimes —
      // normalise to 0.
      const value = Number(part.value);
      lookup[part.type] = part.type === "hour" && value === 24 ? 0 : value;
    }
  }
  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour: lookup.hour,
    minute: lookup.minute,
    second: lookup.second,
  };
}

// Given wall-clock parts that are to be interpreted *in* `timeZone`,
// return the UTC instant they denote. This is the JS analogue of
// `<timestamp> AT TIME ZONE <tz>`.
//
// We can't directly construct an instant from a wall-clock-in-tz, so
// we solve for the zone offset: take the wall-clock as if it were UTC,
// then ask what that provisional instant looks like back in `timeZone`,
// and correct by the difference. One correction pass is exact for all
// fixed-offset and standard DST zones (the residual after the first
// pass is at most a whole-hour DST step, which the second comparison
// catches; we run two passes for safety around DST boundaries).
function instantFromZonedParts(parts: ZonedParts, timeZone: string): Date {
  const asUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let guess = asUtcMs;
  for (let pass = 0; pass < 2; pass++) {
    const back = partsInZone(new Date(guess), timeZone);
    const backAsUtcMs = Date.UTC(
      back.year,
      back.month - 1,
      back.day,
      back.hour,
      back.minute,
      back.second,
    );
    const drift = backAsUtcMs - asUtcMs;
    if (drift === 0) {
      return new Date(guess);
    }
    guess -= drift;
  }
  return new Date(guess);
}

/// Compute the reroll-window deadline for a Plan whose verdict fired at
/// `verdictFiredAt`, anchored to IANA timezone `timeZone`. Returns the
/// deadline as a UTC `Date` (the `timestamptz` instant the SQL stores
/// in `plans.reroll_window_closes_at`).
///
/// The deadline is 23:59:59 on the calendar day AFTER `verdictFiredAt`,
/// measured in `timeZone`'s wall clock. A faithful port of the
/// `set_plan_decided_active` SQL formula — the SQL is canonical.
///
/// The SQL does the `date_trunc + interval` arithmetic on a *naive*
/// `timestamp` (no zone), so it is pure calendar arithmetic — no DST
/// adjustment until the final `AT TIME ZONE`. This port mirrors that:
/// it works on the wall-clock calendar parts directly, advancing the
/// date by one calendar day, then anchors `23:59:59` of that day to
/// `timeZone` exactly once.
export function computeRerollWindowDeadline(
  verdictFiredAt: Date,
  timeZone: string,
): Date {
  // now() AT TIME ZONE tz — the verdict-fire instant as the search
  // area's wall clock. date_trunc('day', ...) keeps only the date.
  const fired = partsInZone(verdictFiredAt, timeZone);

  // (midnight today) + interval '2 days' - interval '1 second', all in
  // naive wall-clock arithmetic, is exactly 23:59:59 on the NEXT
  // calendar day. Advance the date by one calendar day using a UTC
  // anchor purely as a calendar calculator (the time-of-day is fixed
  // and irrelevant to the day rollover).
  const nextDay = new Date(
    Date.UTC(fired.year, fired.month - 1, fired.day + 1),
  );

  // 23:59:59 of that next calendar day, anchored back to `timeZone`
  // via the single final AT TIME ZONE conversion.
  return instantFromZonedParts(
    {
      year: nextDay.getUTCFullYear(),
      month: nextDay.getUTCMonth() + 1,
      day: nextDay.getUTCDate(),
      hour: 23,
      minute: 59,
      second: 59,
    },
    timeZone,
  );
}
