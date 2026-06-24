// GetToIt web - Sunset Pop shared visual data.

// The 4-stop gradient map. These values mirror tokens.json and are
// checked by verify.mjs.
export const GTI_GRADIENTS: Record<string, [string, string, string, string]> = {
  initiator: ["#FF8868", "#FF9F6B", "#FFB855", "#FFD23F"],
  q1: ["#FF6B5E", "#FF8A5F", "#FFB256", "#FFD23F"],
  q2: ["#FF5878", "#FF7A66", "#FFA15A", "#FFC75A"],
  q3: ["#E04F8B", "#B855B0", "#8A5BD0", "#6E63E0"],
  q4: ["#2F3380", "#3F47A6", "#5E59C9", "#7C68E4"],
  q5: ["#0E1450", "#181B5E", "#252A6E", "#363B82"],
  waiting: ["#1B1F66", "#2A2A7C", "#4A3F9F", "#7256C4"],
  verdict: ["#FFC548", "#FF8A5A", "#C24F7E", "#2A2068"],
  checkin: ["#FFDB6B", "#FFA86D", "#FF7F88", "#9F4C9F"],
  midnight: ["#0A0B1A", "#10112A", "#161836", "#1F2244"],
};

export type GradientStop = keyof typeof GTI_GRADIENTS;

// The "self" color is the sun token; the rest are member identity colors.
export const MEMBER_COLORS = ["#FFD23F", "#7DDFB5", "#FF8DA1", "#9BC0FF"] as const;
