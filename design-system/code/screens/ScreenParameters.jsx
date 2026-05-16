// Surface 01b — Pre-quiz parameters setup (initiator)
//
// TB-05 (v1.1). The *parameters* bucket of the three-bucket input
// model. Shown to the session initiator after S01 and before the
// quiz. Captures the session-wide settings every participant shares:
// meal time, group context, service shape, transport mode. Geography
// is captured on S01 (C-23 LocationPicker) and only echoed here,
// read-only. Joiners never see this surface — they read the
// parameters back off the room and skip straight to the quiz.
//
// Built from existing primitives only — Chip (C-04, single-select
// variant), Glass row (geography echo), Eyebrow, GTIMark, PillCTA.
// No new visual component is introduced; this is a new SURFACE
// composed of locked components, per the v1.1 PRD module (K) note
// ("consumes existing tokens and components").

const MEAL_TIMES    = ['Breakfast', 'Lunch', 'Dinner', 'Late night'];
const GROUP_CONTEXTS = ['Just me', 'Two of us', 'A group'];
const SERVICE_SHAPES = ['Dine in', 'Outdoor seating', 'Takeout', 'Delivery'];
const TRANSPORT_MODES = ['Walking', 'Driving'];

function ScreenParameters({ locationName = 'Mission · San Francisco', onContinue }) {
  const [mealTime, setMealTime] = React.useState('Dinner');
  const [groupContext, setGroupContext] = React.useState('A group');
  const [serviceShape, setServiceShape] = React.useState('Dine in');
  const [transportMode, setTransportMode] = React.useState('Walking');

  const Section = ({ eyebrow, options, value, onPick }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Eyebrow opacity={0.6}>{eyebrow}</Eyebrow>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => (
          <Chip
            key={opt}
            label={opt.toUpperCase()}
            selected={value === opt}
            onClick={() => onPick(opt)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <GradientSurface stop="initiator">
      <div className="gti-canvas">
        <div className="content" style={{ overflowY: 'auto' }}>
          <div style={{ padding: '64px 24px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Eyebrow opacity={0.78}>BEFORE THE QUIZ</Eyebrow>
              <div className="gti-display" style={{
                fontSize: 44, lineHeight: 0.92, letterSpacing: '-0.025em',
                color: '#fff', textTransform: 'uppercase',
              }}>Set the<br/>ground rules</div>
              <div style={{
                fontSize: 16, fontWeight: 600, maxWidth: 300,
                color: 'rgba(14,16,17,0.78)',
              }}>
                These apply to everyone. Your friends skip straight to the quiz.
              </div>
            </div>

            {/* geography — read-only echo of the S01 LocationPicker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Eyebrow opacity={0.6}>WHERE</Eyebrow>
              <Glass soft style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px', minHeight: 48, borderRadius: 18,
              }}>
                <span aria-hidden="true">📍</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                  {locationName}
                </span>
              </Glass>
            </div>

            <Section eyebrow="WHEN ARE YOU EATING"
              options={MEAL_TIMES} value={mealTime} onPick={setMealTime} />
            <Section eyebrow="WHO'S COMING"
              options={GROUP_CONTEXTS} value={groupContext} onPick={setGroupContext} />
            <Section eyebrow="HOW YOU WANT TO EAT"
              options={SERVICE_SHAPES} value={serviceShape} onPick={setServiceShape} />
            <Section eyebrow="HOW YOU'LL GET THERE"
              options={TRANSPORT_MODES} value={transportMode} onPick={setTransportMode} />

            <div style={{ height: 8 }} />

            <CTADock>
              <PillCTA label="Start the quiz" onClick={onContinue} />
            </CTADock>
          </div>
        </div>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenParameters });
