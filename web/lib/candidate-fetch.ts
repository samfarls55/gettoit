import type {
  Axis,
  Q5Rating,
} from "../../supabase/functions/_shared/votes-wire";

const ALL_AXES: readonly Axis[] = ["cuisine", "crowd_approval", "vibe"];

export interface QuizCandidate {
  id: string;
  name: string;
  meta: string;
  attributionText?: string;
  droppedAxis: Axis;
}

export function seedRatings(
  candidates: ReadonlyArray<QuizCandidate>,
): Record<string, number> {
  return Object.fromEntries(candidates.map((candidate) => [candidate.id, 3]));
}

export function buildQ5Ratings(
  candidates: ReadonlyArray<QuizCandidate>,
  ratings: Record<string, number>,
): Q5Rating[] {
  return candidates.map((candidate, index) => ({
    droppedAxis: candidate.droppedAxis ?? ALL_AXES[index % ALL_AXES.length],
    score: ratings[candidate.id] ?? 3,
  }));
}
