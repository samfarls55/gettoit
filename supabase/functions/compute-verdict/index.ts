// compute-verdict Edge Function — runtime entry point.
//
// Composes the pure HTTP handler from `./handler.ts` with the
// supabase-js data adapter and the Deno.serve listener.
//
// References:
//   * v1 PRD §"VerdictEngine" (gti-vault/10_prds/v1-prd.md)
//   * TB-06 ticket (gti-vault/15_issues/v1/issues/tb-06-verdict-engine-clean-run.md)
//   * Engine spec: supabase/functions/_shared/verdict-engine.ts

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import {
  type ComputeVerdictDataAdapter,
  type ComputeVerdictEnv,
  handleRequest,
  type MemberVoteRow,
  type OptionCutInsert,
  type RoomOptionRow,
  type VerdictInsert,
  type VerdictRow,
} from "./handler.ts";

function buildSupabaseAdapter(env: ComputeVerdictEnv): ComputeVerdictDataAdapter {
  const supabaseUrl = env.SUPABASE_URL ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const client: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async fetchRoom(room_id) {
      const { data, error } = await client
        .from("rooms")
        .select("id")
        .eq("id", room_id)
        .maybeSingle();
      if (error) {
        console.warn("compute-verdict fetchRoom failed:", error.message);
        return null;
      }
      return (data ?? null) as { id: string } | null;
    },
    async fetchOptions(room_id): Promise<RoomOptionRow[]> {
      const { data, error } = await client
        .from("options")
        .select("id, payload")
        .eq("room_id", room_id);
      if (error) {
        console.warn("compute-verdict fetchOptions failed:", error.message);
        return [];
      }
      return (data ?? []) as RoomOptionRow[];
    },
    async fetchVotes(room_id): Promise<MemberVoteRow[]> {
      const { data, error } = await client
        .from("votes")
        .select("user_id, q1_vetoes, q2_budget, q3_walk_minutes, q4_vibe, q5_regret")
        .eq("room_id", room_id);
      if (error) {
        console.warn("compute-verdict fetchVotes failed:", error.message);
        return [];
      }
      // The receipts surface wants a lowercase first name per
      // verdict-screen-spec §"Copy register". For TB-06 we don't yet
      // have a stable display-name source — anonymous users have no
      // user_metadata. Surface the short uuid prefix as a placeholder;
      // TB-08 (ratification) or TB-12 (Apple upgrade) will introduce
      // a real `display_name`.
      return (data ?? []).map((row) => ({
        user_id: row.user_id,
        display_name: `m${(row.user_id as string).slice(0, 4)}`,
        q1_vetoes: row.q1_vetoes ?? [],
        q2_budget: row.q2_budget,
        q3_walk_minutes: row.q3_walk_minutes,
        q4_vibe: row.q4_vibe,
        q5_regret: row.q5_regret ?? {},
      })) as MemberVoteRow[];
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
      // Flip rooms.status from firing → verdict_ready. The migration
      // schema admits the transition from `open` directly too (the
      // single-tap manual fire can land while the dispatcher is in
      // flight and the trigger may have not yet seen `firing`).
      const { error } = await client
        .from("rooms")
        .update({ status: "verdict_ready" })
        .eq("id", room_id)
        // Only flip from these two states — never overwrite `locked`
        // or `expired`.
        .in("status", ["open", "firing"]);
      if (error) {
        console.warn("compute-verdict markRoomVerdictReady failed:", error.message);
        throw error;
      }
    },
    async emitVerdictReadyBroadcast(room_id, verdict_id): Promise<void> {
      // Realtime Broadcast — `room:{roomId}` channel, `verdict_ready`
      // event. iOS subscribers receive in ~50–200ms per
      // stack-patterns.md §Realtime.
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

Deno.serve((req) =>
  handleRequest(req, {
    env: {
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    },
    buildDataAdapter: buildSupabaseAdapter,
  })
);
