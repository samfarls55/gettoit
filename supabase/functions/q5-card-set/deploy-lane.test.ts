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

function loadWorkflow(): unknown {
  return parse(Deno.readTextFileSync(CI_PATH));
}

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function jobStepsText(job: unknown): string {
  const jobRecord = recordFromUnknown(job);
  const steps = Array.isArray(jobRecord?.steps) ? jobRecord.steps : [];
  return steps
    .map((step) => {
      const stepRecord = recordFromUnknown(step);
      return typeof stepRecord?.run === "string" ? stepRecord.run : "";
    })
    .join("\n");
}

Deno.test("ci.yml — edge-deploy deploys the q5-card-set function", () => {
  const workflow = recordFromUnknown(loadWorkflow());
  const jobs = recordFromUnknown(workflow?.jobs);
  const text = jobStepsText(jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "q5-card-set",
    "edge-deploy must deploy q5-card-set so locked Room members can " +
      "request server-assigned Q5 card sets.",
  );
});
