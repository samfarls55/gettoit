import designTokens from "../../../design-system/tokens.json";

type FontWeight = "500" | "600" | "700" | "800" | "900";

const typographyScale = designTokens.typography.scale;

export const mobileTokens = {
  color: {
    ink: designTokens.color.ink,
    paper: designTokens.color.paper,
    sun: designTokens.color.sun,
    textSecondaryOnGradient: designTokens.color.text["on-gradient"].secondary,
  },
  spacing: {
    3: designTokens.spacing["3"],
    4: designTokens.spacing["4"],
    8: designTokens.spacing["8"],
  },
  typography: {
    body: {
      size: typographyScale.body.size,
      weight: String(typographyScale.body.weight) as FontWeight,
      lineHeight: typographyScale.body.size * typographyScale.body["line-height"],
    },
    display: {
      size: typographyScale["display-s"].size,
      weight: String(typographyScale["display-s"].weight) as FontWeight,
      lineHeight: typographyScale["display-s"].size * typographyScale["display-s"]["line-height"],
    },
    eyebrow: {
      size: typographyScale.eyebrow.size,
      weight: String(typographyScale.eyebrow.weight) as FontWeight,
    },
  },
} as const;
