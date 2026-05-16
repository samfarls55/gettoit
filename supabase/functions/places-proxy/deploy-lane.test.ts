// tb-14 — regression guard for the Edge Function deploy gap.
//
// Root cause of tb-14: the `places-proxy` Edge Function was written,
// unit-tested, and merged, but nothing ever deployed it. CI had an
// `edge` lane (deno test) and a `supabase-db` lane (db push) — but no
// lane that runs `supabase functions deploy`. The function therefore
// stayed dark on the live project and every quiz session fell through
// to the on-device MapKit fallback.
//
// These tests assert the structural fix lives in version control: the
// CI workflow must carry an `edge-deploy` lane that (a) deploys the
// Edge Functions and (b) pushes the `FOURSQUARE_API_KEY` secret to the
// function runtime, gated to skip when credentials are absent (the
// same gate shape the `supabase-db` and `testflight` lanes use).
//
// A deno test is the right home: the `edge` CI lane already runs
// `deno test` over `supabase/functions/`, so this guard runs on every
// PR with no new tooling. We parse the workflow YAML rather than
// grepping so the assertions survive cosmetic reformatting.

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parse } from "https://deno.land/std@0.224.0/yaml/mod.ts";

const CI_PATH = new URL(
  "../../../.github/workflows/ci.yml",
  import.meta.url,
);

// deno-lint-ignore no-explicit-any
function loadWorkflow(): any {
  const text = Deno.readTextFileSync(CI_PATH);
  return parse(text);
}

// deno-lint-ignore no-explicit-any
function jobStepsText(job: any): string {
  // Flatten every `run:` block in a job into one searchable string.
  const steps = (job?.steps ?? []) as Array<Record<string, unknown>>;
  return steps
    .map((s) => (typeof s.run === "string" ? s.run : ""))
    .join("\n");
}

Deno.test("ci.yml — an edge-deploy job exists", () => {
  const wf = loadWorkflow();
  const job = wf?.jobs?.["edge-deploy"];
  assert(
    job !== undefined,
    "ci.yml must define an `edge-deploy` job — without it the " +
      "places-proxy Edge Function is never deployed (tb-14 root cause).",
  );
});

Deno.test("ci.yml — edge-deploy runs `supabase functions deploy`", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "supabase functions deploy",
    "edge-deploy must run `supabase functions deploy` to bring the " +
      "Edge Functions live.",
  );
});

Deno.test("ci.yml — edge-deploy deploys the places-proxy function", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "places-proxy",
    "edge-deploy must deploy the `places-proxy` function specifically " +
      "(tb-14 acceptance criterion #1).",
  );
});

Deno.test("ci.yml — edge-deploy sets the FOURSQUARE_API_KEY secret", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "supabase secrets set",
    "edge-deploy must run `supabase secrets set` so the deployed " +
      "function can reach Foursquare.",
  );
  assertStringIncludes(
    text,
    "FOURSQUARE_API_KEY",
    "edge-deploy must push the FOURSQUARE_API_KEY secret — a missing " +
      "key makes the handler return `places_proxy_misconfigured`.",
  );
});

Deno.test("ci.yml — edge-deploy is gated on credentials being present", () => {
  // The supabase-db and testflight lanes both skip themselves when
  // their secrets are absent so PRs from forks / unconfigured clones
  // don't go red. edge-deploy must follow the same pattern.
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "skip=true",
    "edge-deploy must carry a credential gate (skip=true output) so " +
      "it no-ops gracefully when Supabase secrets are unset.",
  );
});

Deno.test("ci.yml — edge-deploy only deploys on push to main", () => {
  // Deploying on every PR would race the supabase-db push and could
  // ship an Edge Function ahead of the migration it depends on.
  // Restrict the deploy to push events on main, like the testflight
  // lane restricts its upload.
  const wf = loadWorkflow();
  const job = wf?.jobs?.["edge-deploy"];
  const ifExpr = String(job?.if ?? "");
  assert(
    ifExpr.includes("refs/heads/main"),
    "edge-deploy must be gated to `refs/heads/main` so a function is " +
      "never deployed ahead of its migration on a feature branch.",
  );
});

Deno.test("ci.yml — edge-deploy runs after supabase-db", () => {
  // The places-proxy handler upserts into the `places` cache table.
  // The function must not deploy before the migration that creates
  // that table has been pushed — otherwise the first live call
  // surfaces as an empty 200 (tb-14 acceptance criterion #3).
  const wf = loadWorkflow();
  const job = wf?.jobs?.["edge-deploy"];
  const needs = job?.needs;
  const needsList = Array.isArray(needs) ? needs : [needs];
  assert(
    needsList.includes("supabase-db"),
    "edge-deploy must `needs: supabase-db` so the `places` cache " +
      "table exists before the function goes live.",
  );
});

Deno.test("ci.yml — edge-deploy runs the live integration smoke test", () => {
  // tb-14 acceptance criterion #4: after deploy, the lane must invoke
  // the deployed function and assert a Foursquare-sourced response so
  // a dark deployment fails CI loudly instead of silently.
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "live-integration.test.ts",
    "edge-deploy must run `places-proxy/live-integration.test.ts` " +
      "after the deploy to verify Foursquare is reached.",
  );
});

Deno.test("ci.yml — places migration is still in the tree", () => {
  // tb-14 acceptance criterion #3: the `places` cache table exists.
  // The table is created by an idempotent migration; the supabase-db
  // lane applies it. Guard that the migration file has not been
  // deleted out from under the Edge Function.
  const migrationsDir = new URL(
    "../../migrations/",
    import.meta.url,
  );
  let found = false;
  for (const entry of Deno.readDirSync(migrationsDir)) {
    if (entry.isFile && entry.name.endsWith("_places_and_options.sql")) {
      const sql = Deno.readTextFileSync(
        new URL(entry.name, migrationsDir),
      );
      assertStringIncludes(
        sql,
        "create table if not exists public.places",
        "the places-and-options migration must still create the " +
          "`places` cache table.",
      );
      found = true;
    }
  }
  assertEquals(
    found,
    true,
    "a `*_places_and_options.sql` migration must exist — it creates " +
      "the `places` cache table the proxy upserts into.",
  );
});
