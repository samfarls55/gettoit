import { Q5_AXES } from "./votes-wire.ts";

export const GOOGLE_SCORING_SEAMS = Object.freeze({
  q5CandidateGeneration: {
    axisContract: Q5_AXES,
    activeModules: [
      "places-proxy/handler.ts",
      "_shared/places-proxy-core.ts",
      "mobile/src/quiz/q5Factorial.ts",
      "_shared/votes-wire.ts",
      "_shared/votes-schema.ts",
    ],
  },
  finalVerdictScoring: {
    activeModules: [
      "compute-verdict/index.ts",
      "compute-verdict/handler.ts",
      "_shared/venue-classifier.ts",
      "_shared/preference-function.ts",
      "_shared/verdict-engine.ts",
    ],
    durableStorage: [
      "verdicts.final_fit_score",
      "verdicts.scoring_version",
      "verdict_slate_entries.final_fit_score",
      "verdict_slate_entries.scoring_version",
    ],
  },
});
