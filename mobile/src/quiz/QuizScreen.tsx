import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { mobileTokens } from "../design/tokens";
import type { Q5CandidateRepository } from "./q5CandidateRepository";
import { fakeQ5CandidateRepository } from "./q5CandidateRepository";
import {
  generateQ5FactorialCards,
  q5CardsToCandidates,
  type Q5Candidate,
  type Q5MemberProfile,
} from "./q5Factorial";
import type {
  QuizAnswers,
  QuizProgressRepository,
  QuizQuestionId,
} from "./quizProgressRepository";

type QuizScreenProps = {
  progressRepository: QuizProgressRepository;
  q5CandidateRepository?: Q5CandidateRepository;
  role: "initiator" | "joiner";
  roomId: string;
  onExited: () => void;
};

type AnswerKey = keyof QuizAnswers;

type Option = {
  label: string;
  value: string;
};

type QuestionConfig = {
  id: Exclude<QuizQuestionId, "q5">;
  title: string;
  answerKey: AnswerKey;
  cta: string;
  labelPrefix: string;
  options: readonly Option[];
  fallbackValue?: string;
  multi?: true;
};

const noPreferenceValue = "noPreference";
const maxMultiSelectValues = 3;
const quizQuestionIds: readonly QuizQuestionId[] = ["q1", "q2", "q3", "q4", "q5"];
const vibeValueByAnswer: Record<string, number> = {
  quiet: 0,
  chill: 1,
  social: 2,
  lively: 3,
  rowdy: 4,
};

const questionConfigs: readonly QuestionConfig[] = [
  {
    id: "q1",
    title: "What sounds good tonight?",
    answerKey: "q1CuisineCravings",
    cta: "Save cravings",
    labelPrefix: "Cuisine craving",
    multi: true,
    options: [
      { label: "Italian", value: "italian" },
      { label: "Mexican", value: "mexican" },
      { label: "Japanese", value: "japanese" },
      { label: "No preference", value: "noPreference" },
    ],
  },
  {
    id: "q2",
    title: "What is the spend cap?",
    answerKey: "q2SpendCap",
    cta: "Save spend",
    labelPrefix: "Spend cap",
    fallbackValue: "$$",
    options: [
      { label: "$", value: "$" },
      { label: "$$", value: "$$" },
      { label: "$$$", value: "$$$" },
      { label: "$$$$", value: "$$$$" },
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
): string[] {
  const value = answers[question.answerKey];

  if (Array.isArray(value)) {
    return value;
  }

  return typeof value === "string" ? [value] : [];
}

function nextAnswers(
  answers: QuizAnswers,
  question: QuestionConfig,
): QuizAnswers {
  const currentValues = selectedValues(answers, question);
  const value = question.multi
    ? currentValues
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
  q5CandidateRepository = fakeQ5CandidateRepository,
  role,
  roomId,
  onExited,
}: QuizScreenProps) {
  const [currentQuestionId, setCurrentQuestionId] =
    useState<QuizQuestionId>("q1");
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [q5Candidates, setQ5Candidates] = useState<Q5Candidate[]>([]);
  const [q5Status, setQ5Status] = useState<"idle" | "loading" | "ready" | "noResults">("idle");
  const [q5Ratings, setQ5Ratings] = useState<Record<string, number>>({});
  const currentQuestion =
    questionConfigs[questionIndex(currentQuestionId)] ?? questionConfigs[0];
  const exitLabel = role === "joiner" ? "Leave" : "Exit";
  const currentSelectedValues = selectedValues(answers, currentQuestion);

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
  }, [progressRepository, roomId]);

  const loadQ5Candidates = async (nextQuizAnswers: QuizAnswers) => {
    setQ5Status("loading");

    try {
      const pool = await q5CandidateRepository.loadCandidates({
        roomId,
        answers: nextQuizAnswers,
      });
      const cards = generateQ5FactorialCards({
        member: memberProfileFromAnswers(nextQuizAnswers),
        pool,
      });

      if (!cards) {
        setQ5Candidates([]);
        setQ5Status("noResults");
        return;
      }

      const candidates = q5CardsToCandidates(cards);

      setQ5Candidates(candidates);
      setQ5Ratings(
        Object.fromEntries(candidates.map((candidate) => [candidate.id, 3])),
      );
      setQ5Status("ready");
    } catch {
      setQ5Candidates([]);
      setQ5Status("noResults");
    }
  };

  const handleOptionPress = (value: string) => {
    setAnswers((currentAnswers) => {
      if (!currentQuestion.multi) {
        return { ...currentAnswers, [currentQuestion.answerKey]: value };
      }

      const currentValues = selectedValues(currentAnswers, currentQuestion);
      const nextValues = nextMultiSelectValues(currentValues, value);

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

  const handleQ5Submit = async () => {
    await progressRepository.saveProgress({
      roomId,
      currentQuestion: "q5",
      answers: { ...answers, q5Ratings },
    });
  };

  const handleQ5NoResultsSubmit = async () => {
    await progressRepository.saveProgress({
      roomId,
      currentQuestion: "q5",
      answers: { ...answers, q5Ratings: {} },
    });
  };

  return (
    <View style={styles.root}>
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
            setQ5Ratings((currentRatings) => ({
              ...currentRatings,
              [candidateId]: score,
            }))
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
                key={option.value}
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
            {role === "joiner" ? "Leave this plan?" : "Exit this plan?"}
          </Text>
          <Text style={styles.confirmBody}>
            {role === "joiner"
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
    </View>
  );
}

function memberProfileFromAnswers(quizAnswers: QuizAnswers): Q5MemberProfile {
  return {
    cuisines: (quizAnswers.q1CuisineCravings ?? []).filter(
      (cuisine) => cuisine !== noPreferenceValue,
    ),
    reputation: quizAnswers.q3Reputation ?? noPreferenceValue,
    vibe: vibeValueByAnswer[quizAnswers.q4VibeEnergy ?? "social"] ?? 2,
  };
}

type Q5ProbeProps = {
  candidates: Q5Candidate[];
  onNoResultsSubmit: () => void;
  onRatingPress: (candidateId: string, score: number) => void;
  onSubmit: () => void;
  ratings: Record<string, number>;
  status: "idle" | "loading" | "ready" | "noResults";
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
              {[1, 2, 3, 4, 5].map((score) => {
                const selected = (ratings[candidate.id] ?? 3) === score;

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
    padding: mobileTokens.spacing[8],
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
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  progressRow: {
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
    marginBottom: mobileTokens.spacing[8],
  },
  progressSegment: {
    backgroundColor: mobileTokens.color.glassStroke,
    borderRadius: 999,
    flex: 1,
    height: 4,
  },
  activeProgressSegment: {
    backgroundColor: mobileTokens.color.paper,
  },
  question: {
    gap: mobileTokens.spacing[4],
  },
  noResultsBody: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  q5Subtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  candidateStack: {
    gap: mobileTokens.spacing[3],
  },
  candidateCard: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 12,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
  },
  candidateName: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  candidateMeta: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 1.5,
  },
  ratingRow: {
    flexDirection: "row",
    gap: mobileTokens.spacing[3],
  },
  ratingButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 10,
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
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  selectedRatingLabel: {
    color: mobileTokens.color.ink,
  },
  eyebrow: {
    color: mobileTokens.color.sun,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  title: {
    color: mobileTokens.color.paper,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileTokens.spacing[3],
  },
  option: {
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: mobileTokens.spacing[4],
  },
  selectedOption: {
    backgroundColor: mobileTokens.color.paper,
    borderColor: mobileTokens.color.paper,
  },
  optionLabel: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
  },
  selectedOptionLabel: {
    color: mobileTokens.color.ink,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.paper,
    borderRadius: 999,
    minHeight: 56,
    justifyContent: "center",
    marginTop: mobileTokens.spacing[4],
    paddingHorizontal: mobileTokens.spacing[4],
  },
  primaryButtonLabel: {
    color: mobileTokens.color.ink,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sunButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.sun,
    borderRadius: 999,
    minHeight: 56,
    justifyContent: "center",
    marginTop: mobileTokens.spacing[4],
    paddingHorizontal: mobileTokens.spacing[4],
  },
  sunButtonLabel: {
    color: mobileTokens.color.ink,
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
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "700",
  },
  confirmCard: {
    backgroundColor: "rgba(20,20,30,0.92)",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 12,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    marginTop: mobileTokens.spacing[8],
    padding: mobileTokens.spacing[4],
  },
  confirmTitle: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  confirmBody: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
});
