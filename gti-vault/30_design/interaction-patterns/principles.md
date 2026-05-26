---
title: Principles — cognition, visual, system audit gates
purpose: Cross-cutting audit checks that apply to every surface regardless of which pattern it uses
---

# Principles

Three layers of audit gates. Run **before** drilling into named patterns. Failure on any of these is grounds for rework regardless of which patterns the surface uses. Source: Tidwell/Brewer/Valencia *Designing Interfaces* 3rd ed., chapters 1, 5, 11–12.

- **P-01..P-13** — Cognition + behavior. How users actually perceive and use software (ch.1). Run on every surface.
- **V-01..V-06** — Visual style. Whether visual choices reinforce — or fight — the interaction (ch.5). Most token concerns live in repo-root `design-system/`; these are workflow-impacting lenses.
- **S-01..S-06** — System discipline. Whether the codebase treats UI as a system (ch.11–12). Prerequisite to consistent pattern execution.
- **B-01..B-04** — Beyond-the-screen. Connected devices, anticipatory systems, assistive inputs, natural UIs. Flag only when relevant.

Foundation violations tend to be **systemic** (whole app has bug). Pattern misuses tend to be **local** (one screen). Report should separate the two.

---

## Cognition + behavior (P-01..P-13)

### P-01. Safe Exploration

- **Mindset**: *"Let me explore without getting lost or getting in trouble."*
- **Check**: Can user click any visible control without irreversible loss, lost data, modal traps? Always a Back / Undo / Cancel?
- **Signals present**: Multilevel undo, Back works everywhere, cancel works during long ops, no surprise side-effects (autoplay, hijacked nav).
- **Red flags**: Destructive primary actions without confirm+undo; nav traps; auto-submit on blur with no undo.
- **Related patterns**: [[patterns#Multilevel Undo]], [[patterns#Cancelability]], [[patterns#Escape Hatch]].

### P-02. Instant Gratification

- **Mindset**: *"I want to accomplish something now, not later."*
- **Check**: Can brand-new user complete first useful action in seconds, before registration / tutorial / consent wall?
- **Signals present**: First useful action on first screen; deferred sign-up; no required modal on cold start except OS prompts.
- **Red flags**: Forced sign-up before any value; mandatory tour; multi-step onboarding before any task.
- **Related patterns**: [[patterns#Clear Entry Points]], [[patterns#Mobile Direct Access]].

### P-03. Satisficing

- **Mindset**: *"Good enough. Not going to spend more time learning."*
- **Check**: User *scanning* (not reading) picks right control on first guess? Labels short, plain, meaningful?
- **Signals present**: Short plain labels; CTAs name the verb ("Save", "Buy"); layout communicates meaning before text read.
- **Red flags**: Marketing-speak labels; clever icon-only buttons no tooltip; long instructional copy before any control.
- **Related patterns**: [[patterns#Prominent "Done" Button or Assumed Next Step]], [[patterns#Smart Menu Items]], [[patterns#Input Hints]].

### P-04. Changes in Midstream

- **Mindset**: *"I changed my mind about what I was doing."*
- **Check**: Can user switch tasks midway, save state, come back? Or locked into linear flow?
- **Signals present**: Form state survives navigation; multiple workspaces; non-modal where possible.
- **Red flags**: Modal-only flows for long tasks; cleared form on tab-switch; no draft-saving.
- **Related patterns**: [[patterns#Many Workspaces]], [[patterns#Wizard]] (reentrance-aware only).

### P-05. Deferred Choices

- **Mindset**: *"Don't ask me that now; just let me finish."*
- **Check**: Required fields actually required *at this step*? Optional fields clearly marked?
- **Signals present**: Short required-field set; defaults pre-filled; "change later" affordances; sign-up-after-value patterns.
- **Red flags**: 20-field registration before any value; "select category" gates before browsing.
- **Related patterns**: [[patterns#Good Defaults and Smart Prefills]], [[patterns#Wizard]].

### P-06. Incremental Construction

- **Mindset**: *"Let me change this. Doesn't look right; change again."*
- **Check**: On Make surfaces, feedback near-instant? User iterates in small steps?
- **Signals present**: Live preview; <500ms feedback on edits; non-blocking saves; reorderable / undoable construction.
- **Red flags**: Mandatory save-then-render cycle; long compile-feedback delays; modal "preview" windows.
- **Related patterns**: [[patterns#Preview]], [[patterns#Canvas Plus Palette]], [[patterns#Multilevel Undo]].

### P-07. Habituation

- **Mindset**: *"That gesture works everywhere else; why not here?"*
- **Check**: Platform-standard gestures, shortcuts, controls do what users expect everywhere?
- **Signals present**: Ctrl-S saves; Esc dismisses modals; Back navigates back; swipe gestures consistent.
- **Red flags**: One screen overrides standard gesture; modal traps Esc; Back overridden; confirmation dialogs user habitually clicks past (defeats protection).
- **Related patterns**: [[patterns#Sign-In Tools]] (placement), all platform-standard controls.

### P-08. Microbreaks

- **Mindset**: *"Waiting for train. Two minutes useful."*
- **Check**: Mobile especially — returning user opens app and consumes/contributes value in <5s no setup?
- **Signals present**: Persistent auth; restore-to-where; freshest content first; quick triage (star, archive, delete).
- **Red flags**: Cold-start sign-in every session; slow landing; "today's feed" not first; no quick triage.
- **Related patterns**: [[patterns#Streams and Feeds]], [[patterns#Infinite List]], [[patterns#Mobile Direct Access]].

### P-09. Spatial Memory

- **Mindset**: *"I swear that button was here a minute ago."*
- **Check**: Controls stay in consistent locations across screens, sessions, visits?
- **Signals present**: Stable nav placement; OK/Cancel in predictable positions; "recently used" appends rather than reorders.
- **Red flags**: Auto-resorting menus; A/B tests moving primary CTAs between sessions; dynamic chrome reflows.
- **Related patterns**: [[patterns#Visual Framework]], [[patterns#Movable Panels]] (user-controlled OK, system-controlled not).

### P-10. Prospective Memory

- **Mindset**: *"Putting this here to remind myself to deal with it later."*
- **Check**: App lets users leave artifacts (drafts, flags, tabs, notes) as own reminders? Or "helpfully" cleans up?
- **Signals present**: Drafts persist; bookmarks/stars/flags; closed-without-saving recovers; nothing auto-deletes idle state.
- **Red flags**: Auto-clear unsaved data; auto-archive "stale"; auto-close "unused" tabs; over-eager GC.
- **Related patterns**: [[patterns#Many Workspaces]], [[patterns#Tags]].

### P-11. Streamlined Repetition

- **Mindset**: *"Repeat this how many times?"*
- **Check**: For repeated tasks, one-action repeat (shortcut, macro, batch, copy-paste)?
- **Signals present**: Bulk operations; Find/Replace; recorded actions/macros; keyboard shortcuts on high-traffic actions.
- **Red flags**: Multi-select with no batch action; "one at a time" workflows; no shortcuts on most-used actions.
- **Related patterns**: [[patterns#Macros]], [[patterns#Command History]], [[patterns#Smart Menu Items]].

### P-12. Keyboard Only

- **Mindset**: *"Please don't make me use the mouse."*
- **Check**: Every primary task completable via keyboard? Predictable Tab order? Accessible focus indicators?
- **Signals present**: Tab traversal works; visible focus rings; arrows move list selection; Enter activates default; Esc cancels; standard shortcuts wired.
- **Red flags**: Tab order skips controls or visual-disorder; click-only menus; primary action no Enter binding; controls only hover-reachable.
- **Related patterns**: All form patterns, [[patterns#Sign-In Tools]], [[patterns#Smart Menu Items]].

### P-13. Social Proof + Collaboration

- **Mindset**: *"What did everyone else say?"*
- **Check**: Where decisions made / content consumed, peer signal layer (reviews, ratings, "N others did", co-presence)? Collab affordance where plausible?
- **Signals present**: Reviews/ratings; "N looking at this"; share affordances; collaborative edit/discussion; activity feeds.
- **Red flags**: Decision UI in silence; collab-shaped task forced single-user; share buttons to dead-ends.
- **Related patterns**: [[patterns#Help Systems]], social cues across nav + lists.

---

## Visual style (V-01..V-06)

Workflow-impacting visual checks. Most token mechanics live in repo-root `design-system/`. These lenses surface visual choices that defeat interaction.

### V-01. Visual hierarchy

- **Check**: Most important action / info *looks* most important (size, weight, color, position)?
- **Sub-checks**: Clarity, Actionability, Affordance (clickables look clickable), Composition, Consistency, Alignment.
- **Red flag**: Primary CTA same emphasis as tertiary links; multiple competing primaries; emphasis-by-blink.
- **Defeats**: [[#P-03. Satisficing]] when wrong.

### V-02. Color

- **Check**: Survives desaturation test? Color-only signals reinforced with shape/text (color-blindness)?
- **Sub-checks**: Dark/light contrast; warm/cool intent matches mood; complementary clashes avoided; long-use designs toned down.
- **Red flag**: Error/success only red/green; insufficient WCAG AA contrast; full-saturation surfaces in long-session apps.

### V-03. Typography

- **Check**: Body >=10pt (12pt standard)? Leading generous? Type ramp consistent across screens?
- **Sub-checks**: One main body face; secondary faces small areas only; kerning sane on headlines.
- **Red flag**: Multiple body faces; sub-9pt copy; tight leading on long-form; jumbled ramp.

### V-04. Readability

- **Check**: Typical user reads it under typical conditions (sun, small screen, bifocals)? Line length 45-75ch?
- **Red flag**: >75ch lines; low-contrast gray-on-white body; text inside dense imagery.

### V-05. Evoking a feeling

- **Check**: Visual register (warm/cool, spacious/dense, classical/modern) matches brand + user's emotional state on arrival?
- **Sub-checks**: Spacious (calm) vs crowded (urgent); angles vs curves; cultural references appropriate; motifs unify.
- **Red flag**: Playful illustration on safety-critical panel; dense industrial layout on leisure app; cultural refs audience won't get.

### V-06. Images

- **Check**: Images carry meaning beyond decoration? Sensible empty/placeholder state?
- **Red flag**: Stock photography contradicting product voice; images blocking content load; missing alt text.

### Accessibility cross-cut

- **Check**: Works with OS high-contrast, OS large-text, screen readers?
- **Required**: WCAG 4.5:1 on body; focus indicators on every focusable control; semantic markup; alt text on meaningful images.
- **Red flag**: Color-only state; text-as-image; focus indicators reset by CSS.

### Visual style range

Pick one consciously per product. Mixing styles across one product = strong red flag.

| Style | When to choose | Signal |
| --- | --- | --- |
| Skeuomorphic | Novel interaction; metaphor accelerates learning. | UI mimics real surfaces. |
| Illustrated | Brand wants warmth, approachability. | Bespoke illustration core to onboarding/empty. |
| Flat | Clarity-first; multi-platform; content over chrome. | Solid fills, minimal shadow, clear iconography. |
| Minimalistic | Task-based; doing > browsing. | Few UI cues; gesture + position. |
| Adaptive / Parametric | Camera/AR/data-driven UI emerging with object. | UI invisible until right context. |

---

## System discipline (S-01..S-06)

Audit lenses on whether the codebase treats UI as a system. Prerequisite to consistent pattern execution.

### S-01. Design system exists + enforced

- **Check**: Single source of truth for tokens + component primitives? Screens consume rather than redefine?
- **Signals present**: `design-system/` package; tokens (color/type/space/motion); shared component lib imported by every screen; lint/PR rules blocking raw screen styles.
- **Red flag**: Inline styles diverging across screens; control copies with drifting padding/colors; per-screen CSS bundles redefining primitives.

### S-02. Atomic-design hierarchy visible in code

Five layers; codebase should reflect them:

| Layer | Definition | Example |
| --- | --- | --- |
| Atoms | Smallest indivisible units | Input, label, color token, typeface |
| Molecules | 2+ atoms forming working component | Form field = input + label + hint + prompt |
| Organisms | Complex objects assembling molecules | Header = logo + nav + search + sign-in tools + avatar |
| Templates | Layout recipes; page-level scaffolds no content | Report-with-chart, list-with-detail |
| Pages | Templates filled with real content | Specific dashboard / article |

- **Check**: Each layer locatable in code? Templates explicit, not one-off layouts?
- **Red flag**: No template layer; atomic component inline-edited in one screen, forking from system.

### S-03. UI framework choice + discipline

- **Check**: Which framework / design system underlies the app? Framework components used or hand-rolled? Overrides isolated + documented?
- **Signals present**: One framework; theming layer for brand; almost no per-screen forks.
- **Red flag**: Multiple frameworks coexisting; framework overridden so aggressively semantics lost; custom component reinventing framework primitive.

### S-04. Style inheritance + propagation

- **Check**: Change one token, every consumer picks it up automatically?
- **Signals present**: CSS variables / theme tokens consumed by every component; design tokens shared design-tools+code (Style Dictionary / Tokens Studio).
- **Red flag**: Hardcoded hex scattered through screen code; theme switch breaks visuals; token change requires touching N screens.

### S-05. Responsive + cross-platform consistency

- **Check**: Same user task looks + behaves consistently across browsers, devices, screen sizes? Platform-specific component variants (date picker iOS/Android/web) handled by framework not by screen?
- **Red flag**: Per-platform divergent screens forked at page level; mobile + desktop drift; one platform missing components other has.

### S-06. Framework as floor, not ceiling

- **Check**: Team customized + extended framework where it serves product, while still consuming primitives for common cases? Or accepted defaults uncritically?
- **Over-customization red flag**: Every primitive custom; framework no longer recognizable; no benefit from upgrades.
- **Under-customization red flag**: Product looks identical to every Bootstrap/Material default; no brand voice; "designed by template."

---

## Beyond-the-screen (B-01..B-04)

Flag only when relevant.

### B-01. Connected devices

Non-app device interaction (speakers, IoT, wearables) consistent with screen experience?

### B-02. Anticipatory systems

Auto-suggest / auto-order / auto-trigger has clear consent, undo, explanation of *why*? Silent automation violates [[#P-01. Safe Exploration]].

### B-03. Assistive systems

Voice, switch, eye-tracking inputs reach completion on primary tasks? See [[#P-12. Keyboard Only]].

### B-04. Natural user interfaces

Touch/gesture/voice affordances discoverable? Fallback for users who can't or won't?

---

## How to use

1. Inventory surfaces.
2. Run **all P-01..P-13** on each surface (yes/no). Failure = systemic, top priority.
3. Run **V-01..V-06** as visual sanity check.
4. Run **S-01..S-06** once across codebase (not per-surface). If S-01 fails, fixing individual patterns is whack-a-mole.
5. Drill to [[patterns]] only after gates pass.
