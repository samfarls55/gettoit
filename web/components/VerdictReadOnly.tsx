// GetToIt web — Surface 09 (Verdict), read-only mode.
//
// Web equivalent of `design-system/code/screens/ScreenVerdict.jsx`
// in `mode='read-only'`. TB-15 hard rule 4: "The verdict on web is
// read-only — no ratification, no reroll, no check-in." The view
// renders the verdict, the rule, the receipts, and the cuts drawer;
// the CTA is a non-mutating "Start a new decision" link back to the
// app surface.
//
// Suppressed vs iOS:
//   * No "I'm in" / committed pill (no ratification on web).
//   * No "Start over" / "Window closes in 47s" secondary (no reroll
//     / check-in on web).
//   * No widen-radius for no-survivor — the web fallback shows the
//     no-survivor terminal copy but never the slider; "Widen radius"
//     would re-fire the engine, which is the initiator's job on iOS.
//   * No verdict-reveal choreography for now — the page lands after
//     `verdict_ready`, so the verdict is already known.

"use client";

import { useState, type CSSProperties } from "react";

import type { VerdictView } from "../lib/verdict";

import {
  CTADock,
  Eyebrow,
  GradientSurface,
  PillCTA,
  ReceiptChip,
} from "./SunsetPop";

const canvasWrap: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  color: "var(--paper)",
};

const contentWrap: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  paddingTop: 56,
  paddingBottom: 32,
};

export function VerdictReadOnly({
  view,
  onStartNew,
}: {
  view: VerdictView;
  onStartNew?: () => void;
}) {
  const [cutsOpen, setCutsOpen] = useState(false);
  const isNoSurvivor = view.mode === "no-survivor";

  const eyebrowCopy = isNoSurvivor ? "Tonight" : "Tonight's verdict";
  const heroLines = isNoSurvivor
    ? ["No spot", "fits"]
    : splitHeroName(view.placeName);

  return (
    <GradientSurface stop="verdict">
      <div style={canvasWrap}>
        <div style={contentWrap}>
          <div style={{ padding: "0 22px", textAlign: "center" }}>
            <Eyebrow style={{ opacity: 0.86 }}>{eyebrowCopy}</Eyebrow>
          </div>
          <div style={{ padding: "14px 22px 0", textAlign: "center" }}>
            <div
              className="gti-display"
              style={{
                fontSize: 60,
                color: "var(--paper)",
                textTransform: "uppercase",
                letterSpacing: "-0.03em",
                lineHeight: 0.9,
              }}
              data-testid="verdict-hero"
            >
              {heroLines[0]}
              {heroLines[1] ? (
                <>
                  <br />
                  {heroLines[1]}
                </>
              ) : null}
            </div>
            {view.metaLine ? (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.88)",
                  letterSpacing: 0.18,
                  textTransform: "uppercase",
                }}
                data-testid="verdict-meta"
              >
                {view.metaLine}
              </div>
            ) : null}
          </div>

          {!isNoSurvivor && view.mode === "default" ? (
            <div
              style={{
                marginTop: 22,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  background: "var(--sun)",
                  color: "var(--ink)",
                  padding: "12px 30px",
                  borderRadius: 16,
                  textAlign: "center",
                  boxShadow:
                    "0 18px 38px rgba(255,210,63,0.36), inset 0 1px 0 rgba(255,255,255,0.5)",
                }}
              >
                <div
                  className="gti-display"
                  style={{
                    fontSize: 34,
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                  }}
                >
                  {view.timeBadge.time}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: 0.18,
                    textTransform: "uppercase",
                  }}
                >
                  {view.timeBadge.audience}
                </div>
              </div>
            </div>
          ) : null}

          <div
            style={{
              marginTop: 22,
              padding: "0 26px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255,255,255,0.92)",
                lineHeight: 1.45,
                textWrap: "balance",
              }}
              data-testid="verdict-rule"
            >
              {view.ruleText}
            </p>
          </div>

          {!isNoSurvivor && view.mode === "default" && view.receipts.length > 0 ? (
            <div
              style={{
                marginTop: 22,
                padding: "0 22px",
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                justifyContent: "center",
              }}
              data-testid="verdict-receipts"
            >
              {view.receipts.map((r) => (
                <ReceiptChip
                  key={`${r.name}-${r.action}`}
                  name={r.name}
                  action={r.action}
                />
              ))}
            </div>
          ) : null}

          {!isNoSurvivor && view.mode === "default" && view.cuts.length > 0 ? (
            <div style={{ marginTop: 18, padding: "0 22px" }}>
              {!cutsOpen ? (
                <button
                  type="button"
                  onClick={() => setCutsOpen(true)}
                  data-testid="verdict-cuts-open"
                  style={{
                    appearance: "none",
                    border: 0,
                    background: "transparent",
                    color: "rgba(255,255,255,0.85)",
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "center",
                    padding: 8,
                    fontFamily: "var(--ff-body)",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.16,
                    textTransform: "uppercase",
                  }}
                >
                  See what got cut →
                </button>
              ) : (
                <div
                  style={{
                    animation: "gti-fade-up 360ms var(--ease-out-soft) both",
                  }}
                  data-testid="verdict-cuts-list"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0 4px 8px",
                    }}
                  >
                    <div
                      className="gti-eyebrow"
                      style={{ color: "var(--paper)", opacity: 0.7 }}
                    >
                      What got cut
                    </div>
                    <button
                      type="button"
                      onClick={() => setCutsOpen(false)}
                      style={{
                        appearance: "none",
                        border: 0,
                        background: "transparent",
                        color: "rgba(255,255,255,0.7)",
                        cursor: "pointer",
                        fontFamily: "var(--ff-body)",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 0.14,
                        textTransform: "uppercase",
                        padding: 2,
                      }}
                    >
                      Hide
                    </button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {view.cuts.map((c) => (
                      <div
                        key={c.name}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          padding: "8px 12px",
                          borderRadius: 10,
                          background: "rgba(0,0,0,0.18)",
                        }}
                      >
                        <span
                          style={{
                            textDecoration: "line-through",
                            textDecorationColor: "rgba(255,255,255,0.6)",
                            textDecorationThickness: 1.5,
                            fontWeight: 800,
                            fontSize: 14,
                            color: "var(--paper)",
                          }}
                        >
                          {c.name}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.7)",
                            letterSpacing: 0.06,
                          }}
                        >
                          {c.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <CTADock>
            <PillCTA
              label="Start a new decision"
              fill="white"
              onClick={onStartNew}
            />
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

// Split the place name into two lines for the hero. Falls back to a
// single line when the name is short enough.
function splitHeroName(name: string): [string, string?] {
  const trimmed = name.trim();
  // Common pattern: "Possessive's Noun" → split on apostrophe-s.
  const possessive = trimmed.match(/^(.+'s)\s+(.+)$/);
  if (possessive) return [possessive[1], possessive[2]];
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return [words[0]];
  // Two-word names → one per line. Longer names → first word on top,
  // rest below.
  if (words.length === 2) return [words[0], words[1]];
  return [words[0], words.slice(1).join(" ")];
}
