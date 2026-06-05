import designTokens from "./tokens.snapshot.json";
import type { TextStyle } from "react-native";

type FontWeight = NonNullable<TextStyle["fontWeight"]>;

const typographyScale = designTokens.typography.scale;
const bodyTypography = typographyScale.body;
const displayTypography = typographyScale["display-s"];
const eyebrowTypography = typographyScale.eyebrow;

const toFontWeight = (weight: number): FontWeight => {
  switch (weight) {
    case 100:
      return "100";
    case 200:
      return "200";
    case 300:
      return "300";
    case 400:
      return "400";
    case 500:
      return "500";
    case 600:
      return "600";
    case 700:
      return "700";
    case 800:
      return "800";
    case 900:
      return "900";
    default:
      throw new Error(`Unsupported mobile font weight: ${weight}`);
  }
};

const lineHeightFor = (typography: { size: number; "line-height": number }) =>
  typography.size * typography["line-height"];

export const mobileTokens = {
  color: {
    ink: designTokens.color.ink,
    paper: designTokens.color.paper,
    sun: designTokens.color.sun,
    glassStroke: designTokens.color.glass.stroke,
    textSecondaryOnGradient: designTokens.color.text["on-gradient"].secondary,
    textTertiaryOnGradient: designTokens.color.text["on-gradient"].tertiary,
  },
  spacing: {
    3: designTokens.spacing["3"],
    4: designTokens.spacing["4"],
    8: designTokens.spacing["8"],
  },
  typography: {
    body: {
      size: bodyTypography.size,
      weight: toFontWeight(bodyTypography.weight),
      lineHeight: lineHeightFor(bodyTypography),
    },
    display: {
      size: displayTypography.size,
      weight: toFontWeight(displayTypography.weight),
      lineHeight: lineHeightFor(displayTypography),
    },
    eyebrow: {
      size: eyebrowTypography.size,
      weight: toFontWeight(eyebrowTypography.weight),
    },
  },
} as const;
