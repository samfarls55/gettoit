import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { mobileTokens } from "../design/tokens";
import type {
  QuizAnswers,
  QuizProgressRepository,
  QuizQuestionId,
} from "./quizProgressRepository";

type QuizScreenProps = {
  progressRepository: QuizProgressRepository;
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
  id: QuizQuestionId;
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
  return questionConfigs.findIndex((question) => question.id === questionId);
}

function questionAfter(questionId: QuizQuestionId): QuizQuestionId {
  return questionConfigs[
    Math.min(questionIndex(questionId) + 1, questionConfigs.length - 1)
  ].id;
}

function questionBefore(questionId: QuizQuestionId): QuizQuestionId {
  return questionConfigs[
    Math.max(questionIndex(questionId) - 1, 0)
  ].id;
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
  role,
  roomId,
  onExited,
}: QuizScreenProps) {
  const [currentQuestionId, setCurrentQuestionId] =
    useState<QuizQuestionId>("q1");
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
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
    });

    return () => {
      isCurrent = false;
    };
  }, [progressRepository, roomId]);

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
  };

  const handleExitConfirm = async () => {
    await progressRepository.exitPlan({ roomId });
    onExited();
  };

  return (
    <View style={styles.root}>
      <View style={styles.chrome}>
        {currentQuestion.id === "q1" ? (
          <View style={styles.chromeAction} />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setCurrentQuestionId(questionBefore(currentQuestion.id))
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
        {questionConfigs.map((question) => (
          <View
            key={question.id}
            style={[
              styles.progressSegment,
              question.id === currentQuestion.id && styles.activeProgressSegment,
            ]}
          />
        ))}
      </View>

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
