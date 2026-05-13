// Surface 02b — Invite web fallback
// Hosted page at gettoit.app/s/<id> for recipients without the app installed.

function ScreenInviteWeb({ onAdvance }) {
  return (
    <GradientSurface stop="initiator">
      <div style={{
        position: 'absolute', inset: 0,
        padding: '64px 22px 24px',
        display: 'flex', flexDirection: 'column', color: '#fff',
      }}>
        <GTIMark size={20} />
        <div style={{ marginTop: 40 }}>
          <Eyebrow style={{ marginBottom: 12 }}>Maya sent you a session</Eyebrow>
          <h1 className="gti-display" style={{
            fontSize: 50, lineHeight: 0.88, margin: 0, textTransform: 'uppercase',
          }}>Where<br/>we're<br/>eating<br/>tonight</h1>
          <p style={{
            margin: '20px 0 0', fontSize: 15, fontWeight: 600,
            color: 'rgba(255,255,255,0.82)', maxWidth: 300,
          }}>
            4 people · 5 questions · 60 seconds. Answer on your own time, the verdict drops when everyone's in.
          </p>
        </div>
        <CTADock>
          <PillCTA label="Answer in browser" fill="white" onClick={onAdvance} />
          <PillCTA label="Open in app" fill="ghost" />
          <div style={{
            fontSize: 11, opacity: 0.6, textAlign: 'center', marginTop: 4,
            letterSpacing: 0.1,
          }}>gettoit.app/s/a3kp2 · expires in 27 min</div>
        </CTADock>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenInviteWeb });
