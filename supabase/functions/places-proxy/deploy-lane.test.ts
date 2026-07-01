// Regression guard for the PlacesProxy Edge Function deploy lane.

import {
  assert,
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
  const steps = (job?.steps ?? []) as Array<Record<string, unknown>>;
  return steps
    .map((s) => (typeof s.run === "string" ? s.run : ""))
    .join("\n");
}

Deno.test("ci.yml - an edge-deploy job exists", () => {
  const wf = loadWorkflow();
  const job = wf?.jobs?.["edge-deploy"];
  assert(
    job !== undefined,
    "ci.yml must define an `edge-deploy` job so places-proxy is deployed.",
  );
});

Deno.test("ci.yml - edge-deploy runs `supabase functions deploy`", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "supabase functions deploy",
    "edge-deploy must run `supabase functions deploy`.",
  );
});

Deno.test("ci.yml - edge-deploy deploys the places-proxy function", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "places-proxy",
    "edge-deploy must deploy the `places-proxy` function specifically.",
  );
});

Deno.test("ci.yml - edge-deploy sets the GOOGLE_PLACES_API_KEY secret", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "supabase secrets set",
    "edge-deploy must run `supabase secrets set` so the deployed function can reach Google Places.",
  );
  assertStringIncludes(
    text,
    "GOOGLE_PLACES_API_KEY",
    "edge-deploy must push the GOOGLE_PLACES_API_KEY secret.",
  );
});

Deno.test("ci.yml - edge-deploy tolerates a missing GitHub Google mirror", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "leaving existing Supabase runtime secret unchanged",
    "edge-deploy should not fail solely because the write-only GitHub mirror is absent.",
  );
  assertStringIncludes(
    text,
    "Live integration checks below will fail if it is missing",
    "edge-deploy must still prove the Supabase runtime secret is configured.",
  );
});

Deno.test("ci.yml - edge-deploy is gated on credentials being present", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "skip=true",
    "edge-deploy must no-op gracefully when Supabase credentials are unset.",
  );
});

Deno.test("ci.yml - edge-deploy only deploys on push to main", () => {
  const wf = loadWorkflow();
  const job = wf?.jobs?.["edge-deploy"];
  const ifExpr = String(job?.if ?? "");
  assert(
    ifExpr.includes("refs/heads/main"),
    "edge-deploy must be gated to `refs/heads/main`.",
  );
});

Deno.test("ci.yml - edge-deploy runs after supabase-db", () => {
  const wf = loadWorkflow();
  const job = wf?.jobs?.["edge-deploy"];
  const needs = job?.needs;
  const needsList = Array.isArray(needs) ? needs : [needs];
  assert(
    needsList.includes("supabase-db"),
    "edge-deploy must `needs: supabase-db` so functions deploy after migrations.",
  );
});

Deno.test("ci.yml - edge-deploy runs the live integration smoke test", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "live-integration.test.ts",
    "edge-deploy must run `places-proxy/live-integration.test.ts` after deploy.",
  );
});
