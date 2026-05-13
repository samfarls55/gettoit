// Surface 01 — Initiator landing
// Pick a vertical, drop the invite link.

function ScreenInitiator({ onAdvance }) {
  const [vertical, setVertical] = React.useState('food');

  return (
    <GradientSurface stop="initiator">
      <div style={{
        position: 'absolute', inset: 0,
        padding: '64px 22px 24px',
        display: 'flex', flexDirection: 'column', color: '#fff',
      }}>
        <GTIMark size={22} />

        <div style={{ marginTop: 38 }}>
          <Eyebrow style={{ marginBottom: 14 }}>Tonight's session</Eyebrow>
          <h1 className="gti-display" style={{
            fontSize: 58, lineHeight: 0.88, margin: 0,
            textTransform: 'uppercase',
          }}>
            Figure<br/>it out<br/>together
          </h1>
          <p style={{
            margin: '20px 0 0', fontSize: 16, fontWeight: 600,
            color: 'rgba(255,255,255,0.84)', maxWidth: 280,
          }}>Five quick taps each. One verdict. Sixty seconds.</p>
        </div>

        <div style={{ marginTop: 32 }}>
          <Eyebrow style={{ marginBottom: 10, opacity: 0.6 }}>Pick a vertical</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { id: 'food',   label: 'Food',   meta: 'Where to eat', live: true },
              { id: 'drinks', label: 'Drinks', meta: 'Coming v2',    live: false },
              { id: 'movie',  label: 'Movie',  meta: 'Coming v2',    live: false },
            ].map(v => {
              const sel = vertical === v.id;
              return (
                <button key={v.id}
                  onClick={() => v.live && setVertical(v.id)}
                  disabled={!v.live}
                  style={{
                    appearance: 'none', border: 0, cursor: v.live ? 'pointer' : 'not-allowed',
                    textAlign: 'left', padding: '14px 18px', borderRadius: 14,
                    background: sel ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)',
                    border: sel ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.18)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    color: '#fff', opacity: v.live ? 1 : 0.55,
                    transition: 'all 180ms var(--ease-out)',
                  }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{v.label}</div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, opacity: 0.78,
                      letterSpacing: 0.1, textTransform: 'uppercase', marginTop: 2,
                    }}>{v.meta}</div>
                  </div>
                  {sel && (
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', background: 'var(--sun)',
                      color: 'var(--ink)', fontSize: 12, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>✓</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <CTADock>
          <PillCTA label="Drop the invite link" fill="white" onClick={onAdvance} />
        </CTADock>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenInitiator });
