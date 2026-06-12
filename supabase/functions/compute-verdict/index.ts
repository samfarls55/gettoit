// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// compute-verdict Edge Function â€” runtime entry point.
//
// Composes the pure HTTP handler from `./handler.ts` with the
// supabase-js data adapter and the Deno.serve listener.
//
// References:
//   * Original PRD Â§"VerdictEngine" (gti-vault/10_prds/0.1.0-prd.md)
//   * TB-06 ticket (gti-vault/15_issues/0.1.0/issues/tb-06-verdict-engine-clean-run.md)
//   * Engine spec: supabase/functions/_shared/verdict-engine.ts

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.43.4";
import {
  type ComputeVerdictDataAdapter,
  type ComputeVerdictEnv,
  type GoogleVerdictCandidateRow,
  handleRequest,
  type MemberFetchRow,
  type MemberVoteRow,
  type OptionCutInsert,
  type OptionInsertRow,
  type RoomOptionRow,
  type VerdictInsert,
  type VerdictRow,
  type VerdictSlateEntryInsert,
} from "./handler.ts";
import {
  mapVotesRowToMemberVote,
  mapVotesRowToPreferenceInputs,
  type QuestionSlot,
  type VotesRow,
} from "../_shared/votes-schema.ts";
import { buildVibeFitCandidate } from "../_shared/vibe-fit.ts";
// tb-WF-11 â€” resolves each member's name from the joined
// `members.display_name`, falling back to the `m<uuid>` placeholder.
import { resolveMemberDisplayName } from "./member-display-name.ts";
// `HardVeto` is referenced by the `fetchProfileVetoes` adapter method
// below; import it so `deno check` resolves the type.
import type { HardVeto } from "../_shared/verdict-engine.ts";

const GOOGLE_NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby";
export const GOOGLE_VERDICT_FETCH_FIELD_MASK_VERSION = "verdict_fetch_v1";
export const GOOGLE_VERDICT_FETCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.types",
  "places.primaryType",
  "places.priceLevel",
  "places.rating",
  "places.userRatingCount",
  "places.currentOpeningHours.openNow",
  "places.regularOpeningHours.periods",
  "places.dineIn",
  "places.takeout",
].join(",");
export const GOOGLE_VERDICT_SCORING_FIELD_MASK_VERSION =
  "verdict_scoring_vibe_fit_v1";
export const GOOGLE_VERDICT_SCORING_FIELD_MASK = [
  GOOGLE_VERDICT_FETCH_FIELD_MASK,
  "places.reviewSummary",
  "places.generativeSummary",
  "places.liveMusic",
  "places.goodForGroups",
  "places.goodForWatchingSports",
  "places.outdoorSeating",
].join(",");

function buildSupabaseAdapter(env: ComputeVerdictEnv): ComputeVerdictDataAdapter {
  const supabaseUrl = env.SUPABASE_URL ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const client: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async fetchRoom(room_id) {
      // tb-WF-1 â€” select `plan_id` too so the handler can transition
      // the parent Plan to `decided-active` on a successful verdict.
      // The column exists on every row post-migration (NULL on legacy
      // S01-created rooms); the handler treats a NULL as "no Plan."
      const { data, error } = await client
        .from("rooms")
        .select("id, plan_id, session_params")
        .eq("id", room_id)
        .maybeSingle();
      if (error) {
        console.warn("compute-verdict fetchRoom failed:", error.message);
        return null;
      }
      return (data ?? null) as {
        id: string;
        plan_id: string | null;
        session_params: Record<string, unknown> | null;
      } | null;
    },
    async fetchOptions(room_id): Promise<RoomOptionRow[]> {
      const { data, error } = await client
        .from("options")
        .select("id, google_place_id, place_provider")
        .eq("room_id", room_id);
      if (error) {
        console.warn("compute-verdict fetchOptions failed:", error.message);
        return [];
      }
      return (data ?? []) as RoomOptionRow[];
    },
    async fetchGoogleVerdictCandidates(room_id): Promise<GoogleVerdictCandidateRow[]> {
      const googleApiKey = env.GOOGLE_PLACES_API_KEY ?? "";
      if (!googleApiKey) {
        console.warn("compute-verdict Google verdict fetch skipped: GOOGLE_PLACES_API_KEY is not set");
        return [];
      }
      const { data, error } = await client
        .from("rooms")
        .select("location_lat, location_lng, radius_meters")
        .eq("id", room_id)
        .maybeSingle();
      if (error || !data) {
        console.warn("compute-verdict Google verdict fetch room read failed:", error?.message ?? "no row");
        return [];
      }
      const room = data as {
        location_lat: number | null;
        location_lng: number | null;
        radius_meters: number | null;
      };
      if (
        typeof room.location_lat !== "number" ||
        typeof room.location_lng !== "number" ||
        typeof room.radius_meters !== "number"
      ) {
        console.warn("compute-verdict Google verdict fetch skipped: room search area is incomplete");
        return [];
      }
      const response = await fetch(GOOGLE_NEARBY_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googleApiKey,
          "X-Goog-FieldMask": googleVerdictFieldMask(env),
        },
        body: JSON.stringify({
          includedPrimaryTypes: ["restaurant"],
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: {
                latitude: room.location_lat,
                longitude: room.location_lng,
              },
              radius: room.radius_meters,
            },
          },
        }),
      });
      if (!response.ok) {
        console.warn(`compute-verdict Google verdict fetch failed: ${response.status}`);
        return [];
      }
      return shapeGoogleVerdictCandidates(await response.json(), {
        includeVibeFit: isVibeFitEnabled(env),
      });
    },
    async fetchActiveMemberIds(room_id): Promise<string[]> {
      const { data, error } = await client
        .from("members")
        .select("user_id")
        .eq("room_id", room_id);
      if (error) {
        console.warn("compute-verdict fetchActiveMemberIds failed:", error.message);
        return [];
      }
      return ((data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id);
    },
    async fetchMemberFetches(room_id): Promise<MemberFetchRow[]> {
      // TB-21 â€” read every member's persisted raw Foursquare fetch for
      // the room. `member_fetches.payload` is the jsonb array of every
      // venue the member's fetch returned (the full raw union, not the
      // three Q5 factorial cards). The service-role key bypasses RLS so
      // the union sees every member's fetch, not just the caller's.
      const { data, error } = await client
        .from("member_fetches")
        .select("user_id, payload")
        .eq("room_id", room_id);
      if (error) {
        console.warn("compute-verdict fetchMemberFetches failed:", error.message);
        return [];
      }
      return (data ?? []).map((row) => {
        const payload = (row as { payload?: unknown }).payload;
        return {
          user_id: (row as { user_id: string }).user_id,
          // The DB stores the fetch as a jsonb array; a malformed /
          // non-array payload is tolerated as an empty fetch by the
          // pure union primitive.
          payload: Array.isArray(payload) ? payload : [],
        } satisfies MemberFetchRow;
      });
    },
    async insertOptions(rows: OptionInsertRow[]): Promise<void> {
      // TB-21 â€” write the unioned candidate pool into `options`. The
      // handler calls this only when `options` is empty for the room,
      // so a plain insert is correct; the `options` (room_id,
      // fsq_place_id) UNIQUE constraint is a backstop against a racing
      // concurrent fire, which `ignoreDuplicates` lets through
      // harmlessly rather than failing the verdict.
      if (rows.length === 0) return;
      const { error } = await client
        .from("options")
        .upsert(
          rows.map((r) => ({
            room_id: r.room_id,
            google_place_id: r.google_place_id ?? r.fsq_place_id,
            place_provider: "google",
          })),
          { onConflict: "room_id,place_provider,google_place_id", ignoreDuplicates: true },
        );
      if (error) {
        console.error("compute-verdict insertOptions failed:", error.message);
        throw error;
      }
    },
    async fetchVotes(room_id): Promise<MemberVoteRow[]> {
      // TB-04 â€” `votes` now stores answers in five generic jsonb slots
      // (`q1`..`q5`). The engine's answer fields are derived by the
      // schema-driven mapping layer `_shared/votes-schema.ts`, which
      // dispatches each slot on `meta.question_kind` rather than on a
      // hardcoded column name â€” so quiz content can change without a
      // migration or an engine change.
      const { data, error } = await client
        .from("votes")
        .select("user_id, q1, q2, q3, q4, q5")
        .eq("room_id", room_id);
      if (error) {
        console.warn("compute-verdict fetchVotes failed:", error.message);
        return [];
      }
      // tb-WF-11 â€” join `members.display_name` for the room. The web
      // invitee shell (sg-WF-5 surface Â§A) writes a real name onto the
      // `members` row when a Web invitee enters one on the name-entry
      // surface; iOS members have no name-entry surface so their
      // `display_name` stays NULL. `votes` and `members` share the
      // (room_id, user_id) key but carry no FK between them, so this is
      // a separate read folded into a map rather than a PostgREST
      // embed. A failed members read degrades to "no names" â€” every
      // member then resolves to the `m<uuid>` placeholder, the same
      // behavior as before this column existed.
      const memberNames = new Map<string, string | null>();
      {
        const { data: memberRows, error: memberErr } = await client
          .from("members")
          .select("user_id, display_name")
          .eq("room_id", room_id);
        if (memberErr) {
          console.warn(
            "compute-verdict fetchVotes members join failed:",
            memberErr.message,
          );
        } else {
          for (
            const m of (memberRows ?? []) as Array<
              { user_id: string; display_name: string | null }
            >
          ) {
            memberNames.set(m.user_id, m.display_name);
          }
        }
      }
      // The receipts surface wants a lowercase first name per
      // verdict-screen-spec Â§"Copy register". `resolveMemberDisplayName`
      // returns the joined `members.display_name` when set, and falls
      // back to the legacy `"m" + userId.slice(0, 4)` placeholder when
      // it is NULL (iOS members, which have no name-entry surface).
      return (data ?? []).map((row) => {
        const userId = row.user_id as string;
        const votesRow: VotesRow = {
          user_id: userId,
          display_name: resolveMemberDisplayName(
            userId,
            memberNames.get(userId),
          ),
          q1: (row.q1 ?? null) as QuestionSlot | null,
          q2: (row.q2 ?? null) as QuestionSlot | null,
          q3: (row.q3 ?? null) as QuestionSlot | null,
          q4: (row.q4 ?? null) as QuestionSlot | null,
          q5: (row.q5 ?? null) as QuestionSlot | null,
        };
        // The mapping layer already unions a diet-reason reroll's
        // `vetoes_extra` into `q1_vetoes`, so the handler's
        // `q1_vetoes_extra` merge is a harmless no-op here.
        const vote = mapVotesRowToMemberVote(votesRow);
        // TB-23 â€” the preference inputs (stated Q1/Q3/Q4 profile + the
        // three Q5 factorial ratings). The handler builds the member's
        // `prefFn` from these and scores the full candidate pool with
        // it. The same schema-driven mapper dispatches on
        // `meta.question_kind`, so quiz content can still change without
        // a migration.
        const preferenceInputs = mapVotesRowToPreferenceInputs(votesRow);
        return {
          user_id: vote.user_id,
          display_name: vote.display_name,
          q1_vetoes: vote.q1_vetoes,
          q2_budget: vote.q2_budget,
          hard_vetoes: vote.hard_vetoes,
          scores: vote.scores ?? {},
          preference_inputs: preferenceInputs,
        } satisfies MemberVoteRow;
      });
    },
    async fetchRoomRerollState(room_id) {
      const { data, error } = await client
        .from("rooms")
        .select("excluded_option_ids, budget_tier_override, walk_minutes_override, last_reroll_reason")
        .eq("id", room_id)
        .maybeSingle();
      if (error || !data) {
        console.warn("compute-verdict fetchRoomRerollState failed:", error?.message ?? "no row");
        return {
          excluded_option_ids: [],
          budget_tier_override: null,
          walk_minutes_override: null,
          last_reroll_reason: null,
        };
      }
      const row = data as {
        excluded_option_ids: string[] | null;
        budget_tier_override: number | null;
        walk_minutes_override: number | null;
        last_reroll_reason: string | null;
      };
      const reason = row.last_reroll_reason;
      const allowed: ReadonlySet<string> = new Set(["cost", "dist", "mood", "diet", "avail"]);
      return {
        excluded_option_ids: row.excluded_option_ids ?? [],
        budget_tier_override: row.budget_tier_override,
        walk_minutes_override: row.walk_minutes_override,
        last_reroll_reason: reason && allowed.has(reason)
          ? (reason as "cost" | "dist" | "mood" | "diet" | "avail")
          : null,
      };
    },
    async fetchProfileVetoes(user_ids) {
      // TB-12 â€” read each voting member's sticky per-account profile
      // vetoes from `user_preferences.profile_vetoes` (a jsonb array of
      // `{ kind, token }` HardVeto entries). The service-role key
      // bypasses RLS so the verdict can read every member's profile,
      // not just the caller's. A user with no `user_preferences` row,
      // or a NULL `profile_vetoes`, is simply absent from the result.
      const out: Record<string, HardVeto[]> = {};
      if (user_ids.length === 0) return out;
      const { data, error } = await client
        .from("user_preferences")
        .select("user_id, profile_vetoes")
        .in("user_id", user_ids);
      if (error) {
        // Best-effort: a failed profile read must not block the
        // verdict. Logged + treated as "no profile vetoes" â€” the only
        // risk is surfacing a venue a member would have vetoed, which
        // the no-profile path already accepts pre-TB-12.
        console.warn("compute-verdict fetchProfileVetoes failed:", error.message);
        return out;
      }
      for (const row of (data ?? []) as Array<
        { user_id: string; profile_vetoes: unknown }
      >) {
        const raw = row.profile_vetoes;
        if (!Array.isArray(raw)) continue;
        const vetoes: HardVeto[] = [];
        for (const entry of raw) {
          if (entry && typeof entry === "object") {
            const kind = (entry as Record<string, unknown>).kind;
            const token = (entry as Record<string, unknown>).token;
            if (
              (kind === "dietary" || kind === "cuisine_never" || kind === "tag") &&
              typeof token === "string"
            ) {
              vetoes.push({ kind, token });
            }
          }
        }
        if (vetoes.length > 0) out[row.user_id] = vetoes;
      }
      return out;
    },
    async fetchPreviousWinnerName(room_id) {
      // Race-tolerant: the prior verdict may have been deleted by
      // apply_reroll already. We surface null in that case so the
      // engine's reroll prefix falls back to "the prior pick" copy.
      // The verdict has option_id null only for `no_survivor` â€” we
      // skip those too.
      const { data: verdictRow } = await client
        .from("verdicts")
        .select("option_id")
        .eq("room_id", room_id)
        .maybeSingle();
      const optionId = (verdictRow as { option_id?: string | null } | null)?.option_id;
      if (!optionId) return null;
      const { data: optionRow } = await client
        .from("options")
        .select("payload")
        .eq("id", optionId)
        .maybeSingle();
      const payload = (optionRow as { payload?: { name?: string } } | null)?.payload;
      return payload?.name ?? null;
    },
    async fetchRoomRadius(room_id): Promise<number | null> {
      const { data, error } = await client
        .from("rooms")
        .select("radius_meters")
        .eq("id", room_id)
        .maybeSingle();
      if (error || !data) {
        console.warn("compute-verdict fetchRoomRadius failed:", error?.message ?? "no row");
        return null;
      }
      return (data as { radius_meters: number | null }).radius_meters ?? null;
    },
    async deleteVerdictForRoom(room_id): Promise<void> {
      // FK cascade on `option_cuts.verdict_id` drops the cuts too.
      const { error } = await client
        .from("verdicts")
        .delete()
        .eq("room_id", room_id);
      if (error) {
        console.error("compute-verdict deleteVerdictForRoom failed:", error.message);
        throw error;
      }
    },
    async insertVerdict(row: VerdictInsert): Promise<VerdictRow> {
      const { data, error } = await client
        .from("verdicts")
        .insert(row)
        .select("id, room_id, option_id, method, rule_text, computed_at")
        .single();
      if (error || !data) {
        console.error("compute-verdict insertVerdict failed:", error?.message);
        throw error ?? new Error("insertVerdict returned no row");
      }
      return data as VerdictRow;
    },
    async insertVerdictSlateEntries(rows: VerdictSlateEntryInsert[]): Promise<void> {
      if (rows.length === 0) return;
      const { error } = await client.from("verdict_slate_entries").insert(rows);
      if (error) {
        console.error("compute-verdict insertVerdictSlateEntries failed:", error.message);
        throw error;
      }
    },
    async insertOptionCuts(rows: OptionCutInsert[]): Promise<void> {
      if (rows.length === 0) return;
      const { error } = await client.from("option_cuts").insert(rows);
      if (error) {
        console.error("compute-verdict insertOptionCuts failed:", error.message);
        throw error;
      }
    },
    async existingVerdict(room_id): Promise<VerdictRow | null> {
      const { data, error } = await client
        .from("verdicts")
        .select("id, room_id, option_id, method, rule_text, computed_at")
        .eq("room_id", room_id)
        .maybeSingle();
      if (error) {
        console.warn("compute-verdict existingVerdict failed:", error.message);
        return null;
      }
      return (data ?? null) as VerdictRow | null;
    },
    async markRoomVerdictReady(room_id): Promise<void> {
      // Flip rooms.status from firing â†’ verdict_ready. The migration
      // schema admits the transition from `open` directly too (the
      // single-tap manual fire can land while the dispatcher is in
      // flight and the trigger may have not yet seen `firing`).
      const { error } = await client
        .from("rooms")
        .update({ status: "verdict_ready" })
        .eq("id", room_id)
        // Only flip from these two states â€” never overwrite `locked`
        // or `expired`.
        .in("status", ["open", "firing"]);
      if (error) {
        console.warn("compute-verdict markRoomVerdictReady failed:", error.message);
        throw error;
      }
    },
    async setPlanDecidedActive(plan_id: string): Promise<void> {
      // tb-WF-1 â€” invoke the `set_plan_decided_active(p_plan_id uuid)`
      // SECURITY DEFINER function. The function flips the Plan's
      // status to `decided-active` and stamps `reroll_window_closes_at`.
      // Idempotent: a non-pending Plan is a no-op inside the function
      // body, so a duplicate dispatch (broadcast retry, late firing
      // trigger re-fire) does not double-write.
      const { error } = await client.rpc(
        "set_plan_decided_active",
        { p_plan_id: plan_id },
      );
      if (error) {
        console.warn(
          "compute-verdict setPlanDecidedActive failed:",
          error.message,
        );
        throw error;
      }
    },
    async emitVerdictReadyBroadcast(room_id, verdict_id): Promise<void> {
      // Realtime Broadcast â€” `room:{roomId}` channel, `verdict_ready`
      // event. iOS subscribers receive in ~50â€“200ms per
      // stack-patterns.md Â§Realtime.
      //
      // We use the HTTP-based Realtime API rather than the WS channel
      // because the Edge Function lives in a short-lived Deno worker;
      // setting up a websocket per invocation is more brittle than
      // a single POST. The endpoint accepts the same broadcast shape
      // as `channel.send` and authenticates with the service-role key.
      const endpoint = `${supabaseUrl}/realtime/v1/api/broadcast`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
        body: JSON.stringify({
          messages: [
            {
              topic: `room:${room_id}`,
              event: "verdict_ready",
              payload: { verdict_id, room_id },
              private: false,
            },
          ],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`broadcast failed: ${res.status} ${text}`);
      }
    },
  };
}

function isVibeFitEnabled(env: ComputeVerdictEnv): boolean {
  const raw = env.VIBE_FIT_ENABLED;
  return raw === "1" || raw?.toLowerCase() === "true";
}

function googleVerdictFieldMask(env: ComputeVerdictEnv): string {
  return isVibeFitEnabled(env)
    ? GOOGLE_VERDICT_SCORING_FIELD_MASK
    : GOOGLE_VERDICT_FETCH_FIELD_MASK;
}

function shapeGoogleVerdictCandidates(
  body: unknown,
  options: { includeVibeFit: boolean } = { includeVibeFit: false },
): GoogleVerdictCandidateRow[] {
  const places = (body && typeof body === "object" &&
      Array.isArray((body as { places?: unknown }).places))
    ? (body as { places: unknown[] }).places
    : [];
  const out: GoogleVerdictCandidateRow[] = [];
  for (const raw of places) {
    if (!raw || typeof raw !== "object") continue;
    const place = raw as Record<string, unknown>;
    if (typeof place.id !== "string" || place.id.trim().length === 0) continue;
    const displayName = place.displayName &&
        typeof place.displayName === "object" &&
        typeof (place.displayName as { text?: unknown }).text === "string"
      ? (place.displayName as { text: string }).text
      : "Unnamed";
    const googlePlaceId = place.id.trim();
    out.push({
      google_place_id: googlePlaceId,
      payload: {
        name: displayName,
        price_tier: googlePriceTier(place.priceLevel),
        rating: typeof place.rating === "number" ? place.rating : null,
        total_ratings: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
        user_rating_count: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
        categories: googleCategories(place),
        dietary_tags: [],
        current_open_now: googleOpenNow(place),
        regular_opening_periods: googleOpeningPeriods(place),
        dine_in: typeof place.dineIn === "boolean" ? place.dineIn : null,
        takeout: typeof place.takeout === "boolean" ? place.takeout : null,
      },
      ...(options.includeVibeFit
        ? {
          vibe_fit_candidate: buildVibeFitCandidate({
            candidateId: googlePlaceId,
            googlePlaceId,
            reviewSummary: googleReviewSummary(place),
            generativeSummary: googleGenerativeSummary(place),
            weakStructuredHints: {
              liveMusic: googleBooleanHint(place.liveMusic),
              goodForGroups: googleBooleanHint(place.goodForGroups),
              goodForWatchingSports: googleBooleanHint(
                place.goodForWatchingSports,
              ),
              outdoorSeating: googleBooleanHint(place.outdoorSeating),
            },
            embeddingMode: "fake",
          }),
        }
        : {}),
    });
  }
  return out;
}

function googleReviewSummary(place: Record<string, unknown>): string | null {
  const summary = place.reviewSummary;
  if (!summary || typeof summary !== "object") return null;
  const text = (summary as { text?: unknown }).text;
  return typeof text === "string" ? text : null;
}

function googleGenerativeSummary(place: Record<string, unknown>): string | null {
  const summary = place.generativeSummary;
  if (!summary || typeof summary !== "object") return null;
  const overview = (summary as { overview?: unknown }).overview;
  if (!overview || typeof overview !== "object") return null;
  const text = (overview as { text?: unknown }).text;
  return typeof text === "string" ? text : null;
}

function googleBooleanHint(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function googlePriceTier(value: unknown): number | null {
  switch (value) {
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return null;
  }
}

function googleCategories(place: Record<string, unknown>): string[] {
  const categories: string[] = [];
  if (typeof place.primaryType === "string") categories.push(place.primaryType);
  if (Array.isArray(place.types)) {
    for (const type of place.types) {
      if (typeof type === "string" && !categories.includes(type)) {
        categories.push(type);
      }
    }
  }
  return categories;
}

function googleOpenNow(place: Record<string, unknown>): boolean | null {
  const hours = place.currentOpeningHours;
  if (!hours || typeof hours !== "object") return null;
  const openNow = (hours as { openNow?: unknown }).openNow;
  return typeof openNow === "boolean" ? openNow : null;
}

function googleOpeningPeriods(place: Record<string, unknown>): GoogleVerdictCandidateRow["payload"]["regular_opening_periods"] {
  const hours = place.regularOpeningHours;
  if (!hours || typeof hours !== "object") return undefined;
  const periods = (hours as { periods?: unknown }).periods;
  return Array.isArray(periods)
    ? periods as GoogleVerdictCandidateRow["payload"]["regular_opening_periods"]
    : undefined;
}

Deno.serve((req) =>
  handleRequest(req, {
    env: {
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      GOOGLE_PLACES_API_KEY: Deno.env.get("GOOGLE_PLACES_API_KEY"),
      VIBE_FIT_ENABLED: Deno.env.get("VIBE_FIT_ENABLED"),
    },
    buildDataAdapter: buildSupabaseAdapter,
  })
);
