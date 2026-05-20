// Surface 03 — Q1 · Vetoes
// EBA veto, multi-select chips.  "Nothing tonight" is mutually exclusive with all others.

function ScreenQ1Vetoes({ onAdvance, onExit, role = 'initiator', solo = false }) {
  const [selected, setSelected] = React.useState(new Set(['shellfish']));
  const opts = ['Gluten','Dairy','Shellfish','Needs vegan options','Halal-only','Nothing tonight'];

  const toggle = (label) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (label === 'Nothing tonight') return s.has(label) ? new Set() : new Set([label]);
      s.delete('Nothing tonight');
      s.has(label) ? s.delete(label) : s.add(label);
      return s;
    });
  };

  return (
    <GradientSurface stop="q1">
      <div className="gti-canvas">
        <div className="content">
          {/* sg-WF-2: Q1 chrome — Exit only, no Back (no prior question). */}
          <QuizChrome canBack={false} role={role} solo={solo} onExit={onExit} />
          <TopBar step={1} total={5} />
          <div style={{ height: 40 }} />
          <QuestionHeader
            index={1} total={5}
            title="Any hard no's tonight?"
            sub="Tap everything that's off the table."
          />
          <div style={{
            padding: '24px 22px 0',
            display: 'flex', flexWrap: 'wrap', gap: 10,
          }}>
            {opts.map(o => (
              <Chip key={o} label={o}
                selected={selected.has(o)}
                onClick={() => toggle(o)} />
            ))}
          </div>
          <CTADock>
            <PillCTA label="Next" onClick={onAdvance} />
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenQ1Vetoes });
