import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  VIBE_BANDS,
  vibeBandFromLegacyIndex,
  vibePositionFromLegacyIndex,
} from "./vibe-band.ts";

Deno.test("TB-02: Vibe bands map visible labels to stable ids and 1..5 positions", () => {
  assertEquals(
    VIBE_BANDS.map((band) => ({
      id: band.id,
      label: band.visibleLabel,
      legacyIndex: band.legacyIndex,
      position: band.position,
    })),
    [
      { id: "quiet", label: "QUIET", legacyIndex: 0, position: 1 },
      { id: "chill", label: "CHILL", legacyIndex: 1, position: 2 },
      { id: "social", label: "SOCIAL", legacyIndex: 2, position: 3 },
      { id: "lively", label: "LIVELY", legacyIndex: 3, position: 4 },
      { id: "rowdy", label: "ROWDY", legacyIndex: 4, position: 5 },
    ],
  );
});

Deno.test("TB-02: legacy 0..4 vibe values adapt only at the module boundary", () => {
  assertEquals(vibeBandFromLegacyIndex(0).id, "quiet");
  assertEquals(vibeBandFromLegacyIndex(4).id, "rowdy");
  assertEquals(vibePositionFromLegacyIndex(2), 3);
  assertThrows(() => vibeBandFromLegacyIndex(5), Error, "unknown legacy vibe index");
});
