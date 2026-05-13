// Surface 06 — Q4 · Vibe
// Cardinal scalar; canonical vocab is HUSHED → ROWDY (the "mood" register).
// The display-sized word rises on every change.

function ScreenQ4Vibe({ onAdvance }) {
  const [val, setVal] = React.useState(3);
  const word = VIBE_LABELS[val];

  return (
    <GradientSurface stop="q4">
      <div className="gti-canvas">
        <div className="content">
          <TopBar step={4} total={5} />
          <div style={{ height: 40 }} />
          <QuestionHeader
            index={4} total={5}
            title="What's the energy tonight?"
            sub="Slide it to where the group lands."
          />

          <div style={{
            flex: 1, padding: '40px 22px 0',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-start',
          }}>
            {/* huge live word */}
            <div style={{
              height: 124, display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative', width: '100%',
            }}>
              <div key={word} className="gti-display" style={{
                fontSize: 96, color: '#fff',
                letterSpacing: '-0.03em',
                animation: 'gti-rise 480ms var(--ease-out-soft) both',
              }}>{word}</div>
            </div>

            {/* 5-stop bar */}
            <div style={{
              width: '100%', display: 'flex', gap: 6, marginTop: 22,
            }}>
              {VIBE_LABELS.map((_, i) => (
                <button key={i} onClick={() => setVal(i)} style={{
                  appearance: 'none', border: 0, cursor: 'pointer',
                  flex: 1, height: 12, borderRadius: 999,
                  background: i === val ? 'var(--sun)' : 'rgba(255,255,255,0.22)',
                  boxShadow: i === val ? '0 0 18px rgba(255,210,63,0.6)' : 'none',
                  transition: 'all 200ms var(--ease-out)',
                  transform: i === val ? 'scaleY(1.4)' : 'scaleY(1)',
                }} />
              ))}
            </div>
            <div style={{
              marginTop: 16, width: '100%',
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, fontWeight: 700, letterSpacing: 0.12,
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
            }}>
              <span>{VIBE_LABELS[0]}</span>
              <span>{VIBE_LABELS[VIBE_LABELS.length-1]}</span>
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

Object.assign(window, { ScreenQ4Vibe });
