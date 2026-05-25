// Surface 00a — Forced Sign-in Gate (iOS, first launch).
// First surface a fresh-install iOS user sees. A single Sign-in-with-Apple
// affordance gates the rest of the app. No skip, no "continue as guest,"
// no email fallback. Closes the iOS half of ADR 0007 ("anonymous default")
// for 0.1.0 while leaving the web fallback anonymous-default intact.
//
// Reuses the existing `initiator` gradient stop so the transition to S01
// after sign-in is visually identity (no gradient tween). The pill is
// the canonical `PillCTA white` + the Apple-glyph prefix the C-22
// `default` state already uses — no new primitives.
//
// sg-WF-8 amendment — the "Voted on the web?" account-claim affordance.
// Beneath the Apple pill sits a quiet, secondary eyebrow-token text link.
// A fresh-install user (never on the web) ignores it without friction.
// A Web invitee converting to an app install taps it to reveal the
// code-entry state: a single soft-glass claim-code input + a submit pill.
// Entering a valid claim code installs the browser anonymous session into
// the keychain BEFORE the Apple tap, so the Apple tap becomes `linkApple`
// (ADR 0015 — the claim-code bridge). This file is the spec surface —
// the redeem wiring is owned by tb-WF-14. The two-state behavior is
// driven by the `claimCodeOpen` prop; the caller owns the toggle.

function ScreenSignIn({
  onSignIn = () => {},
  // `inProgress` mirrors the C-22 in-progress contract: the native Apple
  // sheet is on top of this surface, so the pill is disabled but the
  // glyph and label persist (the sheet is the real progress UI).
  inProgress = false,
  // `errorMessage` renders a non-blocking inline line below the body
  // sub. Empty string = no error. User cancel of the Apple sheet is
  // NOT an error (per the spec) — caller passes '' on cancel.
  errorMessage = '',
  // ── sg-WF-8 account-claim props (spec-only; tb-WF-14 wires them) ──
  // `claimCodeOpen` toggles the code-entry state. Default = collapsed:
  // the dock shows the Apple pill + the quiet "Voted on the web?" link.
  claimCodeOpen = false,
  // Caller-owned toggle fired by tapping "Voted on the web?".
  onOpenClaimCode = () => {},
  // The claim-code field value + change handler. The field is a single
  // soft-glass input — the same pattern web-01 §A and C-23 already use.
  claimCode = '',
  onClaimCodeChange = () => {},
  // Fired by the "Bring my Plans over" submit pill.
  onSubmitClaimCode = () => {},
  // Non-blocking inline error for a bad / expired / mistyped code.
  // Empty string = no error.
  claimCodeError = '',
}) {
  // CTA enable rule: disabled until the trimmed code is non-empty.
  const claimCodeValid = claimCode.trim().length > 0;

  return (
    <GradientSurface stop="initiator">
      <div style={{
        position: 'absolute', inset: 0,
        padding: '64px 22px 24px',
        display: 'flex', flexDirection: 'column', color: '#fff',
      }}>
        <GTIMark size={22} />

        <div style={{ marginTop: 56 }}>
          <Eyebrow style={{ marginBottom: 14 }}>Tonight's session</Eyebrow>
          {/* display-l, one word per line per the stacked-uppercase rule
              (tokens.md §2). "Pick up where you left off" — frames the
              action as continuity, not creation. */}
          <h1 className="gti-display" style={{
            fontSize: 60, lineHeight: 0.9, margin: 0,
            letterSpacing: '-0.03em',
            textTransform: 'uppercase',
          }}>
            Pick up<br/>where<br/>you left<br/>off
          </h1>
        </div>

        <p style={{
          marginTop: 24, fontSize: 14, fontWeight: 600, lineHeight: 1.4,
          color: 'rgba(255,255,255,0.84)', maxWidth: 300,
        }}>
          Sign in once and your taste profile saves itself.
        </p>

        {errorMessage ? (
          <div
            role="alert"
            style={{
              marginTop: 12, fontSize: 13, fontWeight: 600, lineHeight: 1.4,
              color: 'rgba(255,255,255,0.7)', maxWidth: 300,
            }}
          >{errorMessage}</div>
        ) : null}

        <CTADock>
          {/* The Apple pill — the primary, always-present affordance.
              C-22's default-state visual treatment is the precedent:
              white pill, Apple glyph prefix, locked copy in the
              warm-friend register. We do not import C-22 directly:
              S00a has no dismiss path and no in-pill state machine;
              the surface owns its copy and post-tap routes away
              rather than swapping states. */}
          <PillCTA
            label="Save my taste profile"
            fill="white"
            disabled={inProgress}
            onClick={onSignIn}
            prefix={
              <span
                aria-hidden="true"
                style={{
                  fontSize: 18, fontWeight: 900,
                  color: 'var(--ink)', lineHeight: 1,
                }}
              ></span>
            }
          />

          {/* sg-WF-8 — the "Voted on the web?" account-claim affordance.
              Collapsed by default: a quiet, secondary eyebrow-token text
              link, the same low-key treatment S00b's "Pick a place
              manually" and S01's "SETTINGS" link use. A fresh-install
              user reads it, answers "no," and ignores it without
              friction — it costs them no field and no extra screen. */}
          {!claimCodeOpen ? (
            <button
              onClick={onOpenClaimCode}
              style={{
                appearance: 'none', background: 'transparent', border: 0,
                cursor: 'pointer',
                minHeight: 44, marginTop: 4,
                fontFamily: 'var(--ff-body)',
                fontWeight: 700, fontSize: 11,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.6)',
                alignSelf: 'center',
              }}
              aria-label="Voted on the web? Enter a claim code to bring your Plans over"
            >Voted on the web?</button>
          ) : (
            /* Revealed code-entry state. Teaching copy + a single
               soft-glass claim-code field + a submit pill. The
               teaching copy is TTL-honest per ADR 0006 — "recent web
               Plans," never "all your history" — and tells a user who
               does not yet have a code how to mint one (open a prior
               web link, tap "Getting the app?"). */
            <div
              style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 12 }}
              className="gti-fade-up"
            >
              <p style={{
                margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4,
                color: 'rgba(255,255,255,0.84)', maxWidth: 300,
                alignSelf: 'center', textAlign: 'center',
              }}>
                Bring back your recent web Plans. Open any link you voted
                on, tap "Getting the app?", and enter the code here.
              </p>

              {/* Single soft-glass claim-code input — the same pattern
                  web-01 §A name input + C-23 typeahead use. Not a new
                  component. */}
              <label style={{
                display: 'flex', alignItems: 'center',
                width: '100%', height: 56,
                padding: '0 16px',
                borderRadius: 'var(--r-row)',
                background: 'var(--glass-fill-soft)',
                border: '1px solid var(--glass-stroke)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                transition: 'border-color 140ms var(--ease-out)',
              }}>
                <input
                  type="text"
                  value={claimCode}
                  onChange={e => onClaimCodeChange(e.target.value)}
                  placeholder="Enter your code"
                  aria-label="Claim code"
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect="off"
                  style={{
                    flex: 1, appearance: 'none', border: 0, outline: 0,
                    background: 'transparent',
                    fontFamily: 'var(--ff-body)',
                    fontSize: 16, fontWeight: 600, lineHeight: 1.2,
                    color: 'var(--paper)',
                    caretColor: 'var(--sun)',
                  }}
                />
              </label>

              {claimCodeError ? (
                <div
                  role="alert"
                  style={{
                    margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.4,
                    color: 'rgba(255,255,255,0.7)', maxWidth: 300,
                    alignSelf: 'center', textAlign: 'center',
                  }}
                >{claimCodeError}</div>
              ) : null}

              {/* Submit CTA — existing PillCTA white. Disabled until the
                  trimmed code is non-empty (the existing disabled
                  treatment; no separate validation message). */}
              <PillCTA
                label="Bring my Plans over"
                fill="white"
                disabled={!claimCodeValid}
                onClick={onSubmitClaimCode}
              />
            </div>
          )}
        </CTADock>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenSignIn });
