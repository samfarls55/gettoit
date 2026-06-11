import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { QuizScreen } from "../src/quiz/QuizScreen";
import type { Q5CandidateRepository } from "../src/quiz/q5CandidateRepository";
import type { QuizProgressRepository } from "../src/quiz/quizProgressRepository";
import type { QuizSubmissionRepository } from "../src/quiz/quizSubmissionRepository";

function makeProgressRepository(): QuizProgressRepository {
  return {
    loadProgress: jest.fn(async () => ({
      roomId: "room-q5",
      currentQuestion: "q4" as const,
      answers: {
        q1CuisineCravings: ["mexican"],
        q2SpendCap: "$$",
        q3Reputation: "popular",
      },
    })),
    saveProgress: jest.fn(async () => undefined),
    exitPlan: jest.fn(async () => undefined),
  };
}

function makeCandidateRepository(
  pool: Awaited<ReturnType<Q5CandidateRepository["loadCandidates"]>>,
): Q5CandidateRepository {
  return {
    loadCandidates: jest.fn(async () => pool),
  };
}

const candidatePool = [
  {
    id: "fsq-thai",
    name: "Thai Orchid",
    categories: ["Thai"],
    priceTier: 2,
    walkMinutesEstimate: 6,
    profile: { cuisine: "thai", reputation: "popular", vibe: 2 },
  },
  {
    id: "fsq-casa",
    name: "Casa Lupita",
    categories: ["Mexican"],
    priceTier: 1,
    walkMinutesEstimate: 9,
    profile: { cuisine: "mexican", reputation: "hiddenGem", vibe: 2 },
  },
  {
    id: "fsq-farol",
    name: "El Farol",
    categories: ["Mexican"],
    priceTier: 3,
    walkMinutesEstimate: 4,
    profile: { cuisine: "mexican", reputation: "popular", vibe: 4 },
  },
];

describe("QuizScreen Q1", () => {
  it("renders the approved cuisine chips and excludes dietary or meal-time chips", async () => {
    render(
      <QuizScreen
        onExited={jest.fn()}
        progressRepository={{
          loadProgress: jest.fn(async () => null),
          saveProgress: jest.fn(async () => undefined),
          exitPlan: jest.fn(async () => undefined),
        }}
        role="initiator"
        roomId="room-q1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Q1")).toBeOnTheScreen();
    });

    for (const label of [
      "American",
      "Mexican",
      "Italian",
      "Japanese",
      "Chinese",
      "Thai",
      "Indian",
      "Mediterranean",
      "Middle Eastern",
      "Korean",
      "Vietnamese",
      "Seafood",
      "Comfort Food",
      "No preference",
    ]) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.queryByText("Vegan")).toBeNull();
    expect(screen.queryByText("Breakfast")).toBeNull();
  });
});

describe("QuizScreen Q5", () => {
  it("loads real candidates after Q4 and renders the Q5 preference probe", async () => {
    const progressRepository = makeProgressRepository();
    const q5CandidateRepository = makeCandidateRepository(candidatePool);

    render(
      <QuizScreen
        onExited={jest.fn()}
        progressRepository={progressRepository}
        q5CandidateRepository={q5CandidateRepository}
        role="initiator"
        roomId="room-q5"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Q4")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("SOCIAL"));
    fireEvent.press(screen.getByText("Save vibe"));

    await waitFor(() => {
      expect(q5CandidateRepository.loadCandidates).toHaveBeenCalledWith({
        roomId: "room-q5",
        answers: {
          q1CuisineCravings: ["mexican"],
          q2SpendCap: "$$",
          q3Reputation: "popular",
          q4VibeEnergy: "social",
        },
      });
      expect(screen.getByText("How excited does each of these make you?")).toBeOnTheScreen();
    });

    expect(screen.getByText("Thai Orchid")).toBeOnTheScreen();
    expect(screen.getByText("THAI - $$ - 6 MIN")).toBeOnTheScreen();
    expect(screen.queryByText("dummy-placeholder")).toBeNull();
    expect(screen.getByLabelText("Rate 5 for Thai Orchid")).toBeOnTheScreen();
  });

  it("renders Q5 no-results when candidates cannot produce usable cards", async () => {
    render(
      <QuizScreen
        onExited={jest.fn()}
        progressRepository={makeProgressRepository()}
        q5CandidateRepository={makeCandidateRepository([])}
        role="initiator"
        roomId="room-q5"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Q4")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("SOCIAL"));
    fireEvent.press(screen.getByText("Save vibe"));

    await waitFor(() => {
      expect(screen.getByText("No spots to rate near you.")).toBeOnTheScreen();
    });

    expect(screen.getByText("Head to the verdict")).toBeOnTheScreen();
    expect(screen.queryByText("Drop the verdict")).toBeNull();
  });

  it("submits the Q5 quiz payload through the submission repository", async () => {
    const submissionRepository: QuizSubmissionRepository = {
      submitQuiz: jest.fn(async () => undefined),
    };
    const onSubmitted = jest.fn();

    render(
      <QuizScreen
        onExited={jest.fn()}
        onSubmitted={onSubmitted}
        progressRepository={makeProgressRepository()}
        q5CandidateRepository={makeCandidateRepository(candidatePool)}
        role="initiator"
        roomId="room-q5"
        submissionRepository={submissionRepository}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Q4")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("SOCIAL"));
    fireEvent.press(screen.getByText("Save vibe"));

    await waitFor(() => {
      expect(screen.getByText("Thai Orchid")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("Rate 5 for Thai Orchid"));
    fireEvent.press(screen.getByText("Drop the verdict"));

    await waitFor(() => {
      expect(submissionRepository.submitQuiz).toHaveBeenCalledWith({
        roomId: "room-q5",
        answers: {
          q1CuisineCravings: ["mexican"],
          q2SpendCap: "$$",
          q3Reputation: "popular",
          q4VibeEnergy: "social",
          q5Ratings: {
            "fsq-thai": 5,
            "fsq-casa": 3,
            "fsq-farol": 3,
          },
        },
      });
      expect(onSubmitted).toHaveBeenCalledTimes(1);
    });
  });
});
