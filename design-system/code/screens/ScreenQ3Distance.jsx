// Surface 05 — Q3 · Distance (walk time)
// EBA veto threshold.  Number is shown at display scale to rehearse the constraint.

function ScreenQ3Distance({ onAdvance, onBack, onExit, role = 'initiator', solo = false }) {
  const [val, setVal] = React.useState(15);
  const ticks = [5, 10, 15, 20, 30];

  return (
    <GradientSurface stop="q3">
      <div className="gti-canvas">
        <div className="content">
          {/* sg-WF-2: Q3 chrome — Back + Exit. */}
          <QuizChrome role={role} solo={solo} onBack={onBack} onExit={onExit} />
          <TopBar step={3} total={5} />
          <div style={{ height: 40 }} />
          <QuestionHeader
            index={3} total={5}
            title="How far is too far?"
            sub="Max walk from here, right now."
          />
          <div style={{ marginTop: 36, padding: '0 22px', textAlign: 'center' }}>
            <div className="gti-display" style={{
              fontSize: 100, lineHeight: 0.9, color: '#fff',
              letterSpacing: '-0.04em',
            }}>
              {val}<span style={{
                fontSize: 36, fontWeight: 700, opacity: 0.7,
                marginLeft: 6, verticalAlign: 'super',
                letterSpacing: 0.08, textTransform: 'uppercase',
              }}>min</span>
            </div>
            <div style={{
              marginTop: 26, display: 'flex', gap: 6, justifyContent: 'space-between',
            }}>
              {ticks.map(t => {
                const sel = val === t;
                return (
                  <button key={t} onClick={() => setVal(t)} style={{
                    appearance: 'none', border: 0, cursor: 'pointer',
                    flex: 1, padding: '12px 0',
                    borderRadius: 12,
                    background: sel ? 'var(--sun)' : 'rgba(255,255,255,0.08)',
                    color: sel ? 'var(--ink)' : '#fff',
                    fontFamily: 'var(--ff-body)', fontWeight: 800, fontSize: 14,
                    border: sel ? '0' : '1px solid rgba(255,255,255,0.32)',
                    boxShadow: sel ? '0 10px 22px rgba(255,210,63,0.32)' : 'none',
                    transition: 'all 180ms var(--ease-out)',
                  }}>{t}</button>
                );
              })}
            </div>
            <div style={{
              marginTop: 14, display: 'flex', justifyContent: 'space-between',
              fontSize: 10, fontWeight: 700, letterSpacing: 0.12,
              textTransform: 'uppercase', opacity: 0.6,
            }}>
              <span>Around the corner</span>
              <span>Half a city</span>
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

Object.assign(window, { ScreenQ3Distance });
