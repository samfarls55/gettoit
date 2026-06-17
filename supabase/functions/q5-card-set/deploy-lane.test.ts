// TB-27 — regression guard for the server-assigned Q5 card-set endpoint.
//
// The function is only useful if CI deploys it with the other Supabase
// Edge Functions; otherwise clients cannot request the server-owned
// Q5 card set in production.

import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parse } from "https://deno.land/std@0.224.0/yaml/mod.ts";

const CI_PATH = new URL(
  "../../../.github/workflows/ci.yml",
  import.meta.url,
);

// deno-lint-ignore no-explicit-any
function loadWorkflow(): any {
  return parse(Deno.readTextFileSync(CI_PATH));
}

// deno-lint-ignore no-explicit-any
function jobStepsText(job: any): string {
  const steps = (job?.steps ?? []) as Array<Record<string, unknown>>;
  return steps
    .map((step) => (typeof step.run === "string" ? step.run : ""))
    .join("\n");
}

Deno.test("ci.yml — edge-deploy deploys the q5-card-set function", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "q5-card-set",
    "edge-deploy must deploy q5-card-set so locked Room members can " +
      "request server-assigned Q5 card sets.",
  );
});
