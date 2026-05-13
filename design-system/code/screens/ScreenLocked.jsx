// Surface 10 — Hard-close (verdict locks)
// Shutter is canon — sun-yellow inner edge, NOT red (defends against feeling punitive).

function ScreenLocked() {
  return (
    <GradientSurface stop="verdict">
      {/* darken the gradient through a black veil */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.62)' }} />

      {/* shutters */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '34%',
        background: '#0A0A0F',
        borderBottom: '1px solid rgba(255,210,63,0.18)',
        animation: 'gti-shutter-top 700ms var(--ease-out-soft) 100ms both',
        zIndex: 4,
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '34%',
        background: '#0A0A0F',
        borderTop: '1px solid rgba(255,210,63,0.18)',
        animation: 'gti-shutter-bot 700ms var(--ease-out-soft) 100ms both',
        zIndex: 4,
      }} />

      {/* center plate */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 5,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '0 22px',
        color: '#fff', textAlign: 'center',
      }}>
        <div style={{
          padding: '10px 16px', borderRadius: 8,
          background: 'rgba(255,210,63,0.18)',
          border: '1px solid rgba(255,210,63,0.5)',
          color: 'var(--sun)',
          fontFamily: 'var(--ff-body)', fontWeight: 800, fontSize: 10,
          letterSpacing: 0.22, textTransform: 'uppercase',
          marginBottom: 22,
          animation: 'gti-fade-up 600ms var(--ease-out-soft) 800ms both',
        }}>
          <span style={{ marginRight: 6 }}>●</span>Verdict locked
        </div>

        <div className="gti-display" style={{
          fontSize: 52, lineHeight: 0.9, color: '#fff',
          textTransform: 'uppercase', letterSpacing: '-0.03em',
          animation: 'gti-fade-up 600ms var(--ease-out-soft) 1000ms both',
        }}>
          Pico's<br/>at 7:00
        </div>

        <div style={{
          marginTop: 22, padding: '0 30px',
          fontSize: 13, fontWeight: 600,
          color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, maxWidth: 280,
          textWrap: 'balance',
          animation: 'gti-fade-up 600ms var(--ease-out-soft) 1200ms both',
        }}>
          The correctability window closed 12 seconds ago. Re-opening takes a reroll — and reroll needs a reason the group reads.
        </div>

        <div style={{
          position: 'absolute', bottom: 56, left: 0, right: 0, textAlign: 'center',
          animation: 'gti-fade-up 600ms var(--ease-out-soft) 1400ms both',
        }}>
          <div style={{
            fontFamily: 'var(--ff-mono), ui-monospace, monospace',
            fontSize: 10, fontWeight: 600,
            color: 'rgba(255,255,255,0.45)', letterSpacing: 0.18,
            textTransform: 'uppercase',
          }}>
            Locked 6:48:32 PM · 2 of 3 rerolls remain
          </div>
        </div>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenLocked });
