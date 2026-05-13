// Surface 08 — Waiting / coordination
// Honest, calm. No spinners.

function ScreenWaiting({ onAdvance }) {
  const people = [
    { name: 'You',  color: '#FFD23F', answered: true },
    { name: 'Alex', color: '#7DDFB5', answered: true },
    { name: 'Maya', color: '#FF8DA1', answered: true },
    { name: 'Sam',  color: '#9BC0FF', answered: false },
  ];
  const done = people.filter(p => p.answered).length;

  return (
    <GradientSurface stop="waiting">
      <div className="gti-canvas">
        <div className="content">
          <div style={{
            padding: '0 22px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <GTIMark size={16} />
            <div className="gti-eyebrow" style={{ color: '#fff', opacity: 0.6 }}>
              You're in
            </div>
          </div>

          <div style={{
            flex: 1, padding: '40px 22px 0',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', textAlign: 'center',
          }}>
            <div className="gti-display" style={{
              fontSize: 76, color: '#fff', letterSpacing: '-0.03em', lineHeight: 0.95,
            }}>{done} of {people.length}</div>
            <div className="gti-display" style={{
              fontSize: 34, color: 'rgba(255,255,255,0.85)',
              letterSpacing: '-0.02em', lineHeight: 1, marginTop: 6,
              textTransform: 'uppercase',
            }}>are in</div>

            <div style={{ display: 'flex', gap: 14, marginTop: 36 }}>
              {people.map(p => (
                <div key={p.name} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                  <AvatarDot {...p} size={48} />
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#fff',
                    letterSpacing: 0.1, textTransform: 'uppercase',
                    opacity: p.answered ? 1 : 0.55,
                  }}>{p.name}</div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 40,
              fontSize: 14, fontWeight: 600,
              color: 'rgba(255,255,255,0.78)', maxWidth: 260,
            }}>
              <span style={{ fontWeight: 800 }}>Sam</span> is still answering. We'll surface the verdict the second they're done — no spinners, promise.
            </div>
          </div>

          <CTADock>
            <PillCTA label="Nudge Sam" fill="ghost" onClick={onAdvance} />
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenWaiting });
