import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { GOOGLE_SCORING_SEAMS } from "./google-scoring-seams.ts";

Deno.test("TB-02: active Google Q5 seam uses the crowd approval axis contract", () => {
  assertEquals(GOOGLE_SCORING_SEAMS.q5CandidateGeneration.axisContract, [
    "cuisine",
    "crowd_approval",
    "vibe",
  ]);
  assert(
    GOOGLE_SCORING_SEAMS.q5CandidateGeneration.activeModules.includes(
      "_shared/votes-schema.ts",
    ),
  );
});

Deno.test("TB-02: final verdict scoring seam is the Google compute-verdict path", () => {
  assert(
    GOOGLE_SCORING_SEAMS.finalVerdictScoring.activeModules.includes(
      "compute-verdict/handler.ts",
    ),
  );
  assertEquals(
    GOOGLE_SCORING_SEAMS.finalVerdictScoring.durableStorage,
    [
      "verdicts.final_fit_score",
      "verdicts.scoring_version",
      "verdict_slate_entries.final_fit_score",
      "verdict_slate_entries.scoring_version",
    ],
  );
});
