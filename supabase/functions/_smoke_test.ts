// Walking-skeleton placeholder so the `deno test` CI lane has a
// runnable target before any real Edge Function lands. Replaced /
// extended in TB-05 (PlacesProxy) and onward.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("supabase/functions skeleton — runtime is reachable", () => {
  assertEquals(1 + 1, 2);
});
