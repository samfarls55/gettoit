import type { VibeBandId } from "./vibe-band.ts";
import { VIBE_BANDS } from "./vibe-band.ts";

export type VibeReceiptCode =
  | "vibe_no_evidence"
  | "vibe_low_confidence"
  | "vibe_conflicting_evidence"
  | "vibe_mealtime_weighted"
  | "vibe_embedding_unavailable"
  | "vibe_embedding_budget_exhausted"
  | "vibe_embeddings_disabled"
  | "selected_vibe_low_confidence_relaxed"
  | "selected_vibe_contrast_relaxed"
  | "selected_vibe_high_confidence_keep"
  | "selected_vibe_high_confidence_drop";

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

export interface VibeEmbeddingRuntimeEnv {
  VOYAGE_API_KEY?: string;
  VIBE_EMBEDDINGS_ENABLED?: string;
}

export type VibeEmbeddingFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface VibeEmbeddingBudget {
  maxTextsPerFlow: number;
}

export interface VoyageEmbeddingDeps {
  env: VibeEmbeddingRuntimeEnv;
  fetch?: VibeEmbeddingFetch;
  timeoutMs?: number;
  budget: VibeEmbeddingBudget;
}

export type VibeFitFlowDeps = VoyageEmbeddingDeps;

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

export interface Q5VibeSelectionInput {
  targetVibePosition: number;
  candidates: readonly VibeFitCandidate[];
}

export type VibeFitObservabilityStatus =
  | "success"
  | "disabled"
  | "provider_unavailable"
  | "timeout"
  | "budget_exhausted"
  | "no_evidence";

export type VibeFitPositionBucket =
  | "quiet"
  | "chill"
  | "social"
  | "lively"
  | "rowdy"
  | "unknown";

export type VibeFitPositionBuckets = Record<VibeFitPositionBucket, number>;

export interface VibeFitObservabilityEvent {
  event: "vibe_fit_flow";
  status: VibeFitObservabilityStatus;
  candidateCount: number;
  embeddedTextCount: number;
  noEvidenceCount: number;
  lowConfidenceCount: number;
  positionBuckets: VibeFitPositionBuckets;
  receiptCounts: Partial<Record<VibeReceiptCode, number>>;
}

export type Q5VibeSelectionResult =
  | {
    kind: "selected";
    keepCandidateId: string;
    dropCandidateId: string;
    receiptCodes: VibeReceiptCode[];
  }
  | { kind: "no-results"; receiptCodes: VibeReceiptCode[] };

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

interface NumericSpanVector {
  span: VibeEvidenceSpan;
  vector: readonly number[];
}

interface ExtractedVibeFitCandidate {
  candidate: VibeFitCandidate;
  spans: VibeEvidenceSpan[];
}

interface Q5VibeSelectionStage {
  minConfidence: number;
  keepDistance: number;
  dropDistance: number;
  receiptCodes: readonly VibeReceiptCode[];
}

interface Q5WeakHintPosition {
  hint: VibeFitWeakStructuredHint;
  position: number;
}

type VoyageEmbeddingError =
  | "invalid_credential"
  | "provider_unavailable"
  | "timeout"
  | "bad_response"
  | "budget_exhausted";

type VoyageEmbeddingResult =
  | { ok: true; embeddingsByText: Map<string, readonly number[]> }
  | { ok: false; error: VoyageEmbeddingError };

export const VIBE_FIT_CONFIG = Object.freeze({
  anchorVersion: "vibe-anchors-v1",
  spanAssemblerVersion: "vibe-span-assembler-v1",
  projectionVersion: "vibe-projection-fake-v1",
  voyageProjectionVersion: "vibe-projection-voyage-v1",
  voyageModel: "voyage-4-lite",
  voyageEndpoint: "https://api.voyageai.com/v1/embeddings",
  embeddingTimeoutMs: 1_500,
  maxSpansPerCandidate: 5,
  lowConfidenceThreshold: 0.5,
  q5StrictConfidenceThreshold: 0.62,
  q5RelaxedConfidenceThreshold: 0,
  q5StrictKeepDistance: 0.65,
  q5RelaxedKeepDistance: 0.9,
  q5StrictDropDistance: 1.5,
  q5RelaxedDropDistance: 0.7,
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

const Q5_VIBE_SELECTION_STAGES: readonly Q5VibeSelectionStage[] = [
  {
    minConfidence: VIBE_FIT_CONFIG.q5StrictConfidenceThreshold,
    keepDistance: VIBE_FIT_CONFIG.q5StrictKeepDistance,
    dropDistance: VIBE_FIT_CONFIG.q5StrictDropDistance,
    receiptCodes: [
      "selected_vibe_high_confidence_keep",
      "selected_vibe_high_confidence_drop",
    ],
  },
  {
    minConfidence: VIBE_FIT_CONFIG.q5RelaxedConfidenceThreshold,
    keepDistance: VIBE_FIT_CONFIG.q5StrictKeepDistance,
    dropDistance: VIBE_FIT_CONFIG.q5StrictDropDistance,
    receiptCodes: ["selected_vibe_low_confidence_relaxed"],
  },
  {
    minConfidence: VIBE_FIT_CONFIG.q5RelaxedConfidenceThreshold,
    keepDistance: VIBE_FIT_CONFIG.q5RelaxedKeepDistance,
    dropDistance: VIBE_FIT_CONFIG.q5RelaxedDropDistance,
    receiptCodes: ["selected_vibe_contrast_relaxed"],
  },
];

const Q5_WEAK_HINT_POSITIONS: readonly Q5WeakHintPosition[] = [
  { hint: "liveMusic", position: 4.6 },
  { hint: "goodForWatchingSports", position: 4.6 },
  { hint: "goodForGroups", position: 3.7 },
  { hint: "outdoorSeating", position: 2.8 },
];

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

  const weakStructuredHints = filterWeakStructuredHints(
    input.weakStructuredHints,
  );

  return {
    candidateId: input.candidateId,
    ...(input.googlePlaceId ? { googlePlaceId: input.googlePlaceId } : {}),
    summaryTexts,
    ...(Object.keys(weakStructuredHints).length > 0
      ? { weakStructuredHints }
      : {}),
    ...(input.mealTimeContext
      ? { mealTimeContext: input.mealTimeContext }
      : {}),
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

export async function scoreVibeFitCandidateFlow(
  candidates: readonly VibeFitCandidate[],
  deps: VibeFitFlowDeps,
): Promise<VibeFitSignal[]> {
  const extracted = candidates.map(extractVibeFitCandidate);
  const evidenceCandidates = extracted.filter(({ spans }) => spans.length > 0);

  if (evidenceCandidates.length === 0) {
    return extracted.map(({ candidate }) =>
      noEvidenceVibeFitSignal(candidate.candidateId)
    );
  }

  if (deps.env.VIBE_EMBEDDINGS_ENABLED !== "true") {
    return fallbackVibeFitSignals(extracted, "vibe_embeddings_disabled");
  }

  const texts = dedupeTexts([
    ...VIBE_FIT_CONFIG.anchors.flatMap((anchor) => anchor.phrases),
    ...evidenceCandidates.flatMap(({ spans }) =>
      spans.map((span) => span.text)
    ),
  ]);

  if (texts.length > deps.budget.maxTextsPerFlow) {
    return fallbackVibeFitSignals(extracted, "vibe_embedding_budget_exhausted");
  }

  const embeddingResult = await embedTextsWithVoyage(texts, deps);
  if (!embeddingResult.ok) {
    const receipt = embeddingResult.error === "budget_exhausted"
      ? "vibe_embedding_budget_exhausted"
      : "vibe_embedding_unavailable";
    return fallbackVibeFitSignals(extracted, receipt);
  }

  return extracted.map((extractedCandidate) => {
    const { candidate, spans } = extractedCandidate;
    if (spans.length === 0) {
      return noEvidenceVibeFitSignal(candidate.candidateId);
    }

    const signal = scoreSpansWithEmbeddings(
      candidate.candidateId,
      spans,
      embeddingResult.embeddingsByText,
    );
    return signal ??
      fallbackVibeFitSignal(extractedCandidate, "vibe_embedding_unavailable");
  });
}

export async function selectQ5VibeKeepDropCandidates(
  input: Q5VibeSelectionInput,
  deps: VibeFitFlowDeps,
): Promise<Q5VibeSelectionResult> {
  const baseSignals = await scoreVibeFitCandidateFlow(input.candidates, deps);
  const signalsByCandidateId = new Map(
    baseSignals.map((signal) => [signal.candidateId, signal]),
  );
  const q5Signals = input.candidates.map((candidate) =>
    q5SignalWithWeakHints(
      signalsByCandidateId.get(candidate.candidateId) ??
        noEvidenceVibeFitSignal(candidate.candidateId),
      candidate,
    )
  );

  const target = clamp(input.targetVibePosition, 1, 5);
  for (const stage of Q5_VIBE_SELECTION_STAGES) {
    const keep = q5Signals.find((signal) =>
      isQ5VibeKeep(signal, target, stage.keepDistance, stage.minConfidence)
    );
    if (!keep) {
      continue;
    }

    const drop = q5Signals.find((signal) =>
      signal.candidateId !== keep.candidateId &&
      isQ5VibeDrop(signal, target, stage.dropDistance, stage.minConfidence)
    );

    if (drop) {
      return {
        kind: "selected",
        keepCandidateId: keep.candidateId,
        dropCandidateId: drop.candidateId,
        receiptCodes: dedupeReceiptCodes([
          ...keep.receiptCodes,
          ...drop.receiptCodes,
          ...stage.receiptCodes,
        ]),
      };
    }
  }

  return {
    kind: "no-results",
    receiptCodes: dedupeReceiptCodes(
      q5Signals.flatMap((signal) => signal.receiptCodes),
    ),
  };
}

export async function embedTextsWithVoyage(
  texts: readonly string[],
  deps: VoyageEmbeddingDeps,
): Promise<VoyageEmbeddingResult> {
  const apiKey = deps.env.VOYAGE_API_KEY ?? "";
  if (!apiKey) return { ok: false, error: "provider_unavailable" };

  const uniqueTexts = dedupeTexts(texts);
  if (uniqueTexts.length > deps.budget.maxTextsPerFlow) {
    return { ok: false, error: "budget_exhausted" };
  }

  const fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = deps.timeoutMs ?? VIBE_FIT_CONFIG.embeddingTimeoutMs;
  const first = await voyageEmbeddingAttempt(uniqueTexts, {
    apiKey,
    fetch: fetchImpl,
    timeoutMs,
  });
  if (first.ok) return first;
  if (
    !first.transient ||
    uniqueTexts.length * 2 > deps.budget.maxTextsPerFlow
  ) {
    return { ok: false, error: first.error };
  }

  const second = await voyageEmbeddingAttempt(uniqueTexts, {
    apiKey,
    fetch: fetchImpl,
    timeoutMs,
  });
  return second.ok ? second : { ok: false, error: second.error };
}

export function buildVibeFitObservabilityEvent(input: {
  status: VibeFitObservabilityStatus;
  embeddedTextCount: number;
  signals: readonly VibeFitSignal[];
}): VibeFitObservabilityEvent {
  const positionBuckets = emptyVibeFitPositionBuckets();
  const receiptCounts: Partial<Record<VibeReceiptCode, number>> = {};
  let noEvidenceCount = 0;
  let lowConfidenceCount = 0;

  for (const signal of input.signals) {
    const bucket = vibeFitPositionBucket(signal.vibePosition);
    positionBuckets[bucket] += 1;
    if (signal.vibePosition === null) noEvidenceCount += 1;
    if (signal.receiptCodes.includes("vibe_low_confidence")) {
      lowConfidenceCount += 1;
    }
    for (const code of signal.receiptCodes) {
      receiptCounts[code] = (receiptCounts[code] ?? 0) + 1;
    }
  }

  return {
    event: "vibe_fit_flow",
    status: input.status,
    candidateCount: input.signals.length,
    embeddedTextCount: Math.max(0, Math.trunc(input.embeddedTextCount)),
    noEvidenceCount,
    lowConfidenceCount,
    positionBuckets,
    receiptCounts,
  };
}

function neutralVibeFitSignal(
  candidateId: string,
  vibePosition: number | null,
  receiptCodes: VibeReceiptCode[],
): VibeFitSignal {
  return {
    candidateId,
    anchorVersion: VIBE_FIT_CONFIG.anchorVersion,
    spanAssemblerVersion: VIBE_FIT_CONFIG.spanAssemblerVersion,
    projectionVersion: VIBE_FIT_CONFIG.voyageProjectionVersion,
    vibePosition,
    confidence: 0,
    receiptCodes,
  };
}

function extractVibeFitCandidate(
  candidate: VibeFitCandidate,
): ExtractedVibeFitCandidate {
  return {
    candidate,
    spans: extractVibeEvidenceSpans(candidate),
  };
}

function noEvidenceVibeFitSignal(candidateId: string): VibeFitSignal {
  return neutralVibeFitSignal(candidateId, null, [
    "vibe_no_evidence",
    "vibe_low_confidence",
  ]);
}

function fallbackVibeFitSignals(
  extractedCandidates: readonly ExtractedVibeFitCandidate[],
  evidenceReceiptCode: VibeReceiptCode,
): VibeFitSignal[] {
  return extractedCandidates.map((extractedCandidate) =>
    fallbackVibeFitSignal(extractedCandidate, evidenceReceiptCode)
  );
}

function fallbackVibeFitSignal(
  { candidate, spans }: ExtractedVibeFitCandidate,
  evidenceReceiptCode: VibeReceiptCode,
): VibeFitSignal {
  if (spans.length === 0) {
    return noEvidenceVibeFitSignal(candidate.candidateId);
  }

  return neutralVibeFitSignal(candidate.candidateId, 3, [
    evidenceReceiptCode,
    "vibe_low_confidence",
  ]);
}

function scoreSpansWithEmbeddings(
  candidateId: string,
  spans: readonly VibeEvidenceSpan[],
  embeddingsByText: Map<string, readonly number[]>,
): VibeFitSignal | null {
  const anchorVectors = new Map<VibeBandId, readonly (readonly number[])[]>();
  for (const anchor of VIBE_FIT_CONFIG.anchors) {
    const vectors = anchor.phrases
      .map((phrase) => embeddingsByText.get(phrase))
      .filter((vector): vector is readonly number[] => Array.isArray(vector));
    if (vectors.length === 0) return null;
    anchorVectors.set(anchor.bandId, vectors);
  }

  const spanVectors: NumericSpanVector[] = [];
  for (const span of spans) {
    const vector = embeddingsByText.get(span.text);
    if (!vector) return null;
    spanVectors.push({ span, vector });
  }

  const bandScores = zeroVector();
  for (const { span, vector } of spanVectors) {
    for (const bandId of VIBE_BAND_IDS) {
      const vectors = anchorVectors.get(bandId) ?? [];
      const averageSimilarity = vectors.reduce(
        (sum, anchorVector) => sum + Math.max(0, cosine(vector, anchorVector)),
        0,
      ) / Math.max(1, vectors.length);
      bandScores[bandId] += averageSimilarity *
        Math.max(1, span.signalStrength);
    }
  }

  const scoreTotal = VIBE_BAND_IDS.reduce(
    (sum, bandId) => sum + bandScores[bandId],
    0,
  );
  const vibePosition = scoreTotal === 0 ? null : clamp(
    VIBE_BAND_IDS.reduce((sum, bandId) => {
      return sum + (BAND_POSITIONS.get(bandId) ?? 3) * bandScores[bandId];
    }, 0) / scoreTotal,
    1,
    5,
  );
  if (vibePosition === null) return null;

  const conflict = hasNumericConflict(bandScores);
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
  if (conflict) receiptCodes.push("vibe_conflicting_evidence");
  if (spans.some((span) => span.mealTimeRelevant)) {
    receiptCodes.push("vibe_mealtime_weighted");
  }

  return {
    candidateId,
    anchorVersion: VIBE_FIT_CONFIG.anchorVersion,
    spanAssemblerVersion: VIBE_FIT_CONFIG.spanAssemblerVersion,
    projectionVersion: VIBE_FIT_CONFIG.voyageProjectionVersion,
    vibePosition,
    confidence,
    receiptCodes,
  };
}

function q5SignalWithWeakHints(
  signal: VibeFitSignal,
  candidate: VibeFitCandidate,
): VibeFitSignal {
  if (signal.vibePosition !== null) {
    return signal;
  }

  const hintedPosition = q5WeakHintPosition(candidate.weakStructuredHints);
  if (hintedPosition === null) {
    return signal;
  }

  return {
    ...signal,
    vibePosition: hintedPosition,
    confidence: Math.max(signal.confidence, 0),
  };
}

function q5WeakHintPosition(
  hints: Partial<Record<VibeFitWeakStructuredHint, boolean>> | undefined,
): number | null {
  if (!hints) return null;

  for (const { hint, position } of Q5_WEAK_HINT_POSITIONS) {
    if (hints[hint]) return position;
  }

  return null;
}

function isQ5VibeKeep(
  signal: VibeFitSignal,
  target: number,
  keepDistance: number,
  minConfidence: number,
): boolean {
  return signal.vibePosition !== null &&
    signal.confidence >= minConfidence &&
    Math.abs(signal.vibePosition - target) <= keepDistance;
}

function isQ5VibeDrop(
  signal: VibeFitSignal,
  target: number,
  dropDistance: number,
  minConfidence: number,
): boolean {
  return signal.vibePosition !== null &&
    signal.confidence >= minConfidence &&
    Math.abs(signal.vibePosition - target) >= dropDistance;
}

function dedupeReceiptCodes(
  receiptCodes: readonly VibeReceiptCode[],
): VibeReceiptCode[] {
  return [...new Set(receiptCodes)];
}

function hasNumericConflict(scores: Record<VibeBandId, number>): boolean {
  const activePositions = VIBE_BAND_IDS
    .filter((bandId) => scores[bandId] > 0)
    .map((bandId) => BAND_POSITIONS.get(bandId) ?? 3);
  if (activePositions.length < 2) return false;
  return Math.max(...activePositions) - Math.min(...activePositions) >=
    VIBE_FIT_CONFIG.conflictDistance;
}

function emptyVibeFitPositionBuckets(): VibeFitPositionBuckets {
  return {
    quiet: 0,
    chill: 0,
    social: 0,
    lively: 0,
    rowdy: 0,
    unknown: 0,
  };
}

function vibeFitPositionBucket(
  vibePosition: number | null,
): VibeFitPositionBucket {
  if (vibePosition === null || !Number.isFinite(vibePosition)) {
    return "unknown";
  }
  const rounded = Math.round(clamp(vibePosition, 1, 5));
  switch (rounded) {
    case 1:
      return "quiet";
    case 2:
      return "chill";
    case 3:
      return "social";
    case 4:
      return "lively";
    case 5:
      return "rowdy";
    default:
      return "unknown";
  }
}

async function voyageEmbeddingAttempt(
  texts: readonly string[],
  deps: {
    apiKey: string;
    fetch: VibeEmbeddingFetch;
    timeoutMs: number;
  },
): Promise<
  | { ok: true; embeddingsByText: Map<string, readonly number[]> }
  | { ok: false; error: VoyageEmbeddingError; transient: boolean }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs);
  let response: Response;
  try {
    response = await deps.fetch(VIBE_FIT_CONFIG.voyageEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${deps.apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        model: VIBE_FIT_CONFIG.voyageModel,
        input: texts,
      }),
      signal: controller.signal,
    });
  } catch (_e) {
    clearTimeout(timeout);
    return { ok: false, error: "timeout", transient: true };
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const transient = response.status === 429 || response.status >= 500;
    const error: VoyageEmbeddingError =
      response.status === 401 || response.status === 403
        ? "invalid_credential"
        : "provider_unavailable";
    return { ok: false, error, transient };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (_e) {
    return { ok: false, error: "bad_response", transient: false };
  }

  const data = isRecord(payload) && Array.isArray(payload.data)
    ? payload.data
    : null;
  if (!data || data.length !== texts.length) {
    return { ok: false, error: "bad_response", transient: false };
  }

  const embeddingsByText = new Map<string, readonly number[]>();
  for (let index = 0; index < texts.length; index += 1) {
    const entry = data[index];
    if (
      !isRecord(entry) ||
      !Array.isArray(entry.embedding) ||
      !entry.embedding.every((value) => typeof value === "number")
    ) {
      return { ok: false, error: "bad_response", transient: false };
    }
    embeddingsByText.set(texts[index], entry.embedding);
  }

  return { ok: true, embeddingsByText };
}

function dedupeTexts(texts: readonly string[]): string[] {
  return [...new Set(texts)];
}

function cosine(
  left: readonly number[],
  right: readonly number[],
): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
