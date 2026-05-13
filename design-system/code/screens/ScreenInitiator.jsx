// Surface 01 — Initiator landing
// Pick a vertical, set timer + radius (sensible defaults for zero-tap path),
// drop the invite link.

function ScreenInitiator({ onAdvance }) {
  const [vertical, setVertical] = React.useState('food');
  const [timer, setTimer] = React.useState(10);          // minutes
  const [radius, setRadius] = React.useState(2.0);       // miles

  const TIMER_OPTIONS = [5, 10, 15, 30];

  return (
    <GradientSurface stop="initiator">
      <div style={{
        position: 'absolute', inset: 0,
        padding: '64px 22px 24px',
        display: 'flex', flexDirection: 'column', color: '#fff',
      }}>
        <GTIMark size={22} />

        <div style={{ marginTop: 32 }}>
          <Eyebrow style={{ marginBottom: 14 }}>Tonight's session</Eyebrow>
          <h1 className="gti-display" style={{
            fontSize: 52, lineHeight: 0.88, margin: 0,
            textTransform: 'uppercase',
          }}>
            Figure<br/>it out<br/>together
          </h1>
          <p style={{
            margin: '18px 0 0', fontSize: 15, fontWeight: 600,
            color: 'rgba(255,255,255,0.84)', maxWidth: 280,
          }}>Five quick taps each. One verdict. Sixty seconds.</p>
        </div>

        {/* Timer chip group + radius slider — set expectations, not configure */}
        <div style={{ marginTop: 24 }}>
          <Eyebrow style={{ marginBottom: 8, opacity: 0.6 }}>How long</Eyebrow>
          <div style={{ display: 'flex', gap: 8 }}>
            {TIMER_OPTIONS.map(m => {
              const sel = timer === m;
              return (
                <button key={m}
                  onClick={() => setTimer(m)}
                  aria-pressed={sel}
                  aria-label={`${m} minute timer`}
                  style={{
                    appearance: 'none', cursor: 'pointer',
                    flex: 1, minHeight: 44,
                    padding: '10px 0', borderRadius: 999,
                    fontFamily: 'var(--ff-body)',
                    fontSize: 14, fontWeight: 800,
                    letterSpacing: 0.08,
                    background: sel ? 'var(--sun)' : 'rgba(255,255,255,0.04)',
                    color: sel ? 'var(--ink)' : '#fff',
                    border: sel ? '1.5px solid transparent' : '1.5px solid rgba(255,255,255,0.55)',
                    boxShadow: sel
                      ? '0 8px 22px rgba(255,210,63,0.35), 0 0 0 4px rgba(255,210,63,0.18), inset 0 1px 0 rgba(255,255,255,0.5)'
                      : 'none',
                    backdropFilter: sel ? 'none' : 'blur(4px)',
                    WebkitBackdropFilter: sel ? 'none' : 'blur(4px)',
                    transition: 'all 180ms var(--ease-out)',
                    transform: sel ? 'scale(1.02)' : 'scale(1)',
                  }}>{m} MIN</button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 2,
          }}>
            <Eyebrow style={{ opacity: 0.6 }}>How far</Eyebrow>
            <span style={{
              fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 500,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.88)',
            }}>{radius.toFixed(1)} MI</span>
          </div>
          <RangeSlider
            value={radius} min={0.5} max={5.0} step={0.5}
            onChange={setRadius}
            ariaLabel="Walk radius"
            valueLabel={`${radius.toFixed(1)} miles`}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <Eyebrow style={{ marginBottom: 8, opacity: 0.6 }}>Pick a vertical</Eyebrow>
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
                    textAlign: 'left', padding: '12px 18px', borderRadius: 14,
                    background: sel ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)',
                    border: sel ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.18)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    color: '#fff', opacity: v.live ? 1 : 0.55,
                    transition: 'all 180ms var(--ease-out)',
                  }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>{v.label}</div>
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
