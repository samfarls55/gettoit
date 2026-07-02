import { useCallback, useEffect, useReducer, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { mobileTokens } from "../design/tokens";
import type { Q5CandidateRepository } from "./q5CandidateRepository";
import {
  type Q5Candidate,
} from "./q5Factorial";
import type {
  QuizAnswers,
  QuizProgressRepository,
  QuizQuestionId,
} from "./quizProgressRepository";
import type { QuizSubmissionRepository } from "./quizSubmissionRepository";

type QuizScreenProps = {
  progressRepository: QuizProgressRepository;
  q5CandidateRepository: Q5CandidateRepository;
  participantRole: "initiator" | "joiner";
  roomId: string;
  onExited: () => void;
  onSubmitted?: () => void;
  submissionRepository: QuizSubmissionRepository;
};

type AnswerKey = keyof QuizAnswers;
type AnswerValue = string | number;

type Option = {
  label: string;
  value: AnswerValue;
};

type QuestionConfig = {
  id: Exclude<QuizQuestionId, "q5">;
  title: string;
  answerKey: AnswerKey;
  cta: string;
  labelPrefix: string;
  options: readonly Option[];
  fallbackValue?: AnswerValue;
  multi?: true;
};

type Q5Status = "idle" | "loading" | "ready" | "noResults";

type Q5State = {
  candidates: Q5Candidate[];
  ratings: Record<string, number>;
  status: Q5Status;
};

type Q5Action =
  | { type: "loading" }
  | { type: "noResults" }
  | { type: "ready"; candidates: Q5Candidate[] }
  | { type: "ratingChanged"; candidateId: string; score: number };

const initialQ5State: Q5State = {
  candidates: [],
  ratings: {},
  status: "idle",
};

function q5Reducer(state: Q5State, action: Q5Action): Q5State {
  switch (action.type) {
    case "loading":
      return { ...state, status: "loading" };
    case "noResults":
      return { candidates: [], ratings: {}, status: "noResults" };
    case "ready":
      return {
        candidates: action.candidates,
        ratings: initialQ5Ratings(action.candidates),
        status: "ready",
      };
    case "ratingChanged":
      return {
        ...state,
        ratings: {
          ...state.ratings,
          [action.candidateId]: action.score,
        },
      };
  }
}

const noPreferenceValue = "noPreference";
const maxMultiSelectValues = 3;
const quizQuestionIds: readonly QuizQuestionId[] = ["q1", "q2", "q3", "q4", "q5"];
const defaultQ5Rating = 3;
const q5RatingScores = [1, 2, 3, 4, 5] as const;

const questionConfigs: readonly QuestionConfig[] = [
  {
    id: "q1",
    title: "What sounds good tonight?",
    answerKey: "q1CuisineCravings",
    cta: "Save cravings",
    labelPrefix: "Cuisine craving",
    multi: true,
    options: [
      { label: "American", value: "american" },
      { label: "Mexican", value: "mexican" },
      { label: "Italian", value: "italian" },
      { label: "Japanese", value: "japanese" },
      { label: "Chinese", value: "chinese" },
      { label: "Thai", value: "thai" },
      { label: "Indian", value: "indian" },
      { label: "Mediterranean", value: "mediterranean" },
      { label: "Middle Eastern", value: "middle_eastern" },
      { label: "Korean", value: "korean" },
      { label: "Vietnamese", value: "vietnamese" },
      { label: "Seafood", value: "seafood" },
      { label: "Comfort Food", value: "comfort_food" },
      { label: "No preference", value: "noPreference" },
    ],
  },
  {
    id: "q2",
    title: "What is the spend cap?",
    answerKey: "q2SpendCap",
    cta: "Save spend",
    labelPrefix: "Spend cap",
    fallbackValue: 2,
    options: [
      { label: "$", value: 1 },
      { label: "$$", value: 2 },
      { label: "$$$", value: 3 },
      { label: "$$$$", value: 4 },
    ],
  },
  {
    id: "q3",
    title: "What kind of reputation fits?",
    answerKey: "q3Reputation",
    cta: "Save reputation",
    labelPrefix: "Reputation",
    fallbackValue: "noPreference",
    options: [
      { label: "Popular", value: "popular" },
      { label: "Hidden gem", value: "hiddenGem" },
      { label: "Classic", value: "classic" },
      { label: "New", value: "new" },
      { label: "No preference", value: "noPreference" },
    ],
  },
  {
    id: "q4",
    title: "Choose the energy.",
    answerKey: "q4VibeEnergy",
    cta: "Save vibe",
    labelPrefix: "Vibe energy",
    fallbackValue: "social",
    options: [
      { label: "QUIET", value: "quiet" },
      { label: "CHILL", value: "chill" },
      { label: "SOCIAL", value: "social" },
      { label: "LIVELY", value: "lively" },
      { label: "ROWDY", value: "rowdy" },
    ],
  },
];

function questionIndex(questionId: QuizQuestionId): number {
  return quizQuestionIds.indexOf(questionId);
}

function questionAfter(questionId: QuizQuestionId): QuizQuestionId {
  return quizQuestionIds[
    Math.min(questionIndex(questionId) + 1, quizQuestionIds.length - 1)
  ];
}

function questionBefore(questionId: QuizQuestionId): QuizQuestionId {
  return quizQuestionIds[
    Math.max(questionIndex(questionId) - 1, 0)
  ];
}

function selectedValues(
  answers: QuizAnswers,
  question: QuestionConfig,
): AnswerValue[] {
  const value = answers[question.answerKey];

  if (Array.isArray(value)) {
    return value;
  }

  return typeof value === "string" || typeof value === "number" ? [value] : [];
}

function nextAnswers(
  answers: QuizAnswers,
  question: QuestionConfig,
): QuizAnswers {
  const currentValues = selectedValues(answers, question);
  const value = question.multi
    ? currentValues.filter((entry): entry is string =>
      typeof entry === "string"
    )
    : currentValues[0] ?? question.fallbackValue;

  return {
    ...answers,
    [question.answerKey]: value,
  };
}

function nextMultiSelectValues(
  currentValues: string[],
  selectedValue: string,
): string[] {
  if (selectedValue === noPreferenceValue) {
    return [noPreferenceValue];
  }

  if (currentValues.includes(selectedValue)) {
    return currentValues.filter((selection) => selection !== selectedValue);
  }

  return [
    ...currentValues.filter((selection) => selection !== noPreferenceValue),
    selectedValue,
  ].slice(0, maxMultiSelectValues);
}

export function QuizScreen({
  progressRepository,
  q5CandidateRepository,
  participantRole,
  roomId,
  onExited,
  onSubmitted,
  submissionRepository,
}: QuizScreenProps) {
  const [currentQuestionId, setCurrentQuestionId] =
    useState<QuizQuestionId>("q1");
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [q5State, dispatchQ5] = useReducer(q5Reducer, initialQ5State);
  const {
    candidates: q5Candidates,
    ratings: q5Ratings,
    status: q5Status,
  } = q5State;
  const currentQuestion =
    questionConfigs[questionIndex(currentQuestionId)] ?? questionConfigs[0];
  const exitLabel = participantRole === "joiner" ? "Leave" : "Exit";
  const currentSelectedValues = selectedValues(answers, currentQuestion);

  const loadQ5Candidates = useCallback(async (nextQuizAnswers: QuizAnswers) => {
    dispatchQ5({ type: "loading" });

    try {
      const candidates = await q5CandidateRepository.loadCandidates({
        roomId,
        answers: nextQuizAnswers,
      });

      if (candidates.length === 0) {
        dispatchQ5({ type: "noResults" });
        return;
      }

      dispatchQ5({ type: "ready", candidates });
    } catch {
      dispatchQ5({ type: "noResults" });
    }
  }, [q5CandidateRepository, roomId]);

  useEffect(() => {
    let isCurrent = true;

    progressRepository.loadProgress(roomId).then((progress) => {
      if (!isCurrent || !progress) {
        return;
      }

      setCurrentQuestionId(progress.currentQuestion);
      setAnswers(progress.answers);

      if (progress.currentQuestion === "q5") {
        void loadQ5Candidates(progress.answers);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [loadQ5Candidates, progressRepository, roomId]);

  const handleOptionPress = (value: AnswerValue) => {
    setAnswers((currentAnswers) => {
      if (!currentQuestion.multi) {
        return { ...currentAnswers, [currentQuestion.answerKey]: value };
      }
      if (typeof value !== "string") {
        return currentAnswers;
      }

      const currentValues = selectedValues(currentAnswers, currentQuestion);
      const nextValues = nextMultiSelectValues(
        currentValues.filter((entry): entry is string =>
          typeof entry === "string"
        ),
        value,
      );

      return { ...currentAnswers, [currentQuestion.answerKey]: nextValues };
    });
  };

  const handleSave = async () => {
    const savedAnswers = nextAnswers(answers, currentQuestion);
    const savedQuestion = questionAfter(currentQuestion.id);

    setAnswers(savedAnswers);
    setCurrentQuestionId(savedQuestion);
    await progressRepository.saveProgress({
      roomId,
      currentQuestion: savedQuestion,
      answers: savedAnswers,
    });

    if (savedQuestion === "q5") {
      await loadQ5Candidates(savedAnswers);
    }
  };

  const handleExitConfirm = async () => {
    await progressRepository.exitPlan({ roomId });
    onExited();
  };

  const submitQ5Answers = async (ratings: Record<string, number>) => {
    await submissionRepository.submitQuiz({
      roomId,
      answers: { ...answers, q5Ratings: ratings },
      q5Candidates,
    });
    onSubmitted?.();
  };

  const handleQ5Submit = async () => {
    await submitQ5Answers(q5Ratings);
  };

  const handleQ5NoResultsSubmit = async () => {
    await submitQ5Answers({});
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.root}
    >
      <View style={styles.chrome}>
        {currentQuestionId === "q1" ? (
          <View style={styles.chromeAction} />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setCurrentQuestionId(questionBefore(currentQuestionId))
            }
            style={styles.chromeAction}
          >
            <Text style={styles.chromeLabel}>Back</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsExitConfirmOpen(true)}
          style={styles.chromeAction}
        >
          <Text style={styles.chromeLabel}>{exitLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.progressRow}>
        {quizQuestionIds.map((questionId) => (
          <View
            key={questionId}
            style={[
              styles.progressSegment,
              questionId === currentQuestionId && styles.activeProgressSegment,
            ]}
          />
        ))}
      </View>

      {currentQuestionId === "q5" ? (
        <Q5Probe
          candidates={q5Candidates}
          onNoResultsSubmit={handleQ5NoResultsSubmit}
          onRatingPress={(candidateId, score) =>
            dispatchQ5({ type: "ratingChanged", candidateId, score })
          }
          onSubmit={handleQ5Submit}
          ratings={q5Ratings}
          status={q5Status}
        />
      ) : (
        <View style={styles.question}>
          <Text style={styles.eyebrow}>{currentQuestion.id.toUpperCase()}</Text>
          <Text style={styles.title}>{currentQuestion.title}</Text>
          <View style={styles.optionGrid}>
            {currentQuestion.options.map((option) => {
              const isSelected = currentSelectedValues.includes(option.value);

              return (
                <Pressable
                  accessibilityLabel={`${currentQuestion.labelPrefix} ${option.label}${
                    isSelected ? " selected" : ""
                  }`}
                  accessibilityRole="button"
                  key={String(option.value)}
                  onPress={() => handleOptionPress(option.value)}
                  style={[styles.option, isSelected && styles.selectedOption]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      isSelected && styles.selectedOptionLabel,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonLabel}>{currentQuestion.cta}</Text>
          </Pressable>
        </View>
      )}

      {isExitConfirmOpen ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>
            {participantRole === "joiner" ? "Leave this plan?" : "Exit this plan?"}
          </Text>
          <Text style={styles.confirmBody}>
            {participantRole === "joiner"
              ? "Your answers will be discarded. The host and others can still finish."
              : "Your answers will be discarded. Others can still finish without you."}
          </Text>
          <Pressable
            accessibilityLabel={`Confirm ${exitLabel.toLowerCase()} Plan`}
            accessibilityRole="button"
            onPress={handleExitConfirm}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonLabel}>{exitLabel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsExitConfirmOpen(false)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>Keep going</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function initialQ5Ratings(candidates: Q5Candidate[]): Record<string, number> {
  return Object.fromEntries(
    candidates.map((candidate) => [candidate.id, defaultQ5Rating]),
  );
}

type Q5ProbeProps = {
  candidates: Q5Candidate[];
  onNoResultsSubmit: () => void;
  onRatingPress: (candidateId: string, score: number) => void;
  onSubmit: () => void;
  ratings: Record<string, number>;
  status: Q5Status;
};

function Q5Probe({
  candidates,
  onNoResultsSubmit,
  onRatingPress,
  onSubmit,
  ratings,
  status,
}: Q5ProbeProps) {
  if (status === "loading" || status === "idle") {
    return (
      <View style={styles.question}>
        <Text style={styles.eyebrow}>Q5</Text>
        <Text style={styles.title}>Finding real spots to rate.</Text>
      </View>
    );
  }

  if (status === "noResults") {
    return (
      <View style={styles.question}>
        <Text style={styles.eyebrow}>Q5</Text>
        <Text style={styles.title}>No spots to rate near you.</Text>
        <Text style={styles.noResultsBody}>
          Couldn't line up rateable spots in your radius tonight. Your other
          answers still count - the verdict lands without this step.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onNoResultsSubmit}
          style={styles.sunButton}
        >
          <Text style={styles.sunButtonLabel}>Head to the verdict</Text>
        </Pressable>
      </View>
    );
  }

  const attributionText = candidates.find(
    (candidate) => candidate.attributionText,
  )?.attributionText;

  return (
    <View style={styles.question}>
      <Text style={styles.eyebrow}>Q5</Text>
      <Text style={styles.title}>How excited does each of these make you?</Text>
      <Text style={styles.q5Subtitle}>Three real spots near you. Rate each.</Text>
      <View style={styles.candidateStack}>
        {candidates.map((candidate) => (
          <View key={candidate.id} style={styles.candidateCard}>
            <Text style={styles.candidateName}>{candidate.name}</Text>
            {candidate.meta ? (
              <Text style={styles.candidateMeta}>
                {candidate.meta.toUpperCase()}
              </Text>
            ) : null}
            <View style={styles.ratingRow}>
              {q5RatingScores.map((score) => {
                const selected =
                  (ratings[candidate.id] ?? defaultQ5Rating) === score;

                return (
                  <Pressable
                    accessibilityLabel={`Rate ${score} for ${candidate.name}`}
                    accessibilityRole="button"
                    key={score}
                    onPress={() => onRatingPress(candidate.id, score)}
                    style={[
                      styles.ratingButton,
                      selected && styles.selectedRatingButton,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ratingLabel,
                        selected && styles.selectedRatingLabel,
                      ]}
                    >
                      {score}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
      {attributionText ? (
        <Text style={styles.q5Attribution}>{attributionText}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onSubmit}
        style={styles.sunButton}
      >
        <Text style={styles.sunButtonLabel}>Drop the verdict</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileTokens.color.ink,
  },
  content: {
    flexGrow: 1,
    padding: mobileTokens.spacing[5],
    paddingTop: mobileTokens.spacing[6],
  },
  chrome: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: mobileTokens.spacing[4],
  },
  chromeAction: {
    justifyContent: "center",
    minHeight: 44,
    minWidth: 64,
  },
  chromeLabel: {
    color: mobileTokens.color.copper,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  progressRow: {
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    marginBottom: mobileTokens.spacing[8],
  },
  progressSegment: {
    backgroundColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.full,
    flex: 1,
    height: 4,
  },
  activeProgressSegment: {
    backgroundColor: mobileTokens.color.sun,
  },
  question: {
    gap: mobileTokens.spacing[4],
  },
  noResultsBody: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  q5Subtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  candidateStack: {
    gap: mobileTokens.spacing[3],
  },
  candidateCard: {
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.lg,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
  },
  candidateName: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  candidateMeta: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 0,
  },
  q5Attribution: {
    alignSelf: "center",
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 0,
  },
  ratingRow: {
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
  },
  ratingButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  selectedRatingButton: {
    backgroundColor: mobileTokens.color.sun,
    borderColor: mobileTokens.color.sun,
  },
  ratingLabel: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  selectedRatingLabel: {
    color: mobileTokens.color.ink,
  },
  eyebrow: {
    color: mobileTokens.color.sun,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.display,
    fontSize: mobileTokens.typography.headline.size,
    fontWeight: mobileTokens.typography.headline.weight,
    lineHeight: mobileTokens.typography.headline.lineHeight,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileTokens.spacing[3],
  },
  option: {
    borderColor: mobileTokens.color.copper,
    borderRadius: mobileTokens.radius.md,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: mobileTokens.spacing[4],
  },
  selectedOption: {
    backgroundColor: mobileTokens.color.sun,
    borderColor: mobileTokens.color.sun,
  },
  optionLabel: {
    color: mobileTokens.color.copper,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
  },
  selectedOptionLabel: {
    color: mobileTokens.color.ink,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.sun,
    borderRadius: mobileTokens.radius.md,
    minHeight: 56,
    justifyContent: "center",
    marginTop: mobileTokens.spacing[4],
    paddingHorizontal: mobileTokens.spacing[4],
  },
  primaryButtonLabel: {
    color: mobileTokens.color.ink,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sunButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.sun,
    borderRadius: mobileTokens.radius.md,
    minHeight: 56,
    justifyContent: "center",
    marginTop: mobileTokens.spacing[4],
    paddingHorizontal: mobileTokens.spacing[4],
  },
  sunButtonLabel: {
    color: mobileTokens.color.ink,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  secondaryButton: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  secondaryButtonLabel: {
    color: mobileTokens.color.copper,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
  },
  confirmCard: {
    backgroundColor: mobileTokens.color.surfaceContainer,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.lg,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    marginTop: mobileTokens.spacing[8],
    padding: mobileTokens.spacing[4],
  },
  confirmTitle: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  confirmBody: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
});
