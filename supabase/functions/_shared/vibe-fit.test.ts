import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildVibeFitCandidate,
  embedTextsWithVoyage,
  extractVibeEvidenceSpans,
  scoreVibeFitCandidate,
  scoreVibeFitCandidateFlow,
  selectQ5VibeKeepDropCandidates,
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
    summaryTexts: [
      {
        source: "reviewSummary",
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
    summaryTexts: [
      {
        source: "reviewSummary",
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
    summaryTexts: [
      {
        source: "reviewSummary",
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
      summaryTexts: [{ source: "reviewSummary", priority: 1, text }],
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
    summaryTexts: [
      {
        source: "reviewSummary",
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
    summaryTexts: [
      {
        source: "reviewSummary",
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
    summaryTexts: [
      {
        source: "reviewSummary",
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
    summaryTexts: [
      {
        source: "reviewSummary",
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

Deno.test("TB-04: VibeFitCandidate DTO carries only approved summary text and weak hints", () => {
  const dtoInput = {
    candidateId: "candidate-1",
    googlePlaceId: "google-1",
    reviewSummary: "Quiet booths and mellow dinner energy.",
    generativeSummary: "A cozy room for easy conversation.",
    weakStructuredHints: {
      liveMusic: true,
      goodForGroups: true,
      goodForWatchingSports: false,
      outdoorSeating: true,
      priceLevel: true,
    },
    embeddingMode: "fake" as const,
    displayName: "Must Not Be In DTO",
  };
  const candidate = buildVibeFitCandidate(dtoInput);

  assertEquals(candidate.summaryTexts.map((source) => source.source), [
    "reviewSummary",
    "generativeSummary",
  ]);
  assertEquals(candidate.weakStructuredHints, {
    liveMusic: true,
    goodForGroups: true,
    goodForWatchingSports: false,
    outdoorSeating: true,
  });

  const serialized = JSON.stringify(candidate);
  for (
    const forbidden of [
      "displayName",
      "formattedAddress",
      "priceLevel",
      "rating",
      "types",
      "reviews",
      "editorialSummary",
      "neighborhoodSummary",
    ]
  ) {
    assertEquals(serialized.includes(forbidden), false, forbidden);
  }
});
Deno.test("TB-05: disabled embeddings skip Voyage and degrade to neutral low confidence", async () => {
  let fetchCalls = 0;
  const signals = await scoreVibeFitCandidateFlow(
    [
      {
        candidateId: "disabled",
        summaryTexts: [{
          source: "reviewSummary",
          priority: 1,
          text: "Quiet calm room for conversation.",
        }],
      },
    ],
    {
      env: { VOYAGE_API_KEY: "secret", VIBE_EMBEDDINGS_ENABLED: "false" },
      budget: { maxTextsPerFlow: 100 },
      fetch: () => {
        fetchCalls += 1;
        return Promise.resolve(new Response("{}"));
      },
    },
  );

  assertEquals(fetchCalls, 0);
  assertEquals(signals[0].vibePosition, 3);
  assertEquals(signals[0].confidence, 0);
  assertEquals(signals[0].receiptCodes, [
    "vibe_embeddings_disabled",
    "vibe_low_confidence",
  ]);
});

Deno.test("TB-05: Voyage wrapper batches voyage-4-lite inputs and dedupes within one flow", async () => {
  const requestedInputs: string[][] = [];
  const signals = await scoreVibeFitCandidateFlow(
    [
      {
        candidateId: "a",
        summaryTexts: [{
          source: "reviewSummary",
          priority: 1,
          text: "Quiet calm room for conversation.",
        }],
      },
      {
        candidateId: "b",
        summaryTexts: [{
          source: "reviewSummary",
          priority: 1,
          text: "Quiet calm room for conversation.",
        }],
      },
    ],
    {
      env: { VOYAGE_API_KEY: "secret", VIBE_EMBEDDINGS_ENABLED: "true" },
      budget: { maxTextsPerFlow: 100 },
      fetch: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as {
          model: string;
          input: string[];
        };
        requestedInputs.push(body.input);
        assertEquals(body.model, "voyage-4-lite");
        assertEquals(
          (init?.headers as Record<string, string>)["Authorization"],
          "Bearer secret",
        );
        return Promise.resolve(jsonEmbeddingResponse(body.input));
      },
    },
  );

  assertEquals(requestedInputs.length, 1);
  assertEquals(
    requestedInputs[0].filter((text) =>
      text === "Quiet calm room for conversation"
    ).length,
    1,
  );
  assertEquals(new Set(requestedInputs[0]).size, requestedInputs[0].length);
  assert(signals.every((signal) => signal.confidence > 0));
});

Deno.test("TB-05: Voyage wrapper allows one bounded transient retry for a flow", async () => {
  let calls = 0;
  const result = await embedTextsWithVoyage(["quiet", "lively"], {
    env: { VOYAGE_API_KEY: "secret" },
    budget: { maxTextsPerFlow: 4 },
    fetch: (_url, init) => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve(new Response("rate", { status: 429 }));
      }
      const body = JSON.parse(String(init?.body)) as { input: string[] };
      return Promise.resolve(jsonEmbeddingResponse(body.input));
    },
  });

  assertEquals(calls, 2);
  assert(result.ok);
});

Deno.test("TB-05: Voyage wrapper does not retry when retry would exceed budget", async () => {
  let calls = 0;
  const result = await embedTextsWithVoyage(["quiet", "lively"], {
    env: { VOYAGE_API_KEY: "secret" },
    budget: { maxTextsPerFlow: 2 },
    fetch: () => {
      calls += 1;
      return Promise.resolve(new Response("rate", { status: 429 }));
    },
  });

  assertEquals(calls, 1);
  assertEquals(result, { ok: false, error: "provider_unavailable" });
});

Deno.test("TB-05: Voyage wrapper enforces a short per-flow timeout", async () => {
  let sawAbortSignal = false;
  const result = await embedTextsWithVoyage(["quiet"], {
    env: { VOYAGE_API_KEY: "secret" },
    timeoutMs: 1,
    budget: { maxTextsPerFlow: 1 },
    fetch: (_url, init) => {
      const signal = init?.signal;
      sawAbortSignal = signal instanceof AbortSignal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    },
  });

  assert(sawAbortSignal);
  assertEquals(result, { ok: false, error: "timeout" });
});

Deno.test("TB-05: budget exhaustion skips Voyage and returns controlled receipts", async () => {
  let fetchCalls = 0;
  const signals = await scoreVibeFitCandidateFlow(
    [
      {
        candidateId: "budget",
        summaryTexts: [{
          source: "reviewSummary",
          priority: 1,
          text: "Buzzy lively energetic room.",
        }],
      },
    ],
    {
      env: { VOYAGE_API_KEY: "secret", VIBE_EMBEDDINGS_ENABLED: "true" },
      budget: { maxTextsPerFlow: 1 },
      fetch: () => {
        fetchCalls += 1;
        return Promise.resolve(new Response("{}"));
      },
    },
  );

  assertEquals(fetchCalls, 0);
  assertEquals(signals[0].vibePosition, 3);
  assertEquals(signals[0].receiptCodes, [
    "vibe_embedding_budget_exhausted",
    "vibe_low_confidence",
  ]);
});

Deno.test("TB-05: provider failures degrade without leaking text vectors or API key", async () => {
  const secret = "secret-token";
  const result = await embedTextsWithVoyage(["Quiet private room"], {
    env: { VOYAGE_API_KEY: secret },
    budget: { maxTextsPerFlow: 2 },
    fetch: () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: "Quiet private room failed",
            embedding: [0.1, 0.2],
            key: secret,
          }),
          { status: 500 },
        ),
      ),
  });

  assertEquals(result, { ok: false, error: "provider_unavailable" });
  assertEquals(JSON.stringify(result).includes("Quiet private room"), false);
  assertEquals(JSON.stringify(result).includes(secret), false);
  assertEquals(JSON.stringify(result).includes("0.1"), false);
});

Deno.test("TB-06: Q5 vibe selection chooses high-confidence keep/drop contrast", async () => {
  const result = await selectQ5VibeKeepDropCandidates(
    {
      targetVibePosition: 2,
      candidates: [
        q5VibeCandidate("keep", "Mellow cozy lounge with relaxed booths."),
        q5VibeCandidate("drop", "Buzzy lively energetic room at dinner."),
      ],
    },
    {
      env: { VOYAGE_API_KEY: "secret", VIBE_EMBEDDINGS_ENABLED: "true" },
      budget: { maxTextsPerFlow: 100 },
      fetch: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { input: string[] };
        return Promise.resolve(jsonEmbeddingResponse(body.input));
      },
    },
  );

  assertEquals(result.kind, "selected");
  if (result.kind === "selected") {
    assertEquals(result.keepCandidateId, "keep");
    assertEquals(result.dropCandidateId, "drop");
    assert(result.receiptCodes.includes("selected_vibe_high_confidence_keep"));
    assert(result.receiptCodes.includes("selected_vibe_high_confidence_drop"));
  }
});

Deno.test("TB-06: Q5 vibe selection relaxes confidence before contrast", async () => {
  const confidenceRelaxed = await selectQ5VibeKeepDropCandidates(
    {
      targetVibePosition: 2,
      candidates: [
        q5VibeCandidate(
          "weak-keep",
          "Kind of mellow cozy lounge with relaxed booths.",
        ),
        q5VibeCandidate("drop", "Buzzy lively energetic room at dinner."),
      ],
    },
    {
      env: { VOYAGE_API_KEY: "secret", VIBE_EMBEDDINGS_ENABLED: "true" },
      budget: { maxTextsPerFlow: 100 },
      fetch: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { input: string[] };
        return Promise.resolve(jsonEmbeddingResponse(body.input));
      },
    },
  );

  assertEquals(confidenceRelaxed.kind, "selected");
  if (confidenceRelaxed.kind === "selected") {
    assertEquals(confidenceRelaxed.keepCandidateId, "weak-keep");
    assertEquals(
      confidenceRelaxed.receiptCodes.includes(
        "selected_vibe_low_confidence_relaxed",
      ),
      true,
    );
    assertEquals(
      confidenceRelaxed.receiptCodes.includes("selected_vibe_contrast_relaxed"),
      false,
    );
  }

  const contrastRelaxed = await selectQ5VibeKeepDropCandidates(
    {
      targetVibePosition: 2,
      candidates: [
        q5VibeCandidate("keep", "Mellow cozy lounge with relaxed booths."),
        q5VibeCandidate(
          "near-drop",
          "Casual social dining room with balanced energy.",
        ),
      ],
    },
    {
      env: { VOYAGE_API_KEY: "secret", VIBE_EMBEDDINGS_ENABLED: "true" },
      budget: { maxTextsPerFlow: 100 },
      fetch: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { input: string[] };
        return Promise.resolve(jsonEmbeddingResponse(body.input));
      },
    },
  );

  assertEquals(contrastRelaxed.kind, "selected");
  if (contrastRelaxed.kind === "selected") {
    assertEquals(contrastRelaxed.dropCandidateId, "near-drop");
    assertEquals(
      contrastRelaxed.receiptCodes.includes(
        "selected_vibe_low_confidence_relaxed",
      ),
      false,
    );
    assertEquals(
      contrastRelaxed.receiptCodes.includes("selected_vibe_contrast_relaxed"),
      true,
    );
  }
});

Deno.test("TB-06: Q5 disabled embeddings can preserve vibe-axis shape with weak hints", async () => {
  let fetchCalls = 0;
  const result = await selectQ5VibeKeepDropCandidates(
    {
      targetVibePosition: 3,
      candidates: [
        q5VibeCandidate("neutral-keep", "Comfortable social room.", {}),
        q5VibeCandidate("hint-drop", "", { liveMusic: true }),
      ],
    },
    {
      env: { VOYAGE_API_KEY: "secret", VIBE_EMBEDDINGS_ENABLED: "false" },
      budget: { maxTextsPerFlow: 100 },
      fetch: () => {
        fetchCalls += 1;
        return Promise.resolve(new Response("{}"));
      },
    },
  );

  assertEquals(fetchCalls, 0);
  assertEquals(result.kind, "selected");
  if (result.kind === "selected") {
    assertEquals(result.keepCandidateId, "neutral-keep");
    assertEquals(result.dropCandidateId, "hint-drop");
    assert(result.receiptCodes.includes("vibe_embeddings_disabled"));
    assert(
      result.receiptCodes.includes("selected_vibe_low_confidence_relaxed"),
    );
  }
});

Deno.test("TB-06: Q5 provider failure fails cleanly when no useful vibe card can be formed", async () => {
  const result = await selectQ5VibeKeepDropCandidates(
    {
      targetVibePosition: 2,
      candidates: [
        q5VibeCandidate("one", "Mellow cozy lounge with relaxed booths."),
        q5VibeCandidate("two", "Buzzy lively energetic room at dinner."),
      ],
    },
    {
      env: { VOYAGE_API_KEY: "secret", VIBE_EMBEDDINGS_ENABLED: "true" },
      budget: { maxTextsPerFlow: 100 },
      fetch: () => Promise.resolve(new Response("nope", { status: 500 })),
    },
  );

  assertEquals(result.kind, "no-results");
  assert(result.receiptCodes.includes("vibe_embedding_unavailable"));
});

Deno.test("TB-06: Q5 vibe selection response does not expose summaries or embeddings", async () => {
  const result = await selectQ5VibeKeepDropCandidates(
    {
      targetVibePosition: 2,
      candidates: [
        q5VibeCandidate("keep", "Mellow cozy lounge with relaxed booths."),
        q5VibeCandidate("drop", "Buzzy lively energetic room at dinner."),
      ],
    },
    {
      env: { VOYAGE_API_KEY: "secret", VIBE_EMBEDDINGS_ENABLED: "true" },
      budget: { maxTextsPerFlow: 100 },
      fetch: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { input: string[] };
        return Promise.resolve(jsonEmbeddingResponse(body.input));
      },
    },
  );

  const serialized = JSON.stringify(result);
  for (
    const forbidden of [
      "Mellow cozy lounge",
      "Buzzy lively",
      "embedding",
      "vibePosition",
      "secret",
    ]
  ) {
    assertEquals(serialized.includes(forbidden), false, forbidden);
  }
});

function q5VibeCandidate(
  candidateId: string,
  reviewSummary: string,
  weakStructuredHints: Record<string, boolean> = {},
) {
  return buildVibeFitCandidate({
    candidateId,
    reviewSummary,
    weakStructuredHints,
  });
}

function jsonEmbeddingResponse(texts: readonly string[]): Response {
  return new Response(
    JSON.stringify({
      data: texts.map((text) => ({ embedding: fakeVoyageEmbedding(text) })),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function fakeVoyageEmbedding(text: string): number[] {
  const lower = text.toLowerCase();
  if (/\b(quiet|calm|peaceful|conversation|intimate)\b/.test(lower)) {
    return [1, 0, 0, 0, 0];
  }
  if (/\b(chill|mellow|cozy|relaxed|date-night|laid-back)\b/.test(lower)) {
    return [0, 1, 0, 0, 0];
  }
  if (
    /\b(social|balanced|casual|convivial|comfortable|group-friendly)\b/.test(
      lower,
    )
  ) {
    return [0, 0, 1, 0, 0];
  }
  if (/\b(lively|buzzy|energetic|upbeat|animated|busy)\b/.test(lower)) {
    return [0, 0, 0, 1, 0];
  }
  if (/\b(rowdy|loud|packed|high-energy|party|hard to hear)\b/.test(lower)) {
    return [0, 0, 0, 0, 1];
  }
  return [0, 0, 1, 0, 0];
}
