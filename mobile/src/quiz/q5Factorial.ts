export type Q5Axis = "cuisine" | "crowd_approval" | "vibe";

export type Q5Candidate = {
  id: string;
  name: string;
  meta: string;
  attributionText?: string;
  droppedAxis: Q5Axis;
};
