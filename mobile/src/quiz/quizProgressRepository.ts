export type QuizQuestionId = "q1" | "q2" | "q3" | "q4";

export type QuizAnswers = {
  q1CuisineCravings?: string[];
  q2SpendCap?: string;
  q3Reputation?: string;
  q4VibeEnergy?: string;
};

export type QuizProgress = {
  roomId: string;
  currentQuestion: QuizQuestionId;
  answers: QuizAnswers;
};

export type QuizProgressRepository = {
  loadProgress: (roomId: string) => Promise<QuizProgress | null>;
  saveProgress: (progress: QuizProgress) => Promise<void>;
  exitPlan: (input: { roomId: string }) => Promise<void>;
};

export const fakeQuizProgressRepository: QuizProgressRepository = {
  loadProgress: async (roomId) => ({
    roomId,
    currentQuestion: "q1",
    answers: {},
  }),
  saveProgress: async () => undefined,
  exitPlan: async () => undefined,
};
