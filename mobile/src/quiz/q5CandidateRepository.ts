import type { QuizAnswers } from "./quizProgressRepository";
import type { Q5PoolVenue } from "./q5Factorial";

export type LoadQ5CandidatesInput = {
  roomId: string;
  answers: QuizAnswers;
};

export type Q5CandidateRepository = {
  loadCandidates: (input: LoadQ5CandidatesInput) => Promise<Q5PoolVenue[]>;
};

export const fakeQ5CandidateRepository: Q5CandidateRepository = {
  loadCandidates: async () => [
    {
      id: "fsq-demo-thai",
      name: "Thai Orchid",
      categories: ["Thai"],
      priceTier: 2,
      walkMinutesEstimate: 6,
      profile: { cuisine: "thai", reputation: "popular", vibe: 2 },
    },
    {
      id: "fsq-demo-casa",
      name: "Casa Lupita",
      categories: ["Mexican"],
      priceTier: 1,
      walkMinutesEstimate: 9,
      profile: { cuisine: "mexican", reputation: "hiddenGem", vibe: 2 },
    },
    {
      id: "fsq-demo-farol",
      name: "El Farol",
      categories: ["Mexican"],
      priceTier: 3,
      walkMinutesEstimate: 4,
      profile: { cuisine: "mexican", reputation: "popular", vibe: 4 },
    },
  ],
};
