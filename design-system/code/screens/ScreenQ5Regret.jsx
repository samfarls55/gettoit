// Surface 07 — Q5 · Regret rater
// THE ONLY surface in the system where multi-option rating is permitted.
// 3 candidates that cleared all EBA filters; user rates regret-of-omission per card.
// CTA flips to sun-yellow — the only quiz screen that telegraphs the verdict landing.

function ScreenQ5Regret({ onAdvance }) {
  const [ratings, setRatings] = React.useState({ pico: 5, ren: 2, pastoral: 4 });
  const places = [
    { id: 'pico',     name: "Pico's Taqueria", meta: 'Mexican · $$ · 8 min' },
    { id: 'ren',      name: 'Ren Soba House',  meta: 'Japanese · $$ · 12 min' },
    { id: 'pastoral', name: 'Bar Pastoral',    meta: 'Italian · $$ · 5 min' },
  ];

  return (
    <GradientSurface stop="q5">
      <div className="gti-canvas">
        <div className="content">
          <TopBar step={5} total={5} />
          <div style={{ height: 40 }} />
          <QuestionHeader
            index={5} total={5}
            title="If we don't go here, how much would you mind?"
            sub="Three places cleared everyone's filters. Rate each."
          />

          <div style={{
            marginTop: 22, padding: '0 22px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {places.map(p => (
              <Glass key={p.id} soft style={{ padding: 14, borderRadius: 18 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  marginBottom: 10,
                }}>
                  <div>
                    <div style={{
                      fontFamily: 'var(--ff-display)', fontWeight: 900,
                      fontSize: 17, color: '#fff', lineHeight: 1.1,
                    }}>{p.name}</div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, marginTop: 3,
                      color: 'rgba(255,255,255,0.7)',
                      letterSpacing: 0.08, textTransform: 'uppercase',
                    }}>{p.meta}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1,2,3,4,5].map(n => {
                    const sel = ratings[p.id] === n;
                    return (
                      <button key={n}
                        onClick={() => setRatings(r => ({...r, [p.id]: n}))}
                        style={{
                          appearance: 'none', border: 0, cursor: 'pointer',
                          flex: 1, minHeight: 44, borderRadius: 10,
                          background: sel ? 'var(--sun)' : 'rgba(255,255,255,0.10)',
                          color: sel ? 'var(--ink)' : '#fff',
                          fontFamily: 'var(--ff-body)', fontWeight: 800, fontSize: 14,
                          border: sel ? '0' : '1px solid rgba(255,255,255,0.22)',
                          boxShadow: sel ? '0 8px 18px rgba(255,210,63,0.32)' : 'none',
                          transition: 'all 180ms var(--ease-out)',
                        }}>{n}</button>
                    );
                  })}
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginTop: 6, fontSize: 9, fontWeight: 700, opacity: 0.6,
                  letterSpacing: 0.12, textTransform: 'uppercase', color: '#fff',
                }}>
                  <span>Don't mind</span>
                  <span>Really mind</span>
                </div>
              </Glass>
            ))}
          </div>

          <CTADock>
            <PillCTA label="Drop the verdict" fill="sun" onClick={onAdvance} />
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenQ5Regret });
