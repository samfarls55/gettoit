// apns-sender Edge Function — runtime entry point.
//
// Composes the pure HTTP handler from `./handler.ts` with the
// supabase-js data adapter, the real fetch-based APNs delivery
// adapter, and the Deno.serve listener.
//
// References:
//   * v1 PRD §"APNsSender" (gti-vault/10_prds/v1-prd.md)
//   * TB-08 ticket (gti-vault/15_issues/v1/issues/tb-08-ratification-push-hard-close.md)
//   * Apple, "Sending Notification Requests to APNs"

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.43.4";
import {
  APNS_HOST,
  type ApnsDeliveryAdapter,
  type ApnsDeliveryRequest,
  type ApnsDeliveryResult,
  type ApnsSenderDataAdapter,
  type ApnsSenderEnv,
  handleRequest,
  type PushTokenRow,
} from "./handler.ts";

function buildSupabaseDataAdapter(env: ApnsSenderEnv): ApnsSenderDataAdapter {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const client: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async fetchPushTokens(user_ids): Promise<PushTokenRow[]> {
      if (user_ids.length === 0) return [];
      const { data, error } = await client
        .from("push_tokens")
        .select("user_id, device_token, platform")
        .in("user_id", user_ids);
      if (error) {
        console.warn("apns-sender fetchPushTokens failed:", error.message);
        return [];
      }
      return (data ?? []) as PushTokenRow[];
    },
  };
}

function buildHttp2DeliveryAdapter(_env: ApnsSenderEnv): ApnsDeliveryAdapter {
  return {
    async send(req: ApnsDeliveryRequest): Promise<ApnsDeliveryResult> {
      const url = `${APNS_HOST}/3/device/${req.deviceToken}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "authorization": `bearer ${req.jwt}`,
          "apns-topic": req.topic,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        },
        body: JSON.stringify(req.payload),
      });
      const apnsId = res.headers.get("apns-id");
      if (res.ok) {
        // APNs returns an empty body on 200; drain so we don't leak
        // the response stream in the Deno runtime.
        await res.body?.cancel();
        return { status: res.status, apnsId };
      }
      // APNs returns JSON error bodies of shape `{"reason": "BadDeviceToken"}`.
      let reason = "";
      try {
        const body = await res.json() as { reason?: string };
        reason = body.reason ?? "";
      } catch (_e) {
        reason = res.statusText;
      }
      return { status: res.status, apnsId, error: reason };
    },
  };
}

Deno.serve((req) =>
  handleRequest(req, {
    env: {
      APNS_AUTH_KEY: Deno.env.get("APNS_AUTH_KEY"),
      APNS_AUTH_KEY_ID: Deno.env.get("APNS_AUTH_KEY_ID"),
      APNS_TEAM_ID: Deno.env.get("APNS_TEAM_ID"),
      APNS_TOPIC: Deno.env.get("APNS_TOPIC"),
    },
    buildDataAdapter: buildSupabaseDataAdapter,
    buildDeliveryAdapter: buildHttp2DeliveryAdapter,
  })
);
