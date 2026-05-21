// GetToIt web — Surface web-01 §A "First-landing name entry".
//
// tb-WF-11 — the name-entry-alone surface a cold Web invitee reaches on
// the first click of `/join/<roomId>`. Canonical spec: the design-system
// surface doc `design-system/surfaces/web-01-invitee-shell.md` §A.
//
// Pure presentational component — it owns the input value + the
// CTA-enable rule, and hands the trimmed name up via `onSubmit`. The
// supabase wiring (anon session, the `members` row insert that carries
// `display_name`) lives in the `InviteShell` orchestrator.
//
// Per the surface doc §A this is single text input + one CTA. No plan
// summary: a summary would credit the initiator's name, which needs a
// public RLS read path that does not exist (decision doc §Q4). The
// landing's only job is to mint a member identity.

"use client";

import { useState, type FormEvent } from "react";

import { Eyebrow, GTIMark, GradientSurface, PillCTA } from "./SunsetPop";

// The 30-char hard cap from surface doc §A "Name input". The field
// hard-stops input at 30 via `maxLength`; there is no counter chip and
// no error state — the cap is enforced silently.
const NAME_MAX_LENGTH = 30;

export type NameEntryProps = {
  /** Called with the trimmed, non-empty name when the invitee taps the
   *  CTA (or submits the form). Never called for a whitespace-only or
   *  empty value — the CTA is disabled in that state. */
  onSubmit: (name: string) => void;
  /** True while the orchestrator is creating the `members` row. Disables
   *  the input + CTA so the invitee can't double-submit. */
  submitting?: boolean;
  /** A failure message surfaced below the CTA — e.g. the `members`
   *  insert was rejected. Absent on the happy path. */
  errorMessage?: string;
};

export function NameEntry({
  onSubmit,
  submitting = false,
  errorMessage,
}: NameEntryProps) {
  const [name, setName] = useState("");

  // CTA-enable rule (surface doc §A): "Join the plan" is disabled until
  // the trimmed input value is non-empty. A whitespace-only value never
  // enables the CTA.
  const trimmed = name.trim();
  const isValid = trimmed.length > 0;
  const canSubmit = isValid && !submitting;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(trimmed);
  }

  return (
    <GradientSurface stop="initiator">
      <form
        onSubmit={handleSubmit}
        className="gti-fade-up"
        data-testid="name-entry"
        style={{
          position: "absolute",
          inset: 0,
          // Wordmark top-leading at 22px from the leading + top edge,
          // centered content column max-width 360, h-padding 22 — the
          // shared shell chrome from the surface doc.
          padding: "22px 22px 24px",
          display: "flex",
          flexDirection: "column",
          color: "var(--paper)",
        }}
      >
        <GTIMark size={20} />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            maxWidth: 360,
            marginInline: "auto",
          }}
        >
          {/* eyebrow → 10 → headline → 24 → input → 16 → CTA */}
          <Eyebrow>You&apos;re invited</Eyebrow>

          <h1
            className="gti-display"
            style={{
              fontSize: 38,
              margin: "10px 0 0",
              textWrap: "balance",
            }}
          >
            What should we call you?
          </h1>

          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            aria-label="Your name"
            maxLength={NAME_MAX_LENGTH}
            autoFocus
            autoCapitalize="words"
            autoComplete="off"
            disabled={submitting}
            data-testid="name-entry-input"
            style={{
              marginTop: 24,
              width: "100%",
              height: 56,
              boxSizing: "border-box",
              padding: "0 18px",
              borderRadius: "var(--r-row)",
              background: "var(--glass-fill-soft)",
              border: "1px solid var(--glass-stroke)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              color: "var(--paper)",
              fontFamily: "var(--ff-body)",
              fontSize: 16,
              fontWeight: 600,
              outline: "none",
              // Focus ring → sun: the "system registered your input"
              // signal, 140ms ease-out (surface doc §"Name input").
              transition: "border-color 140ms var(--ease-out)",
            }}
            onFocus={(event) => {
              event.currentTarget.style.borderColor = "var(--sun)";
            }}
            onBlur={(event) => {
              event.currentTarget.style.borderColor = "var(--glass-stroke)";
            }}
          />

          <div style={{ marginTop: 16 }}>
            <PillCTA
              label="Join the plan"
              fill="white"
              type="submit"
              disabled={!canSubmit}
            />
          </div>

          {errorMessage ? (
            <p
              role="alert"
              data-testid="name-entry-error"
              style={{
                margin: "12px 0 0",
                fontFamily: "var(--ff-body)",
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1.4,
                color: "rgba(255,255,255,0.78)",
                textWrap: "balance",
              }}
            >
              {errorMessage}
            </p>
          ) : null}
        </div>
      </form>
    </GradientSurface>
  );
}
