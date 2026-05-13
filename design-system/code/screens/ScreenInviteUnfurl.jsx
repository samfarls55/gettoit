// Surface 02a — Invite unfurl (iMessage link preview)
// This is the link preview the recipient sees in their chat thread.
// Renders inside an iMessage-style chrome.  Not on a Sunset Pop gradient itself —
// the gradient lives INSIDE the unfurl card.

function ScreenInviteUnfurl({ onAdvance }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#000',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* iMessage thread chrome */}
      <div style={{
        padding: '64px 16px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#3A3A3C', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--ff-body)', fontWeight: 700, fontSize: 22,
        }}>M</div>
        <div style={{ fontFamily: '-apple-system', color: '#fff', fontSize: 13, fontWeight: 500, marginTop: 6 }}>Maya</div>
        <div style={{ fontFamily: '-apple-system', color: 'rgba(235,235,245,0.6)', fontSize: 11, marginTop: 2 }}>
          iMessage · Today 6:43 PM
        </div>
      </div>

      {/* messages */}
      <div style={{
        flex: 1, padding: '24px 16px 16px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{
          alignSelf: 'flex-start', maxWidth: '78%',
          background: '#26262A', color: '#fff',
          padding: '9px 14px', borderRadius: 20,
          fontFamily: '-apple-system', fontSize: 16, lineHeight: 1.3,
        }}>where we eating tonight</div>

        {/* the unfurl card — this is the surface we ship */}
        <div style={{
          alignSelf: 'flex-start', width: '88%',
          borderRadius: 18, overflow: 'hidden',
          marginTop: 6,
          boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
        }}>
          {/* hero */}
          <div style={{
            position: 'relative', height: 168,
            background: 'linear-gradient(180deg, #FF8868, #FF9F6B 35%, #FFB855 70%, #FFD23F)',
            padding: 16,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div className="gti-grain" style={{ opacity: 0.35 }} />
            <GTIMark size={14} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div className="gti-eyebrow" style={{
                color: '#fff', opacity: 0.85, marginBottom: 6, fontSize: 9,
              }}>Tonight's session</div>
              <div className="gti-display" style={{
                fontSize: 28, lineHeight: 0.88, color: '#fff',
                textTransform: 'uppercase',
              }}>Figure<br/>dinner<br/>out</div>
            </div>
          </div>
          {/* footer */}
          <div style={{
            background: '#1C1C1E', padding: '10px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontFamily: '-apple-system', fontSize: 13, color: '#fff', fontWeight: 500 }}>
                5 questions, ~60s · 4 invited
              </div>
              <div style={{ fontFamily: '-apple-system', fontSize: 11, color: 'rgba(235,235,245,0.5)', marginTop: 1 }}>
                gettoit.app
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* iMessage compose bar */}
      <div style={{
        padding: '8px 16px 18px', display: 'flex', gap: 8, alignItems: 'center',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: '#26262A',
          color: 'rgba(235,235,245,0.6)', fontSize: 22, fontWeight: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>+</div>
        <div style={{
          flex: 1, height: 34, borderRadius: 17,
          border: '1px solid rgba(235,235,245,0.18)',
          color: 'rgba(235,235,245,0.5)',
          fontFamily: '-apple-system', fontSize: 14,
          display: 'flex', alignItems: 'center', padding: '0 14px',
        }}>iMessage</div>
        <button onClick={onAdvance} style={{
          appearance: 'none', border: 0,
          background: 'var(--sun)', color: 'var(--ink)',
          fontWeight: 800, fontSize: 12, letterSpacing: 0.1,
          padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
        }}>OPEN</button>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenInviteUnfurl });
