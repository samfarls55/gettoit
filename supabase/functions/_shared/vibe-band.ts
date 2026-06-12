export type VibeBandId = "quiet" | "chill" | "social" | "lively" | "rowdy";

export interface VibeBandDefinition {
  id: VibeBandId;
  visibleLabel: string;
  legacyIndex: number;
  position: number;
}

export const VIBE_BANDS: readonly VibeBandDefinition[] = Object.freeze([
  { id: "quiet", visibleLabel: "QUIET", legacyIndex: 0, position: 1.0 },
  { id: "chill", visibleLabel: "CHILL", legacyIndex: 1, position: 2.0 },
  { id: "social", visibleLabel: "SOCIAL", legacyIndex: 2, position: 3.0 },
  { id: "lively", visibleLabel: "LIVELY", legacyIndex: 3, position: 4.0 },
  { id: "rowdy", visibleLabel: "ROWDY", legacyIndex: 4, position: 5.0 },
]);

const BAND_BY_LEGACY_INDEX = new Map(
  VIBE_BANDS.map((band) => [band.legacyIndex, band]),
);

export function vibeBandFromLegacyIndex(index: number): VibeBandDefinition {
  const band = BAND_BY_LEGACY_INDEX.get(index);
  if (!band) {
    throw new Error(`unknown legacy vibe index: ${index}`);
  }
  return band;
}

export function vibePositionFromLegacyIndex(index: number): number {
  return vibeBandFromLegacyIndex(index).position;
}
