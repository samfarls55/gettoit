// Surface 00b — Location permission pre-prime
// Soft prompt that explains the use-case BEFORE iOS fires its native
// CLLocationManager dialog. Primary CTA triggers the system prompt;
// secondary text link skips it and proceeds with the LocationPicker in
// `empty` state. Surface continuity with S01 — same `initiator` gradient
// so the transition reads as one coral-to-sunset moment.
//
// The actual `CLLocationManager.requestWhenInUseAuthorization` call,
// permission-state observer, and routing to S01 are owned by tb-03.
// This file is the spec surface — what the screen looks like and what
// the buttons do.

function ScreenLocationPermission({ onShare, onManual }) {
  return (
    <GradientSurface stop="initiator">
      <div style={{
        position: 'absolute', inset: 0,
        padding: '64px 22px 24px',
        display: 'flex', flexDirection: 'column', color: '#fff',
      }}>
        <GTIMark size={22} />

        <div style={{ marginTop: 64 }}>
          <Eyebrow style={{ marginBottom: 14 }}>Before we start</Eyebrow>
          <h1 className="gti-display" style={{
            fontSize: 44, lineHeight: 0.92, margin: 0,
            textTransform: 'uppercase',
          }}>
            Where are<br/>you eating<br/>tonight?
          </h1>
          <p style={{
            margin: '20px 0 0', fontSize: 15, fontWeight: 600, lineHeight: 1.45,
            color: 'rgba(255,255,255,0.84)', maxWidth: 320,
          }}>
            We'll line up restaurants close enough to walk to, instead of asking
            your neighborhood every time. Sharing your location is optional —
            type it in if you'd rather.
          </p>
        </div>

        <CTADock>
          <PillCTA
            label="Share my location"
            fill="white"
            onClick={onShare}
          />
          {/* Secondary escape — skips the iOS prompt. eyebrow-token text link,
              same treatment as S01 SETTINGS and S04 "Maybe later". */}
          <button
            onClick={onManual}
            style={{
              appearance: 'none', background: 'transparent', border: 0, cursor: 'pointer',
              minHeight: 44, marginTop: 4,
              fontFamily: 'var(--ff-body)',
              fontWeight: 700, fontSize: 11,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)',
              alignSelf: 'center',
            }}
            aria-label="Pick a place manually — skip the iOS prompt"
          >Pick a place manually</button>
        </CTADock>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenLocationPermission });
