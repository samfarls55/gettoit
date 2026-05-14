// GetToIt web — Q1–Q5 quiz screens.
//
// Web equivalents of:
//   * design-system/code/screens/ScreenQ1Vetoes.jsx
//   * design-system/code/screens/ScreenQ2Budget.jsx
//   * design-system/code/screens/ScreenQ3Distance.jsx
//   * design-system/code/screens/ScreenQ4Vibe.jsx
//   * design-system/code/screens/ScreenQ5Regret.jsx
//
// Per ADR 0003, the web fallback does NOT import from
// `design-system/code/`. These components are 1:1 ports threaded onto
// real data (props instead of internal state) so the parent session
// page can hold the QuizCoordinator-equivalent state.

"use client";

import { type CSSProperties } from "react";

import {
  BUDGET_TIERS,
  VETO_OPTIONS,
  VIBE_LABELS,
  WALK_STOPS,
  type Candidate,
} from "../lib/quiz";

import {
  CTADock,
  Chip,
  Glass,
  GradientSurface,
  PillCTA,
  QuestionHeader,
  TopBar,
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

export function QuizQ1Vetoes({
  selected,
  onToggle,
  onAdvance,
}: {
  selected: ReadonlySet<string>;
  onToggle: (chip: string) => void;
  onAdvance: () => void;
}) {
  return (
    <GradientSurface stop="q1">
      <div style={canvasWrap}>
        <div style={contentWrap}>
          <TopBar step={1} total={5} />
          <div style={{ height: 40 }} />
          <QuestionHeader
            index={1}
            total={5}
            title="Any hard no's tonight?"
            sub="Tap everything that's off the table."
          />
          <div
            style={{
              padding: "24px 22px 0",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {VETO_OPTIONS.map((opt) => (
              <Chip
                key={opt.id}
                label={opt.label}
                selected={selected.has(opt.id)}
                onClick={() => onToggle(opt.id)}
              />
            ))}
          </div>
          <CTADock>
            <PillCTA label="Next" onClick={onAdvance} />
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

export function QuizQ2Budget({
  tier,
  onSelect,
  onAdvance,
}: {
  tier: number;
  onSelect: (tier: 1 | 2 | 3 | 4) => void;
  onAdvance: () => void;
}) {
  return (
    <GradientSurface stop="q2">
      <div style={canvasWrap}>
        <div style={contentWrap}>
          <TopBar step={2} total={5} />
          <div style={{ height: 40 }} />
          <QuestionHeader
            index={2}
            total={5}
            title="What's your max?"
            sub="Pick the ceiling — we won't suggest above it."
          />
          <div
            style={{
              marginTop: 20,
              padding: "0 22px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {BUDGET_TIERS.map((t) => {
              const selected = tier === t.tier;
              return (
                <button
                  type="button"
                  key={t.tier}
                  onClick={() => onSelect(t.tier)}
                  aria-pressed={selected}
                  style={{
                    appearance: "none",
                    border: 0,
                    cursor: "pointer",
                    textAlign: "left",
                    padding: "16px 20px",
                    borderRadius: 16,
                    background: selected
                      ? "var(--sun)"
                      : "rgba(255,255,255,0.06)",
                    color: selected ? "var(--ink)" : "var(--paper)",
                    boxShadow: selected
                      ? "0 14px 30px rgba(255,210,63,0.32), inset 0 1px 0 rgba(255,255,255,0.4)"
                      : "inset 0 0 0 1.5px rgba(255,255,255,0.45)",
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    transition: "all 220ms var(--ease-out)",
                    transform: selected ? "scale(1.015)" : "scale(1)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--ff-display)",
                      fontWeight: 900,
                      fontSize: 32,
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                    }}
                  >
                    {t.label}
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      letterSpacing: 0.08,
                      textTransform: "uppercase",
                      opacity: selected ? 0.8 : 0.78,
                    }}
                  >
                    {t.sub}
                  </span>
                </button>
              );
            })}
          </div>
          <CTADock>
            <PillCTA label="Next" onClick={onAdvance} />
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

export function QuizQ3Distance({
  value,
  onSelect,
  onAdvance,
}: {
  value: number;
  onSelect: (minutes: 5 | 10 | 15 | 20 | 30) => void;
  onAdvance: () => void;
}) {
  return (
    <GradientSurface stop="q3">
      <div style={canvasWrap}>
        <div style={contentWrap}>
          <TopBar step={3} total={5} />
          <div style={{ height: 40 }} />
          <QuestionHeader
            index={3}
            total={5}
            title="How far is too far?"
            sub="Max walk from here, right now."
          />
          <div style={{ marginTop: 36, padding: "0 22px", textAlign: "center" }}>
            <div
              className="gti-display"
              style={{
                fontSize: 100,
                lineHeight: 0.9,
                color: "var(--paper)",
                letterSpacing: "-0.04em",
              }}
            >
              {value}
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  opacity: 0.7,
                  marginLeft: 6,
                  verticalAlign: "super",
                  letterSpacing: 0.08,
                  textTransform: "uppercase",
                }}
              >
                min
              </span>
            </div>
            <div
              style={{
                marginTop: 26,
                display: "flex",
                gap: 6,
                justifyContent: "space-between",
              }}
            >
              {WALK_STOPS.map((t) => {
                const selected = value === t;
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => onSelect(t)}
                    aria-pressed={selected}
                    style={{
                      appearance: "none",
                      border: 0,
                      cursor: "pointer",
                      flex: 1,
                      padding: "12px 0",
                      borderRadius: 12,
                      background: selected
                        ? "var(--sun)"
                        : "rgba(255,255,255,0.08)",
                      color: selected ? "var(--ink)" : "var(--paper)",
                      fontFamily: "var(--ff-body)",
                      fontWeight: 800,
                      fontSize: 14,
                      boxShadow: selected
                        ? "0 10px 22px rgba(255,210,63,0.32)"
                        : "inset 0 0 0 1px rgba(255,255,255,0.32)",
                      transition: "all 180ms var(--ease-out)",
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.12,
                textTransform: "uppercase",
                opacity: 0.6,
              }}
            >
              <span>Around the corner</span>
              <span>Half a city</span>
            </div>
          </div>
          <CTADock>
            <PillCTA label="Next" onClick={onAdvance} />
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

export function QuizQ4Vibe({
  value,
  onSelect,
  onAdvance,
}: {
  value: number;
  onSelect: (index: number) => void;
  onAdvance: () => void;
}) {
  const word = VIBE_LABELS[value] ?? VIBE_LABELS[0];
  return (
    <GradientSurface stop="q4">
      <div style={canvasWrap}>
        <div style={contentWrap}>
          <TopBar step={4} total={5} />
          <div style={{ height: 40 }} />
          <QuestionHeader
            index={4}
            total={5}
            title="What's the energy tonight?"
            sub="Slide it to where the group lands."
          />
          <div
            style={{
              flex: 1,
              padding: "40px 22px 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
            }}
          >
            <div
              style={{
                height: 124,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
                width: "100%",
              }}
            >
              <div
                key={word}
                className="gti-display"
                style={{
                  fontSize: 96,
                  color: "var(--paper)",
                  letterSpacing: "-0.03em",
                  animation: "gti-rise 480ms var(--ease-out-soft) both",
                }}
              >
                {word}
              </div>
            </div>
            <div
              style={{
                width: "100%",
                display: "flex",
                gap: 6,
                marginTop: 22,
              }}
            >
              {VIBE_LABELS.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => onSelect(i)}
                  aria-label={`vibe ${VIBE_LABELS[i]}`}
                  aria-pressed={i === value}
                  style={{
                    appearance: "none",
                    border: 0,
                    cursor: "pointer",
                    flex: 1,
                    height: 12,
                    borderRadius: 999,
                    background:
                      i === value
                        ? "var(--sun)"
                        : "rgba(255,255,255,0.22)",
                    boxShadow:
                      i === value
                        ? "0 0 18px rgba(255,210,63,0.6)"
                        : "none",
                    transition: "all 200ms var(--ease-out)",
                    transform: i === value ? "scaleY(1.4)" : "scaleY(1)",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                marginTop: 16,
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.12,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              <span>{VIBE_LABELS[0]}</span>
              <span>{VIBE_LABELS[VIBE_LABELS.length - 1]}</span>
            </div>
          </div>
          <CTADock>
            <PillCTA label="Next" onClick={onAdvance} />
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

export function QuizQ5Regret({
  candidates,
  ratings,
  onRate,
  onSubmit,
  submitting,
}: {
  candidates: ReadonlyArray<Candidate>;
  ratings: Record<string, number>;
  onRate: (candidateId: string, score: number) => void;
  onSubmit: () => void;
  submitting?: boolean;
}) {
  return (
    <GradientSurface stop="q5">
      <div style={canvasWrap}>
        <div style={contentWrap}>
          <TopBar step={5} total={5} />
          <div style={{ height: 40 }} />
          <QuestionHeader
            index={5}
            total={5}
            title="If we don't go here, how much would you mind?"
            sub="Three places cleared everyone's filters. Rate each."
          />
          <div
            style={{
              marginTop: 22,
              padding: "0 22px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {candidates.map((p) => (
              <Glass key={p.id} soft style={{ padding: 14, borderRadius: 18 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--ff-display)",
                        fontWeight: 900,
                        fontSize: 17,
                        color: "var(--paper)",
                        lineHeight: 1.1,
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        marginTop: 3,
                        color: "rgba(255,255,255,0.7)",
                        letterSpacing: 0.08,
                        textTransform: "uppercase",
                      }}
                    >
                      {p.meta}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const sel = ratings[p.id] === n;
                    return (
                      <button
                        type="button"
                        key={n}
                        onClick={() => onRate(p.id, n)}
                        aria-label={`${p.name} regret ${n}`}
                        aria-pressed={sel}
                        style={{
                          appearance: "none",
                          border: 0,
                          cursor: "pointer",
                          flex: 1,
                          minHeight: 44,
                          borderRadius: 10,
                          background: sel
                            ? "var(--sun)"
                            : "rgba(255,255,255,0.10)",
                          color: sel ? "var(--ink)" : "var(--paper)",
                          fontFamily: "var(--ff-body)",
                          fontWeight: 800,
                          fontSize: 14,
                          boxShadow: sel
                            ? "0 8px 18px rgba(255,210,63,0.32)"
                            : "inset 0 0 0 1px rgba(255,255,255,0.22)",
                          transition: "all 180ms var(--ease-out)",
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 6,
                    fontSize: 9,
                    fontWeight: 700,
                    opacity: 0.6,
                    letterSpacing: 0.12,
                    textTransform: "uppercase",
                    color: "var(--paper)",
                  }}
                >
                  <span>Don&apos;t mind</span>
                  <span>Really mind</span>
                </div>
              </Glass>
            ))}
          </div>
          <CTADock>
            <PillCTA
              label={submitting ? "Submitting…" : "Drop the verdict"}
              fill="sun"
              disabled={submitting}
              onClick={onSubmit}
            />
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}
