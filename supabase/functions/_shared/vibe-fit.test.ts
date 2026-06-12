import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractVibeEvidenceSpans,
  scoreVibeFitCandidate,
  VIBE_FIT_CONFIG,
} from "./vibe-fit.ts";

Deno.test("TB-03: Vibe anchors are versioned across the five backend bands", () => {
  assertEquals(VIBE_FIT_CONFIG.anchorVersion, "vibe-anchors-v1");
  assertEquals(
    VIBE_FIT_CONFIG.anchors.map((anchor) => ({
      id: anchor.bandId,
      position: anchor.position,
    })),
    [
      { id: "quiet", position: 1 },
      { id: "chill", position: 2 },
      { id: "social", position: 3 },
      { id: "lively", position: 4 },
      { id: "rowdy", position: 5 },
    ],
  );
});

Deno.test("TB-03: span assembly selects source spans and excludes non-vibe facts", () => {
  const spans = extractVibeEvidenceSpans({
    sourceTexts: [
      {
        priority: 1,
        text:
          "Quiet corner booths make conversation easy. The steakhouse serves seafood towers, offers takeout, has gluten-free pasta, is expensive, highly rated, and popular.",
      },
    ],
  });

  assertEquals(spans.map((span) => span.text), [
    "Quiet corner booths make conversation easy",
  ]);
});

Deno.test("TB-03: span assembly handles simple negation without confident keyword inversion", () => {
  const spans = extractVibeEvidenceSpans({
    sourceTexts: [
      {
        priority: 1,
        text:
          "Not loud, not too crowded, and not quiet after 10pm, with a lively bar at dinner.",
      },
    ],
    mealTimeContext: "dinner",
  });

  assertEquals(spans.map((span) => span.text), [
    "Not loud",
    "not too crowded",
    "not quiet after 10pm",
    "with a lively bar at dinner",
  ]);
  assert(spans.some((span) => span.negatedBandId === "rowdy"));
  assert(spans.some((span) => span.negatedBandId === "quiet"));
  assert(spans.some((span) => span.mealTimeRelevant));
});

Deno.test("TB-03: span assembly caps deterministic evidence at five spans", () => {
  const spans = extractVibeEvidenceSpans({
    sourceTexts: [
      {
        priority: 2,
        text:
          "Energetic room. Quiet patio. Cozy booths. Buzzy bar. Rowdy late night. Relaxed lounge. Social dining room.",
      },
    ],
  });

  assertEquals(spans.map((span) => span.text), [
    "Energetic room",
    "Quiet patio",
    "Cozy booths",
    "Buzzy bar",
    "Rowdy late night",
  ]);
});

Deno.test("TB-03: projection maps synthetic atmosphere fixtures across all five bands", () => {
  const fixtures = [
    ["Quiet booths where conversation is easy", 1],
    ["Mellow cozy lounge with relaxed booths", 2],
    ["Casual social dining room with balanced energy", 3],
    ["Buzzy lively energetic room at dinner", 4],
    ["Loud packed high-energy late-night party room", 5],
  ] as const;

  for (const [text, expectedPosition] of fixtures) {
    const signal = scoreVibeFitCandidate({
      candidateId: `fixture-${expectedPosition}`,
      sourceTexts: [{ priority: 1, text }],
      embeddingMode: "fake",
    });

    assert(signal.vibePosition !== null);
    assertAlmostEquals(signal.vibePosition, expectedPosition, 0.35);
    assert(signal.confidence >= 0.58, `${text}: ${signal.confidence}`);
  }
});

Deno.test("TB-03: synonym-heavy descriptors project semantically with fake embeddings", () => {
  const signal = scoreVibeFitCandidate({
    candidateId: "synonyms",
    sourceTexts: [
      {
        priority: 1,
        text:
          "Intimate date-night room with mellow candlelit energy and calm conversation.",
      },
    ],
    embeddingMode: "fake",
  });

  assert(signal.vibePosition !== null);
  assert(signal.vibePosition > 1.2);
  assert(signal.vibePosition < 2.4);
  assert(signal.confidence >= 0.6);
});

Deno.test("TB-03: type food service quality and crowd-only text stays neutral", () => {
  const signal = scoreVibeFitCandidate({
    candidateId: "neutral",
    sourceTexts: [
      {
        priority: 1,
        text:
          "Italian restaurant with pizza, counter service, takeout, vegan options, cheap lunch specials, excellent reviews, and a 4.8 rating.",
      },
    ],
    embeddingMode: "fake",
  });

  assertEquals(signal.vibePosition, null);
  assertEquals(signal.confidence, 0);
  assertEquals(signal.receiptCodes, [
    "vibe_no_evidence",
    "vibe_low_confidence",
  ]);
});

Deno.test("TB-03: mixed quiet and rowdy evidence lowers confidence and records conflict", () => {
  const signal = scoreVibeFitCandidate({
    candidateId: "conflict",
    sourceTexts: [
      {
        priority: 1,
        text:
          "Quiet intimate booths up front. Loud packed party bar after dinner.",
      },
    ],
    mealTimeContext: "dinner",
    embeddingMode: "fake",
  });

  assert(signal.vibePosition !== null);
  assert(signal.vibePosition > 2.4);
  assert(signal.vibePosition < 4.1);
  assert(signal.confidence < 0.58);
  assert(signal.receiptCodes.includes("vibe_conflicting_evidence"));
  assert(signal.receiptCodes.includes("vibe_mealtime_weighted"));
});

Deno.test("TB-03: complex negation and sarcasm lower confidence instead of producing high confidence", () => {
  const signal = scoreVibeFitCandidate({
    candidateId: "ambiguous",
    sourceTexts: [
      {
        priority: 1,
        text:
          "Not exactly quiet if you enjoy shouting over the room; somehow 'relaxing' during the packed rush.",
      },
    ],
    embeddingMode: "fake",
  });

  assert(signal.confidence < 0.45);
  assert(signal.receiptCodes.includes("vibe_low_confidence"));
});
