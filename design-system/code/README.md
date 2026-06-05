# Code — Sunset Pop

Clean React/JSX source for every surface. **No tweak machinery** — all values are canonical defaults from the locked Sunset Pop direction.

This is what to lift into the active React Native / Expo app in `mobile/`. Read each `.jsx` alongside the matching `surfaces/0N-*.md` doc — the markdown carries the **why** (copy register, anti-patterns, design defenses), the JSX carries the **what**.

---

## Layout

```
code/
├── README.md            ← you are here
├── tokens.css           ← GENERATED from ../tokens.json — do not hand-edit.
│                          Re-run: node ../scripts/gen-css.mjs
├── components.jsx       ← shared: GradientSurface, TopBar, Chip, PillCTA, …
└── screens/
    ├── ScreenInitiator.jsx       ← S01
    ├── ScreenInviteUnfurl.jsx    ← S02a — iMessage link preview (canon)
    ├── ScreenInviteWeb.jsx       ← S02b — hosted fallback
    ├── ScreenQ1Vetoes.jsx        ← S03
    ├── ScreenQ2Budget.jsx        ← S04
    ├── ScreenQ3Distance.jsx      ← S05
    ├── ScreenQ4Vibe.jsx          ← S06
    ├── ScreenQ5Regret.jsx        ← S07
    ├── ScreenWaiting.jsx         ← S08
    ├── ScreenVerdict.jsx         ← S09 (modes: default | cuts | committed)
    ├── ScreenLocked.jsx          ← S10
    ├── ScreenReroll.jsx          ← S11
    └── ScreenCheckin.jsx         ← S12
```

## What's been stripped from the prototype

The full prototype in the project root has live tweak knobs for palette, grain, vibe vocab, verdict-reveal motion, hard-close motion, and invite mode. **None of that machinery is here.** What you see in the JSX is the locked canonical state:

| Stripped | Baked in |
|---|---|
| `palette` knob (sunset/citrus/noir) | `GTI_GRADIENTS` — sunset only |
| `grain` slider | grain at 0.35 in `.gti-grain` |
| `vibeVocab` knob | `VIBE_LABELS` = `['HUSHED','MELLOW','BUZZY','LOUD','ROWDY']` |
| `verdictReveal` motion variants | `VERDICT_CHOREO` constant — full 1.4s choreography |
| `closeMotion` variants | Shutter motion baked into `ScreenLocked.jsx` |
| `inviteMode` toggle | Split into two distinct screens (`InviteUnfurl` + `InviteWeb`) |
| Global hue offset | Removed |

If you ever want any of these back, the prototype repo has them.

## Dependencies

- **React 18.3.1** + ReactDOM (already in your stack or trivial to add)
- **Inter** font (Google Fonts) — weights 500/600/700/800/900
- **IBM Plex Mono** — used only in the hard-close timestamp footer
- No other JS deps. No build step required for the JSX itself if you keep Babel inline (prototype does this); the React Native app uses these screens as reference, not as runtime source.

## How to consume (web reference)

If you want to render any screen for visual reference in a standalone web context:

```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="tokens.css">
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" src="components.jsx"></script>
  <script type="text/babel" src="screens/ScreenVerdict.jsx"></script>
  <script type="text/babel">
    ReactDOM.createRoot(document.getElementById('root'))
      .render(<ScreenVerdict mode="default" />);
  </script>
</body>
</html>
```

## How to consume (React Native port)

Each `.jsx` maps to React Native components in `mobile/`. The translation is mechanical for the most part:

| JSX | React Native |
|---|---|
| `<GradientSurface stop="q1">` | Mobile gradient wrapper using the same surface stop key |
| `style={{display:'flex', flexDirection:'column'}}` | `<View style={{ flexDirection: 'column' }}>` |
| `style={{padding:'14px 22px'}}` | `paddingVertical: 14`, `paddingHorizontal: 22` |
| `style={{position:'absolute', inset: 0}}` | `StyleSheet.absoluteFillObject` |
| `.gti-grain` | Tiled image overlay at token opacity |
| `backdrop-filter: blur(...)` | Expo/native blur where available, otherwise token-matched fallback |
| `animation: 'gti-rise 700ms ...'` | Mobile animation with the same duration/easing token |
| `@property --g1` color tween | Animated color values keyed by surface stop |

See `../motion.md` §"Verdict reveal" for the explicit ms-by-ms timing table that the `ScreenVerdict.jsx` `VERDICT_CHOREO` constant encodes.

## Where to start

If you're porting screen-by-screen:

1. `tokens.css` + `components.jsx` → `mobile/src/design/` tokens + small component library (`GradientSurface`, chip, CTA, receipt primitives).
2. `ScreenVerdict.jsx` → this is the hero. Get it perfect first. Everything else hangs off it.
3. `ScreenQ1Vetoes.jsx` → the simplest quiz surface. Establishes the quiz skeleton (TopBar + QuestionHeader + content + CTADock).
4. The rest fall into place.
