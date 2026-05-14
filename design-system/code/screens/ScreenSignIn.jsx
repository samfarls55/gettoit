// Surface 00a — Forced Sign-in Gate (iOS, first launch).
// First surface a fresh-install iOS user sees. A single Sign-in-with-Apple
// affordance gates the rest of the app. No skip, no "continue as guest,"
// no email fallback. Closes the iOS half of ADR 0007 ("anonymous default")
// for v1.1 while leaving the web fallback anonymous-default intact.
//
// Reuses the existing `initiator` gradient stop so the transition to S01
// after sign-in is visually identity (no gradient tween). The pill is
// the canonical `PillCTA white` + the Apple-glyph prefix the C-22
// `default` state already uses — no new primitives.

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
}) {
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
          {/* The pill is the only interactive element. C-22's default-state
              visual treatment is the precedent — white pill, Apple glyph
              prefix, locked copy in the warm-friend register. We do not
              import C-22 directly: S00a has no dismiss path and no in-pill
              state machine; the surface owns its copy and post-tap routes
              away rather than swapping states. */}
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
        </CTADock>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenSignIn });
