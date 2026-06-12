import type { VibeBandId } from "./vibe-band.ts";
import { VIBE_BANDS } from "./vibe-band.ts";

export type VibeReceiptCode =
  | "vibe_no_evidence"
  | "vibe_low_confidence"
  | "vibe_conflicting_evidence"
  | "vibe_mealtime_weighted";

export interface VibeAnchor {
  bandId: VibeBandId;
  position: number;
  phrases: readonly string[];
}

export type VibeFitSummarySource = "reviewSummary" | "generativeSummary";

export interface VibeFitSummaryText {
  source: VibeFitSummarySource;
  text: string;
  priority: number;
}

const VIBE_FIT_WEAK_STRUCTURED_HINTS = [
  "liveMusic",
  "goodForGroups",
  "goodForWatchingSports",
  "outdoorSeating",
] as const;

export type VibeFitWeakStructuredHint =
  typeof VIBE_FIT_WEAK_STRUCTURED_HINTS[number];

export interface VibeFitCandidate {
  candidateId: string;
  googlePlaceId?: string;
  summaryTexts: readonly VibeFitSummaryText[];
  weakStructuredHints?: Partial<Record<VibeFitWeakStructuredHint, boolean>>;
  mealTimeContext?: string;
  embeddingMode?: "fake";
}

export interface VibeEvidenceSpan {
  text: string;
  sourcePriority: number;
  signalStrength: number;
  mealTimeRelevant: boolean;
  negatedBandId?: VibeBandId;
  ambiguous: boolean;
}

export interface VibeFitSignal {
  candidateId: string;
  anchorVersion: string;
  spanAssemblerVersion: string;
  projectionVersion: string;
  vibePosition: number | null;
  confidence: number;
  receiptCodes: VibeReceiptCode[];
}

interface SourceTextChunk {
  text: string;
  sourcePriority: number;
  sourceIndex: number;
  chunkIndex: number;
}

interface SortableVibeEvidenceSpan extends VibeEvidenceSpan {
  sourceIndex: number;
  chunkIndex: number;
}

interface SimpleNegation {
  pattern: RegExp;
  negatedBandId: VibeBandId;
  oppositeBandId: VibeBandId;
}

interface SpanVector {
  span: VibeEvidenceSpan;
  vector: Record<VibeBandId, number>;
}

export const VIBE_FIT_CONFIG = Object.freeze({
  anchorVersion: "vibe-anchors-v1",
  spanAssemblerVersion: "vibe-span-assembler-v1",
  projectionVersion: "vibe-projection-fake-v1",
  maxSpansPerCandidate: 5,
  lowConfidenceThreshold: 0.5,
  conflictDistance: 2.5,
  anchors: [
    {
      bandId: "quiet",
      position: 1,
      phrases: [
        "quiet",
        "calm",
        "peaceful",
        "intimate",
        "easy conversation",
        "soft-spoken",
      ],
    },
    {
      bandId: "chill",
      position: 2,
      phrases: [
        "chill",
        "mellow",
        "cozy",
        "relaxed",
        "date-night",
        "laid-back",
      ],
    },
    {
      bandId: "social",
      position: 3,
      phrases: [
        "social",
        "balanced",
        "casual",
        "convivial",
        "comfortable buzz",
        "group-friendly",
      ],
    },
    {
      bandId: "lively",
      position: 4,
      phrases: [
        "lively",
        "buzzy",
        "energetic",
        "upbeat",
        "animated",
        "busy",
      ],
    },
    {
      bandId: "rowdy",
      position: 5,
      phrases: [
        "rowdy",
        "loud",
        "packed",
        "high-energy",
        "party",
        "hard to hear",
      ],
    },
  ] satisfies readonly VibeAnchor[],
});

export function buildVibeFitCandidate(input: {
  candidateId: string;
  googlePlaceId?: string;
  reviewSummary?: string | null;
  generativeSummary?: string | null;
  weakStructuredHints?: Partial<Record<VibeFitWeakStructuredHint, boolean>>;
  mealTimeContext?: string;
  embeddingMode?: "fake";
}): VibeFitCandidate {
  const summaryTexts: VibeFitSummaryText[] = [];
  if (typeof input.reviewSummary === "string" && input.reviewSummary.trim()) {
    summaryTexts.push({
      source: "reviewSummary",
      text: input.reviewSummary.trim(),
      priority: 1,
    });
  }
  if (
    typeof input.generativeSummary === "string" &&
    input.generativeSummary.trim()
  ) {
    summaryTexts.push({
      source: "generativeSummary",
      text: input.generativeSummary.trim(),
      priority: 2,
    });
  }

  const weakStructuredHints = filterWeakStructuredHints(input.weakStructuredHints);

  return {
    candidateId: input.candidateId,
    ...(input.googlePlaceId ? { googlePlaceId: input.googlePlaceId } : {}),
    summaryTexts,
    ...(Object.keys(weakStructuredHints).length > 0
      ? { weakStructuredHints }
      : {}),
    ...(input.mealTimeContext ? { mealTimeContext: input.mealTimeContext } : {}),
    ...(input.embeddingMode ? { embeddingMode: input.embeddingMode } : {}),
  };
}

const BAND_POSITIONS = new Map(
  VIBE_BANDS.map((band) => [band.id, band.position]),
);

const VIBE_TERMS: Record<VibeBandId, readonly string[]> = {
  quiet: ["quiet", "calm", "peaceful", "conversation"],
  chill: [
    "chill",
    "mellow",
    "cozy",
    "relaxed",
    "relaxing",
    "date-night",
    "intimate",
    "candlelit",
  ],
  social: ["social", "balanced", "casual", "convivial", "comfortable"],
  lively: ["lively", "buzzy", "energetic", "upbeat", "animated", "busy"],
  rowdy: [
    "rowdy",
    "loud",
    "packed",
    "crowded",
    "high-energy",
    "party",
    "shouting",
  ],
};

const VIBE_BAND_IDS = Object.keys(VIBE_TERMS) as VibeBandId[];

const AMBIGUOUS_SCOPE_TERMS = [
  "not exactly",
  "if you enjoy",
  "somehow",
  "supposedly",
  "kind of",
  "quotes",
  "'",
  '"',
];

const MEAL_TIME_PATTERN =
  /\b(brunch|breakfast|lunch|dinner|late night|after 10pm)\b/i;

const SIMPLE_NEGATIONS: SimpleNegation[] = [
  {
    pattern: /\bnot\s+(?:too\s+)?loud\b/i,
    negatedBandId: "rowdy",
    oppositeBandId: "quiet",
  },
  {
    pattern: /\bnot\s+(?:too\s+)?crowded\b/i,
    negatedBandId: "rowdy",
    oppositeBandId: "quiet",
  },
  {
    pattern: /\bnot\s+quiet\b/i,
    negatedBandId: "quiet",
    oppositeBandId: "lively",
  },
];

export function extractVibeEvidenceSpans(
  candidate: Pick<VibeFitCandidate, "summaryTexts" | "mealTimeContext">,
): VibeEvidenceSpan[] {
  const spans = candidate.summaryTexts
    .flatMap((source, sourceIndex) =>
      splitSourceText(source.text).map((text, chunkIndex) => ({
        text,
        sourcePriority: source.priority,
        sourceIndex,
        chunkIndex,
      }))
    )
    .map((span) => buildEvidenceSpan(span, candidate.mealTimeContext))
    .filter((
      span,
    ): span is SortableVibeEvidenceSpan => span !== null)
    .sort((a, b) =>
      a.sourcePriority - b.sourcePriority ||
      a.sourceIndex - b.sourceIndex ||
      a.chunkIndex - b.chunkIndex
    );

  return spans.slice(0, VIBE_FIT_CONFIG.maxSpansPerCandidate).map((span) => ({
    text: span.text,
    sourcePriority: span.sourcePriority,
    signalStrength: span.signalStrength,
    mealTimeRelevant: span.mealTimeRelevant,
    negatedBandId: span.negatedBandId,
    ambiguous: span.ambiguous,
  }));
}

function filterWeakStructuredHints(
  hints: Partial<Record<VibeFitWeakStructuredHint, boolean>> | undefined,
): Partial<Record<VibeFitWeakStructuredHint, boolean>> {
  if (!hints) return {};
  const out: Partial<Record<VibeFitWeakStructuredHint, boolean>> = {};
  for (const key of VIBE_FIT_WEAK_STRUCTURED_HINTS) {
    if (typeof hints[key] === "boolean") {
      out[key] = hints[key];
    }
  }
  return out;
}

export function scoreVibeFitCandidate(
  candidate: VibeFitCandidate,
): VibeFitSignal {
  const spans = extractVibeEvidenceSpans(candidate);
  if (spans.length === 0) {
    return {
      candidateId: candidate.candidateId,
      anchorVersion: VIBE_FIT_CONFIG.anchorVersion,
      spanAssemblerVersion: VIBE_FIT_CONFIG.spanAssemblerVersion,
      projectionVersion: VIBE_FIT_CONFIG.projectionVersion,
      vibePosition: null,
      confidence: 0,
      receiptCodes: ["vibe_no_evidence", "vibe_low_confidence"],
    };
  }

  const spanVectors: SpanVector[] = spans.map((span) => ({
    span,
    vector: fakeEmbeddingForSpan(span),
  }));
  const bandScores = centroidBandScores(spanVectors);
  const scoreTotal = VIBE_BAND_IDS.reduce(
    (sum, bandId) => sum + bandScores[bandId],
    0,
  );
  const weightedPositionTotal = VIBE_BAND_IDS.reduce((sum, bandId) => {
    return sum + (BAND_POSITIONS.get(bandId) ?? 3) * bandScores[bandId];
  }, 0);
  const vibePosition = scoreTotal === 0 ? null : clamp(
    weightedPositionTotal / scoreTotal,
    1,
    5,
  );

  const conflict = hasConflict(spanVectors);
  const clarity = anchorClarity(bandScores);
  const evidenceAmount = Math.min(
    1,
    spans.reduce((sum, span) => sum + span.signalStrength, 0) / 3,
  );
  const ambiguityPenalty = spans.some((span) => span.ambiguous) ? 0.3 : 0;
  const conflictPenalty = conflict ? 0.28 : 0;
  const confidence = clamp(
    0.24 + evidenceAmount * 0.22 + clarity * 0.38 - ambiguityPenalty -
      conflictPenalty,
    0,
    1,
  );

  const receiptCodes: VibeReceiptCode[] = [];
  if (confidence < VIBE_FIT_CONFIG.lowConfidenceThreshold) {
    receiptCodes.push("vibe_low_confidence");
  }
  if (conflict) {
    receiptCodes.push("vibe_conflicting_evidence");
  }
  if (spans.some((span) => span.mealTimeRelevant)) {
    receiptCodes.push("vibe_mealtime_weighted");
  }

  return {
    candidateId: candidate.candidateId,
    anchorVersion: VIBE_FIT_CONFIG.anchorVersion,
    spanAssemblerVersion: VIBE_FIT_CONFIG.spanAssemblerVersion,
    projectionVersion: VIBE_FIT_CONFIG.projectionVersion,
    vibePosition,
    confidence,
    receiptCodes,
  };
}

function splitSourceText(text: string): string[] {
  return text
    .split(/[.;]/)
    .flatMap((chunk) => chunk.split(/,\s+(?:and\s+)?/i))
    .flatMap((chunk) => chunk.split(/\s+and\s+(?=not\s+)/i))
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function buildEvidenceSpan(
  span: SourceTextChunk,
  mealTimeContext?: string,
): SortableVibeEvidenceSpan | null {
  const lower = span.text.toLowerCase();
  const negation = findSimpleNegation(span.text);
  const matchedBands = matchedVibeBands(lower);
  if (!negation && matchedBands.length === 0) {
    return null;
  }

  const signalStrength = Math.max(
    negation ? 1 : 0,
    matchedBands.reduce(
      (sum, bandId) => sum + termHits(lower, VIBE_TERMS[bandId]),
      0,
    ),
  );

  return {
    text: span.text,
    sourcePriority: span.sourcePriority,
    sourceIndex: span.sourceIndex,
    chunkIndex: span.chunkIndex,
    signalStrength,
    mealTimeRelevant: hasMealTimeSignal(span.text, lower, mealTimeContext),
    negatedBandId: negation?.negatedBandId,
    ambiguous: AMBIGUOUS_SCOPE_TERMS.some((term) => lower.includes(term)),
  };
}

function matchedVibeBands(text: string): VibeBandId[] {
  return VIBE_BAND_IDS.filter((bandId) =>
    VIBE_TERMS[bandId].some((term) => containsTerm(text, term))
  );
}

function fakeEmbeddingForSpan(
  span: VibeEvidenceSpan,
): Record<VibeBandId, number> {
  const lower = span.text.toLowerCase();
  const vector = zeroVector();
  const negation = findSimpleNegation(span.text);

  if (negation) {
    vector[negation.oppositeBandId] += 1.2;
  }

  for (const bandId of VIBE_BAND_IDS) {
    for (const term of VIBE_TERMS[bandId]) {
      if (containsTerm(lower, term)) {
        vector[bandId] += 1;
      }
    }
  }

  for (const bandId of VIBE_BAND_IDS) {
    vector[bandId] *= span.mealTimeRelevant ? 1.15 : 1;
  }

  return vector;
}

function centroidBandScores(
  spanVectors: SpanVector[],
): Record<VibeBandId, number> {
  const scores = zeroVector();
  for (const { span, vector } of spanVectors) {
    for (const bandId of VIBE_BAND_IDS) {
      scores[bandId] += vector[bandId] * Math.max(1, span.signalStrength);
    }
  }
  return scores;
}

function hasConflict(spanVectors: SpanVector[]): boolean {
  const strongestPositions = spanVectors
    .map(({ vector }) => strongestBandPosition(vector))
    .filter((position): position is number => position !== null);
  if (strongestPositions.length < 2) return false;
  return Math.max(...strongestPositions) - Math.min(...strongestPositions) >=
    VIBE_FIT_CONFIG.conflictDistance;
}

function strongestBandPosition(
  vector: Record<VibeBandId, number>,
): number | null {
  let bestBand: VibeBandId | null = null;
  let bestScore = 0;
  for (const bandId of VIBE_BAND_IDS) {
    if (vector[bandId] > bestScore) {
      bestBand = bandId;
      bestScore = vector[bandId];
    }
  }
  return bestBand ? BAND_POSITIONS.get(bestBand) ?? null : null;
}

function anchorClarity(scores: Record<VibeBandId, number>): number {
  const sorted = Object.values(scores).sort((a, b) => b - a);
  if (sorted[0] === 0) return 0;
  return clamp((sorted[0] - (sorted[1] ?? 0)) / sorted[0], 0, 1);
}

function termHits(text: string, terms: readonly string[]): number {
  return terms.filter((term) => containsTerm(text, term)).length;
}

function findSimpleNegation(text: string): SimpleNegation | undefined {
  return SIMPLE_NEGATIONS.find((entry) => entry.pattern.test(text));
}

function hasMealTimeSignal(
  text: string,
  lowerText: string,
  mealTimeContext?: string,
): boolean {
  if (!mealTimeContext) return false;

  return lowerText.includes(mealTimeContext.toLowerCase()) ||
    MEAL_TIME_PATTERN.test(text);
}

function containsTerm(text: string, term: string): boolean {
  return new RegExp(
    `\\b${escapeRegExp(term).replaceAll("\\ ", "\\s+")}\\b`,
    "i",
  )
    .test(text);
}

function zeroVector(): Record<VibeBandId, number> {
  return {
    quiet: 0,
    chill: 0,
    social: 0,
    lively: 0,
    rowdy: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
