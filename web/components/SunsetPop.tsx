// GetToIt web - Sunset Pop component primitives.

"use client";

import Link from "next/link";
import { type CSSProperties, type ReactNode } from "react";
import { GTI_GRADIENTS, type GradientStop } from "./sunset-pop-data";

const topBarStyle: CSSProperties = {
  position: "relative",
  zIndex: 3,
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "0 22px",
};

const topBarCloseStyle: CSSProperties = {
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
};

const topBarLeaveStyle: CSSProperties = {
  ...topBarCloseStyle,
  fontWeight: 700,
  fontSize: "var(--fz-eyebrow)",
  letterSpacing: "var(--tr-eyebrow)",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const progressRailStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  gap: 5,
  alignItems: "center",
};

const chipBaseStyle: CSSProperties = {
  appearance: "none",
  fontFamily: "var(--ff-body)",
  fontSize: 15,
  fontWeight: 700,
  padding: "14px 22px",
  borderRadius: 999,
  minHeight: 48,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  transition:
    "background 180ms var(--ease-out), color 180ms var(--ease-out), border-color 180ms var(--ease-out), box-shadow 180ms var(--ease-out), transform 180ms var(--ease-out)",
};

const pillFills: Record<PillFill, { bg: string; fg: string }> = {
  white: { bg: "var(--paper)", fg: "var(--ink)" },
  sun: { bg: "var(--sun)", fg: "var(--ink)" },
  ink: { bg: "var(--ink)", fg: "var(--paper)" },
  ghost: { bg: "transparent", fg: "var(--paper)" },
};

const pillButtonBaseStyle: CSSProperties = {
  appearance: "none",
  border: 0,
  width: "100%",
  height: 60,
  borderRadius: 999,
  fontFamily: "var(--ff-body)",
  fontWeight: 900,
  fontSize: 14,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  transition: "transform 140ms var(--ease-out), opacity 200ms",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const receiptChipTextStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "var(--paper)",
  letterSpacing: 0.1,
};

const receiptChipActionStyle: CSSProperties = {
  ...receiptChipTextStyle,
  fontWeight: 500,
  color: "rgba(255,255,255,0.82)",
};

const avatarAnsweredBadgeStyle: CSSProperties = {
  position: "absolute",
  bottom: -2,
  right: -2,
  width: 16,
  height: 16,
  borderRadius: "50%",
  background: "var(--sun)",
  border: "2px solid var(--paper)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  color: "var(--ink)",
  fontWeight: 900,
};

const glassBaseStyle: CSSProperties = {
  backdropFilter: "blur(8px) saturate(160%)",
  WebkitBackdropFilter: "blur(8px) saturate(160%)",
  border: "0.75px solid rgba(255,255,255,0.32)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
  borderRadius: "var(--r-card)",
};

const gtiMarkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  color: "var(--paper)",
  fontFamily: "var(--ff-body)",
  textDecoration: "none",
};

// The 4-stop gradient map.
//
// under `gradient.surfaces.<stop>`. They live here too because the
// Drift is gated by `verify.mjs` — every hex below must be present in
// tokens.json or the sweep fails.
// Avatar colors. Mirrors `color.member-identity` in tokens.json.
// The "self" color is the `--sun` token; the other three are the
// rotating identity palette.
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
  onLeave,
}: {
  step?: number;
  total?: number;
  onClose?: () => void;
  /** tb-WF-12 (web-01 §E) — when provided, the chrome renders a `Leave`
   *  affordance in the trailing slot. The web invitee shell passes it
   *  on the Q1–Q5 quiz chrome so a Web invitee can leave an in-flight
   *  quiz; off the chrome (Waiting, Verdict) it is omitted. The joiner
   *  role label is `Leave`, not `Exit` (S03 §"Role-conditional labels"). */
  onLeave?: () => void;
}) {
  return (
    <div style={topBarStyle}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close session"
        style={topBarCloseStyle}
      >
        ×
      </button>
      <div style={progressRailStyle}>
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
      {onLeave ? (
        <button
          type="button"
          onClick={onLeave}
          style={topBarLeaveStyle}
        >
          Leave
        </button>
      ) : null}
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
  disabled,
  onClick,
  style,
}: {
  label: string;
  selected?: boolean;
  /** C-04 `disabled` row — dimmed, non-interactive. Q1 uses it once the
   *  cuisine 3-cap is reached (an unselected chip becomes disabled). */
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    ...chipBaseStyle,
    cursor: disabled ? "not-allowed" : "pointer",
    ...style,
  };
  // C-04 `disabled` — the unselected chip dimmed to 0.4 white text on
  // the soft fill. A selected chip is never disabled (it must stay
  // tappable to deselect), so this branch only ever runs unselected.
  if (disabled && !selected) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled
        aria-pressed="false"
        style={{
          ...base,
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.4)",
          border: "1.5px solid rgba(255,255,255,0.23)",
        }}
      >
        {label}
      </button>
    );
  }
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
  const { bg, fg } = pillFills[fill];
  const buttonStyle: CSSProperties = {
    ...pillButtonBaseStyle,
    background: bg,
    color: fg,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    boxShadow:
      fill === "sun"
        ? "0 12px 32px rgba(255,210,63,0.4), inset 0 1px 0 rgba(255,255,255,0.45)"
        : fill === "ghost"
          ? "inset 0 0 0 1.5px rgba(255,255,255,0.55)"
          : "0 12px 32px rgba(0,0,0,0.18)",
    ...style,
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={buttonStyle}
    >
      {prefix}
      {label}
    </button>
  );
}

function ReceiptChip({
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
  const chipStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 5,
    padding: "7px 13px 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(8px) saturate(160%)",
    WebkitBackdropFilter: "blur(8px) saturate(160%)",
    border: "0.75px solid rgba(255,255,255,0.32)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 10px rgba(0,0,0,0.08)",
    animation: `gti-stagger-in 480ms var(--ease-out-soft) ${delay}ms both`,
    ...style,
  };
  return (
    <div
      style={chipStyle}
    >
      <span style={receiptChipTextStyle}>
        {name}
      </span>
      <span style={receiptChipActionStyle}>
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
  const avatarStyle: CSSProperties = {
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
    transition:
      "opacity 320ms var(--ease-out), filter 320ms var(--ease-out), box-shadow 320ms var(--ease-out)",
  };
  return (
    <div style={avatarStyle}>
      {initial}
      {answered ? (
        <div style={avatarAnsweredBadgeStyle}>
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
  const glassStyle: CSSProperties = {
    ...glassBaseStyle,
    background: soft
      ? "rgba(255,255,255,0.10)"
      : "rgba(255,255,255,0.18)",
    ...style,
  };
  return (
    <div style={glassStyle}>
      {children}
    </div>
  );
}

export function GTIMark({ size = 18 }: { size?: number }) {
  // wfr-18. The wordmark is the GetToIt home affordance on every web
  // surface (NameEntry, InviteShell, InviteShellSurfaces terminals,
  // WaitingScreen). Rendering it as a Link to `/` gives users a global
  // Escape Hatch / Habituated home gesture without changing the visual
  // lockup — the inline-flex row, tile, and "GetToIt" span are
  // unchanged; we only swap the outer <div> for an <a>-shaped <Link>
  // and reset the inherited anchor styles so the wordmark looks
  // identical to its pre-link form.
  const tileStyle: CSSProperties = {
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
  };
  const textStyle: CSSProperties = {
    fontWeight: 800,
    fontSize: size * 0.78,
    letterSpacing: 0.6,
  };
  return (
    <Link
      href="/"
      aria-label="GetToIt — home"
      style={gtiMarkStyle}
    >
      <div style={tileStyle}>
        g
      </div>
      <span style={textStyle}>
        GetToIt
      </span>
    </Link>
  );
}
