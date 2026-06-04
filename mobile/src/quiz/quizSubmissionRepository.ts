import type { QuizAnswers } from "./quizProgressRepository";

export type QuizSubmissionPayload = {
  roomId: string;
  answers: QuizAnswers;
};

export type QuizSubmissionRepository = {
  submitQuiz: (payload: QuizSubmissionPayload) => Promise<void>;
};

export const fakeQuizSubmissionRepository: QuizSubmissionRepository = {
  submitQuiz: async () => undefined,
};
