import designTokens from "./tokens.snapshot.json";
import type { TextStyle } from "react-native";

type FontWeight = NonNullable<TextStyle["fontWeight"]>;

const typographyScale = designTokens.typography.scale;
const bodyTypography = typographyScale.body;
const displayTypography = typographyScale["display-s"];
const eyebrowTypography = typographyScale.eyebrow;
const headlineTypography = typographyScale.headline;
const titleTypography = typographyScale.title;

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
    surface: designTokens.color.surface,
    surfaceContainerLow: designTokens.color["surface-container-low"],
    surfaceContainer: designTokens.color["surface-container"],
    surfaceContainerHigh: designTokens.color["surface-container-high"],
    surfaceContainerHighest: designTokens.color["surface-container-highest"],
    paper: designTokens.color.paper,
    sun: designTokens.color.sun,
    gold: designTokens.color.gold,
    copper: designTokens.color.copper,
    outline: designTokens.color.outline,
    divider: designTokens.color.divider,
    glow: designTokens.color.glow,
    danger: designTokens.color.danger,
    glassStroke: designTokens.color.glass.stroke,
    glassTop: designTokens.color.glass.top,
    textSecondaryOnGradient: designTokens.color.text["on-gradient"].secondary,
    textTertiaryOnGradient: designTokens.color.text["on-gradient"].tertiary,
  },
  spacing: {
    2: designTokens.spacing["2"],
    3: designTokens.spacing["3"],
    4: designTokens.spacing["4"],
    5: designTokens.spacing["5"],
    6: designTokens.spacing["6"],
    8: designTokens.spacing["8"],
    10: designTokens.spacing["10"],
    12: designTokens.spacing["12"],
  },
  radius: {
    sm: designTokens.radius.sm,
    default: designTokens.radius.default,
    md: designTokens.radius.md,
    lg: designTokens.radius.lg,
    xl: designTokens.radius.xl,
    full: designTokens.radius.full,
  },
  typography: {
    family: designTokens.typography.family,
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
    headline: {
      size: headlineTypography.size,
      weight: toFontWeight(headlineTypography.weight),
      lineHeight: lineHeightFor(headlineTypography),
    },
    title: {
      size: titleTypography.size,
      weight: toFontWeight(titleTypography.weight),
      lineHeight: lineHeightFor(titleTypography),
    },
    eyebrow: {
      size: eyebrowTypography.size,
      weight: toFontWeight(eyebrowTypography.weight),
    },
  },
} as const;
