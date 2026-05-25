// GetToIt web — Q1–Q5 quiz screens, quiz redesign (tb-WF-10).
//
// Web equivalents of the iOS redesigned quiz surfaces (`QuizQ1Cuisine`,
// `QuizQ2Budget`, `QuizQ3Reputation`, `QuizQ4Vibe`, `QuizQ5Regret`,
// `QuizQ5NoResults`). The authoritative spec is
// `design-system/surfaces/03-quiz.md` — these are 1:1 ports threaded
// onto real data (props instead of internal state) so `SessionRoom` can
// hold the quiz state. Per ADR 0003 the web fallback re-implements the
// design-system surfaces rather than importing the JSX.
//
// Quiz redesign (tb-WF-10): the retired pre-redesign questions (Q1 dietary vetoes, Q3
// walk-distance) are replaced by the redesigned scenario questions (Q1 cuisine
// craving, Q3 reputation/discovery). Q5 renders the strict-factorial
// probe + the `no-results` honest-degradation mode (ADR 0013).

"use client";

import { type CSSProperties } from "react";

import {
  BUDGET_TIERS,
  CUISINE_OPTIONS,
  REPUTATION_NO_PREFERENCE,
  REPUTATION_OPTIONS,
  VIBE_LABELS,
  type CuisineSelection,
} from "../lib/quiz";
import { hasFreeCuisineSlot } from "../lib/quiz";
import type { QuizCandidate } from "../lib/candidate-fetch";

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

// ───────────────────────────────────────────────────────────────────────
// Q1 — Cuisine craving (capped multi-select chips)
// ───────────────────────────────────────────────────────────────────────

export function QuizQ1Cuisine({
  selection,
  onToggleCuisine,
  onToggleNoPreference,
  onAdvance,
  onLeave,
}: {
  selection: CuisineSelection;
  onToggleCuisine: (id: string) => void;
  onToggleNoPreference: () => void;
  onAdvance: () => void;
  /** tb-WF-12 (web-01 §E) — the web invitee shell's quiz-chrome Leave
   *  affordance. Renders the chrome `Leave` control when provided. */
  onLeave?: () => void;
}) {
  const atCap = !hasFreeCuisineSlot(selection);
  return (
    <GradientSurface stop="q1">
      <div style={canvasWrap}>
        <div style={contentWrap}>
          <TopBar step={1} total={5} onLeave={onLeave} />
          <div style={{ height: 40 }} />
          <QuestionHeader
            index={1}
            total={5}
            title="What are you craving?"
            sub="Pick up to 3 — or tap No preference."
          />
          <div
            style={{
              padding: "24px 22px 0",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {CUISINE_OPTIONS.map((opt) => {
              const isSel = selection.cuisines.has(opt.id);
              return (
                <Chip
                  key={opt.id}
                  label={opt.label}
                  selected={isSel}
                  // Once 3 are picked the remaining unselected chips
                  // disable; a selected chip stays tappable to deselect.
                  disabled={atCap && !isSel}
                  onClick={() => onToggleCuisine(opt.id)}
                />
              );
            })}
            <Chip
              label="No preference"
              selected={selection.noPreference}
              onClick={onToggleNoPreference}
            />
          </div>
          <CTADock>
            <PillCTA label="Next" onClick={onAdvance} />
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Q2 — Spend cap (single-select tier)
// ───────────────────────────────────────────────────────────────────────

export function QuizQ2Budget({
  tier,
  onSelect,
  onAdvance,
  onLeave,
}: {
  tier: number;
  onSelect: (tier: 1 | 2 | 3 | 4) => void;
  onAdvance: () => void;
  /** tb-WF-12 (web-01 §E) — quiz-chrome Leave affordance. */
  onLeave?: () => void;
}) {
  return (
    <GradientSurface stop="q2">
      <div style={canvasWrap}>
        <div style={contentWrap}>
          <TopBar step={2} total={5} onLeave={onLeave} />
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

// ───────────────────────────────────────────────────────────────────────
// Q3 — Reputation / discovery (single-select chips)
// ───────────────────────────────────────────────────────────────────────

export function QuizQ3Reputation({
  value,
  onSelect,
  onAdvance,
  onLeave,
}: {
  value: string;
  onSelect: (id: string) => void;
  onAdvance: () => void;
  /** tb-WF-12 (web-01 §E) — quiz-chrome Leave affordance. */
  onLeave?: () => void;
}) {
  return (
    <GradientSurface stop="q3">
      <div style={canvasWrap}>
        <div style={contentWrap}>
          <TopBar step={3} total={5} onLeave={onLeave} />
          <div style={{ height: 40 }} />
          <QuestionHeader
            index={3}
            total={5}
            title="What kind of place?"
            sub="The standing of the spot, not the food."
          />
          <div
            style={{
              padding: "24px 22px 0",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {REPUTATION_OPTIONS.map((opt) => (
              <Chip
                key={opt.id}
                label={opt.label}
                selected={value === opt.id}
                onClick={() => onSelect(opt.id)}
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

// ───────────────────────────────────────────────────────────────────────
// Q4 — Vibe energy (cardinal scale)
// ───────────────────────────────────────────────────────────────────────

export function QuizQ4Vibe({
  value,
  onSelect,
  onAdvance,
  onLeave,
}: {
  value: number;
  onSelect: (index: number) => void;
  onAdvance: () => void;
  /** tb-WF-12 (web-01 §E) — quiz-chrome Leave affordance. */
  onLeave?: () => void;
}) {
  const word = VIBE_LABELS[value] ?? VIBE_LABELS[0];
  return (
    <GradientSurface stop="q4">
      <div style={canvasWrap}>
        <div style={contentWrap}>
          <TopBar step={4} total={5} onLeave={onLeave} />
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

// ───────────────────────────────────────────────────────────────────────
// Q5 — Preference probe (3 factorial cards × 5 buttons)
// ───────────────────────────────────────────────────────────────────────

/** The Q5 candidate state — drives which mode Q5 renders. Mirrors the
 *  iOS `QuizCoordinator.Q5CandidatesState`. */
export type Q5State = "loading" | "default" | "no-results";

export function QuizQ5({
  state,
  candidates,
  ratings,
  onRate,
  onSubmit,
  submitting,
  onLeave,
}: {
  state: Q5State;
  candidates: ReadonlyArray<QuizCandidate>;
  ratings: Record<string, number>;
  onRate: (candidateId: string, score: number) => void;
  onSubmit: () => void;
  submitting?: boolean;
  /** tb-WF-12 (web-01 §E) — quiz-chrome Leave affordance. */
  onLeave?: () => void;
}) {
  return (
    <GradientSurface stop="q5">
      <div style={canvasWrap}>
        <div style={contentWrap}>
          <TopBar step={5} total={5} onLeave={onLeave} />
          <div style={{ height: 40 }} />
          {state === "loading" ? (
            <Q5Loading />
          ) : state === "no-results" ? (
            <Q5NoResults onSubmit={onSubmit} submitting={submitting} />
          ) : (
            <Q5Default
              candidates={candidates}
              ratings={ratings}
              onRate={onRate}
              onSubmit={onSubmit}
              submitting={submitting}
            />
          )}
        </div>
      </div>
    </GradientSurface>
  );
}

function Q5Loading() {
  return (
    <div
      data-testid="quiz-q5-loading"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "0 32px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: "var(--ff-body)",
          fontWeight: 700,
          fontSize: "var(--fz-eyebrow)",
          letterSpacing: "var(--tr-eyebrow)",
          textTransform: "uppercase",
          opacity: 0.78,
          margin: 0,
        }}
      >
        Lining up spots
      </p>
      <p
        style={{
          fontFamily: "var(--ff-body)",
          fontWeight: 600,
          fontSize: "var(--fz-body)",
          opacity: 0.86,
          margin: 0,
        }}
      >
        Finding three places near you to rate…
      </p>
    </div>
  );
}

// `no-results` mode — design-system surfaces/03-quiz.md §"no-results
// mode". Centered headline + body in place of the rater cards; the
// `Drop the verdict` CTA is replaced by `Head to the verdict`. Locked
// copy — do not paraphrase.
function Q5NoResults({
  onSubmit,
  submitting,
}: {
  onSubmit: () => void;
  submitting?: boolean;
}) {
  return (
    <>
      <div
        data-testid="quiz-q5-no-results"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: "0 32px",
          textAlign: "center",
        }}
      >
        <h2
          className="gti-display"
          style={{
            fontSize: "var(--fz-display-m)",
            lineHeight: 0.92,
            color: "var(--paper)",
            margin: 0,
          }}
        >
          No spots to rate near you.
        </h2>
        <p
          style={{
            fontFamily: "var(--ff-body)",
            fontWeight: 500,
            fontSize: "var(--fz-body)",
            lineHeight: 1.45,
            opacity: 0.86,
            margin: 0,
          }}
        >
          Couldn&apos;t line up rateable spots in your radius tonight. Your
          other answers still count — the verdict lands without this step.
        </p>
      </div>
      <CTADock>
        <PillCTA
          label={submitting ? "Submitting…" : "Head to the verdict"}
          fill="sun"
          disabled={submitting}
          onClick={onSubmit}
        />
      </CTADock>
    </>
  );
}

function Q5Default({
  candidates,
  ratings,
  onRate,
  onSubmit,
  submitting,
}: {
  candidates: ReadonlyArray<QuizCandidate>;
  ratings: Record<string, number>;
  onRate: (candidateId: string, score: number) => void;
  onSubmit: () => void;
  submitting?: boolean;
}) {
  return (
    <>
      <QuestionHeader
        index={5}
        total={5}
        title="How excited does each of these make you?"
        sub="Three real spots near you. Rate each."
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
                    aria-label={`${p.name} excitement ${n}`}
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
              <span>Not for me</span>
              <span>Can&apos;t wait</span>
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
    </>
  );
}

export { REPUTATION_NO_PREFERENCE };
