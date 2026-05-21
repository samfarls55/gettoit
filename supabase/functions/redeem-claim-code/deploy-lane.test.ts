// tb-WF-14 — regression guard for the redeem-claim-code deploy wiring.
//
// The mint side (tb-WF-13) added `mint-claim-code` to the CI
// edge-deploy lane's deploy loop; the redeem side must be wired the
// same way or the function ships dark — a Web invitee on S00a types a
// valid claim code and the redeem call 404s against a function that
// was never deployed.
//
// Same shape as `places-proxy/deploy-lane.test.ts`: parse the workflow
// YAML so the assertion survives cosmetic reformatting, and run inside
// the existing `edge` deno-test lane with no new tooling.

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

Deno.test("ci.yml — edge-deploy deploys the redeem-claim-code function", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "redeem-claim-code",
    "edge-deploy must deploy the `redeem-claim-code` function — without " +
      "it the S00a 'Voted on the web?' claim flow has no live endpoint.",
  );
});

Deno.test("ci.yml — redeem-claim-code shares the CLAIM_CODE_ENC_KEY secret push", () => {
  // redeem-claim-code DECRYPTS what mint-claim-code encrypted, so it
  // needs the same CLAIM_CODE_ENC_KEY. The secrets-set step pushes one
  // key for both functions; assert the key is still wired.
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["edge-deploy"]);
  assertStringIncludes(
    text,
    "CLAIM_CODE_ENC_KEY",
    "edge-deploy must push CLAIM_CODE_ENC_KEY — redeem-claim-code " +
      "decrypts the stored refresh token with it.",
  );
});

Deno.test("redeem-claim-code source is present and imports the shared helper", () => {
  // The redeem function must reuse the shared crypto + alphabet helper
  // (`_shared/claim-code.ts`) rather than re-implementing decryption —
  // the mint and redeem sides must agree on the wire format byte-for-byte.
  const handler = Deno.readTextFileSync(
    new URL("./handler.ts", import.meta.url),
  );
  assertStringIncludes(
    handler,
    'from "../_shared/claim-code.ts"',
    "redeem-claim-code/handler.ts must import the shared claim-code " +
      "helper, not re-implement crypto.",
  );
  assert(
    handler.includes("decryptToken"),
    "the redeem handler must use the shared decryptToken.",
  );
});
