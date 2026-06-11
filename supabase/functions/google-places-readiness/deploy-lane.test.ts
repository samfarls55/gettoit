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
  return parse(Deno.readTextFileSync(CI_PATH));
}

// deno-lint-ignore no-explicit-any
function jobStepsText(job: any): string {
  const steps = (job?.steps ?? []) as Array<Record<string, unknown>>;
  return steps
    .map((s) => (typeof s.run === "string" ? s.run : ""))
    .join("\n");
}

Deno.test("ci.yml - edge-deploy deploys google-places-readiness", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "google-places-readiness",
    "edge-deploy must deploy the Google Places readiness function.",
  );
});

Deno.test("ci.yml - edge-deploy can push GOOGLE_PLACES_API_KEY when present", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "GOOGLE_PLACES_API_KEY",
    "edge-deploy should know about the server-only Google Places secret.",
  );
});

Deno.test("ci.yml - edge-deploy runs google-places-readiness live check", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "google-places-readiness/live-integration.test.ts",
    "edge-deploy must prove the deployed Google readiness function reports configured.",
  );
});

Deno.test("ci.yml - edge-deploy job still exists", () => {
  const wf = loadWorkflow();
  assert(
    wf?.jobs?.["edge-deploy"] !== undefined,
    "ci.yml must define edge-deploy.",
  );
});
