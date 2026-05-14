// Surface 00 — Landing
// Post-sign-in entry surface. Two CTAs: Start a Decision (routes to S01)
// and Account Settings (routes to S09). No fields, no controls — the
// surface is a router, not a destination. Visual / brand polish deferred
// to the pre-public-launch milestone (see surfaces/00-landing.md
// §"v1.1 scope"); the skeleton ships now so routing + tap targets are real.

function ScreenLanding({ onStartDecision, onAccountSettings }) {
  return (
    <GradientSurface stop="initiator">
      <div style={{
        position: 'absolute', inset: 0,
        padding: '64px 22px 24px',
        display: 'flex', flexDirection: 'column', color: '#fff',
      }}>
        <GTIMark size={22} />

        <div style={{ marginTop: 56 }}>
          <Eyebrow style={{ marginBottom: 14 }}>Welcome back</Eyebrow>
          <h1 className="gti-display" style={{
            fontSize: 36, lineHeight: 0.96, margin: 0,
            textTransform: 'uppercase',
          }}>
            What's<br/>next?
          </h1>
        </div>

        <CTADock>
          <PillCTA
            label="Start a Decision"
            fill="white"
            onClick={onStartDecision}
          />
          <PillCTA
            label="Account Settings"
            fill="ghost"
            onClick={onAccountSettings}
          />
        </CTADock>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenLanding });
