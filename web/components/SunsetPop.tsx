// GetToIt web — Sunset Pop component port.
//
// Re-implementation of `design-system/code/components.jsx` for the web
// fallback. Per ADR 0003 §"Design-system relationship" we MUST NOT
// import from `design-system/code/components.jsx` — that JSX is the
// spec, not production source. This file is a 1:1 port to React + TS
// with all hex codes either threaded through the design-system tokens
// (CSS custom properties from `design-system/code/tokens.css`, loaded
// in `app/layout.tsx`) or registered in `tokens.json` so the
// `verify.mjs` orphan-hex sweep stays clean.

"use client";

import { type CSSProperties, type ReactNode } from "react";

// ── The 4-stop gradient map. Mirrors `GTI_GRADIENTS` in components.jsx ──
//
// These hex values are registered in `design-system/tokens.json`
// under `gradient.surfaces.<stop>`. They live here too because the
// web build does not import from `design-system/code/` per ADR 0003.
// Drift is gated by `verify.mjs` — every hex below must be present in
// tokens.json or the sweep fails.
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

// Avatar colors. Mirrors `color.member-identity` in tokens.json.
// The "self" color is the `--sun` token; the other three are the
// rotating identity palette.
export const MEMBER_COLORS = ["#FFD23F", "#7DDFB5", "#FF8DA1", "#9BC0FF"] as const;

export function GradientSurface({
  stop,
  children,
}: {
  stop: GradientStop;
  children: ReactNode;
}) {
  const [g1, g2, g3, g4] = GTI_GRADIENTS[stop] ?? GTI_GRADIENTS.initiator;
  const style: CSSProperties = {
    // CSS custom properties for the gradient stops. Picked up by the
    // `.gti-gradient` rule in `design-system/code/tokens.css` which
    // animates the transition between surfaces (hue shift on advance).
    ["--g1" as string]: g1,
    ["--g2" as string]: g2,
    ["--g3" as string]: g3,
    ["--g4" as string]: g4,
    position: "absolute",
    inset: 0,
    overflow: "hidden",
  };
  return (
    <div style={style} data-testid={`gradient-surface-${stop}`}>
      <div className="gti-gradient" />
      <div className="gti-grain" />
      {children}
    </div>
  );
}

export function TopBar({
  step = 0,
  total = 5,
  onClose,
}: {
  step?: number;
  total?: number;
  onClose?: () => void;
}) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 3,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 22px",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close session"
        style={{
          appearance: "none",
          border: 0,
          background: "transparent",
          color: "var(--paper)",
          padding: 4,
          cursor: "pointer",
          fontFamily: "var(--ff-body)",
          fontWeight: 800,
          fontSize: 22,
          lineHeight: 1,
          opacity: 0.85,
        }}
      >
        ×
      </button>
      <div style={{ flex: 1, display: "flex", gap: 5, alignItems: "center" }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              background:
                i < step ? "var(--paper)" : "rgba(255,255,255,0.32)",
              transition: "background 300ms var(--ease-out)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function QuestionHeader({
  index,
  total,
  title,
  sub,
}: {
  index: number;
  total: number;
  title: string;
  sub?: string;
}) {
  return (
    <div style={{ padding: "0 22px", color: "var(--paper)" }}>
      <div className="gti-eyebrow" style={{ opacity: 0.78, marginBottom: 10 }}>
        Q{index} of {total}
      </div>
      <h1
        className="gti-display"
        style={{
          fontSize: 38,
          margin: "0 0 10px",
          textWrap: "balance",
        }}
      >
        {title}
      </h1>
      {sub ? (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "rgba(255,255,255,0.78)",
            letterSpacing: 0.1,
          }}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

export function Chip({
  label,
  selected,
  onClick,
  style,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    appearance: "none",
    fontFamily: "var(--ff-body)",
    fontSize: 15,
    fontWeight: 700,
    padding: "14px 22px",
    borderRadius: 999,
    cursor: "pointer",
    transition: "all 180ms var(--ease-out)",
    minHeight: 48,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    ...style,
  };
  if (selected) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed="true"
        style={{
          ...base,
          background: "var(--sun)",
          color: "var(--ink)",
          border: "1.5px solid transparent",
          boxShadow:
            "0 8px 22px rgba(255,210,63,0.35), 0 0 0 4px rgba(255,210,63,0.18), inset 0 1px 0 rgba(255,255,255,0.5)",
          transform: "scale(1.02)",
        }}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed="false"
      style={{
        ...base,
        background: "rgba(255,255,255,0.04)",
        color: "var(--paper)",
        border: "1.5px solid rgba(255,255,255,0.55)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      {label}
    </button>
  );
}

export type PillFill = "white" | "sun" | "ink" | "ghost";

export function PillCTA({
  label,
  fill = "white",
  onClick,
  disabled,
  style,
  prefix,
  type = "button",
}: {
  label: string;
  fill?: PillFill;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  prefix?: ReactNode;
  type?: "button" | "submit";
}) {
  const fills: Record<PillFill, { bg: string; fg: string }> = {
    white: { bg: "var(--paper)", fg: "var(--ink)" },
    sun: { bg: "var(--sun)", fg: "var(--ink)" },
    ink: { bg: "var(--ink)", fg: "var(--paper)" },
    ghost: { bg: "transparent", fg: "var(--paper)" },
  };
  const { bg, fg } = fills[fill];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: "none",
        border: 0,
        width: "100%",
        height: 60,
        borderRadius: 999,
        background: bg,
        color: fg,
        fontFamily: "var(--ff-body)",
        fontWeight: 900,
        fontSize: 14,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        boxShadow:
          fill === "sun"
            ? "0 12px 32px rgba(255,210,63,0.4), inset 0 1px 0 rgba(255,255,255,0.45)"
            : fill === "ghost"
              ? "inset 0 0 0 1.5px rgba(255,255,255,0.55)"
              : "0 12px 32px rgba(0,0,0,0.18)",
        transition: "transform 140ms var(--ease-out), opacity 200ms",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        ...style,
      }}
    >
      {prefix}
      {label}
    </button>
  );
}

export function ReceiptChip({
  name,
  action,
  delay = 0,
  style,
}: {
  name: string;
  action: string;
  delay?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 5,
        padding: "7px 13px 8px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.18)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        border: "0.75px solid rgba(255,255,255,0.32)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 10px rgba(0,0,0,0.08)",
        animation: `gti-stagger-in 480ms var(--ease-out-soft) ${delay}ms both`,
        ...style,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "var(--paper)",
          letterSpacing: 0.1,
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "rgba(255,255,255,0.82)",
          letterSpacing: 0.1,
        }}
      >
        {action}
      </span>
    </div>
  );
}

export function AvatarDot({
  name,
  color,
  answered,
  size = 36,
}: {
  name: string;
  color: string;
  answered?: boolean;
  size?: number;
}) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "var(--ink)",
        fontFamily: "var(--ff-body)",
        fontWeight: 900,
        fontSize: size * 0.42,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        boxShadow: answered
          ? "0 0 0 2.5px rgba(255,255,255,0.85), 0 8px 22px rgba(0,0,0,0.18)"
          : "inset 0 0 0 1px rgba(255,255,255,0.25)",
        opacity: answered ? 1 : 0.55,
        filter: answered ? "none" : "grayscale(0.5)",
        transition: "all 320ms var(--ease-out)",
      }}
    >
      {initial}
      {answered ? (
        <div
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "var(--sun)",
            border: "2px solid var(--paper)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            color: "var(--ink)",
            fontWeight: 900,
          }}
        >
          ✓
        </div>
      ) : null}
    </div>
  );
}

export function CTADock({
  children,
  gap = 14,
}: {
  children: ReactNode;
  gap?: number;
}) {
  return (
    <div
      style={{
        marginTop: "auto",
        padding: "0 22px 18px",
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      {children}
    </div>
  );
}

export function Eyebrow({
  children,
  style,
  opacity = 0.78,
}: {
  children: ReactNode;
  style?: CSSProperties;
  opacity?: number;
}) {
  return (
    <div
      className="gti-eyebrow"
      style={{ color: "var(--paper)", opacity, ...style }}
    >
      {children}
    </div>
  );
}

export function Glass({
  children,
  style,
  soft = false,
}: {
  children: ReactNode;
  style?: CSSProperties;
  soft?: boolean;
}) {
  return (
    <div
      style={{
        background: soft
          ? "rgba(255,255,255,0.10)"
          : "rgba(255,255,255,0.18)",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        border: "0.75px solid rgba(255,255,255,0.32)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
        borderRadius: "var(--r-card)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function GTIMark({ size = 18 }: { size?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "var(--paper)",
        fontFamily: "var(--ff-body)",
      }}
    >
      <div
        style={{
          width: size * 0.9,
          height: size * 0.9,
          borderRadius: 5,
          background: "var(--sun)",
          color: "var(--ink)",
          fontWeight: 900,
          fontSize: size * 0.55,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(255,210,63,0.4)",
        }}
      >
        g
      </div>
      <span
        style={{ fontWeight: 800, fontSize: size * 0.78, letterSpacing: 0.6 }}
      >
        GetToIt
      </span>
    </div>
  );
}
