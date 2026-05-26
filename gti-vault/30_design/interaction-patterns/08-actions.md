---
title: Doing Things — Actions and Commands
source_chapter: 8 — Doing Things: Actions and Commands
purpose: Catalog of Chapter 8's action and command patterns, with audit-ready signals
---

# Doing Things — Actions and Commands

Patterns for exposing user-initiated actions: buttons, menus, panels, hover tools, previews, progress, cancel, undo, history, and macros. The audit lens is: for every action the user must perform, is the affordance visible enough, scoped tightly to its target, reversible where possible, and consistent with the platform vocabulary?

## Action vocabulary

A checklist of action affordances (Ch.8 intro, pp.377-382). For each surface, audit each row: does the affordance match user expectation for this platform and this scope?

- **Tap / Swipe / Pinch** — primary mobile gestures; tap selects/activates, swipe navigates or reveals row actions, pinch zooms.
- **Rotate / Shake** — whole-device gestures; rotate flips viewport orientation, shake commonly triggers undo or skip.
- **Buttons** — always-visible affordances; high discoverability, high screen cost; use for the primary call to action.
- **Menu Bars** — desktop top-of-window menus enumerating the full action set; accessibility-critical, screen-reader friendly, support keyboard accelerators.
- **Pop-Up Menus** — right-click / long-press context menus showing context-specific actions; keep them short.
- **Drop-Down Menus** — combo-box-style choosers; reserve for *settings*, not actions.
- **Toolbars** — long thin strip of icon (and small-text) buttons; works only when icons are unambiguous.
- **Links** — borderless clickable text; for low-emphasis actions that shouldn't draw attention.
- **Action Panels** — always-visible, on-canvas menu replacements (see pattern).
- **Hover Tools** — actions revealed on mouse hover (see pattern); never for touch-only surfaces.
- **Single vs Double Click** — single = select; double = open/launch/edit. Don't conflate.
- **Keyboard Actions** — covers shortcuts and tab order, both required for accessibility and expert speed.
- **Shortcuts** — Ctrl-/Cmd- key combos for common verbs; mirror platform standards (Ctrl-S = save).
- **Tab Order** — predictable focus traversal of interactive elements; required for keyboard-only operation.
- **Drag-and-Drop** — context-dependent, but almost always means "move this here" or "do this to that".
- **Typed Commands** — CLI / SQL / search-query inputs; powerful but undiscoverable; for committed users.
- **Affordance** — every interesting visual feature should look like it does something (shadow, border, hover state, distinct shape).
- **Direct Manipulation** — act on the object itself (tap, swipe, drag, pinch) instead of select-then-act; the default mental model for mobile.

## Patterns

### Button Groups

- Use when: There are many always-visible actions on a surface and some of them are semantically related; you need to organise them so the layout doesn't read as chaos.
- What it is: A small cluster of buttons aligned and visually styled the same way, sharing scope (app-wide, per-item, per-document, etc.).
- Why it works: Gestalt proximity and similarity announce "these belong together"; uniform sizing creates a composite shape via closure; primary action standing out provides hierarchy.
- How to apply:
  - Group only buttons that share scope and verb-family; separate buttons with different scope.
  - Match graphic treatment: border, color, height, icon style, hover behaviour.
  - Use short unambiguous verbs / verb phrases.
  - Place groups adjacent to their target object (left, right, or above — bottom blind spots are real).
  - Promote a single primary action with a stronger graphic treatment.
- Signals present (in code/spec): A `ButtonGroup` / `HStack` component containing buttons with shared styling; toolbars structured as labelled segments separated by dividers.
- Signals missing (red flag): A flat row of styled-differently buttons jumbled together; no visible primary action on a surface that has an obvious next step.
- Anti-patterns / mis-applications: Mixing app-level and item-level actions in the same group; treating every button as a primary with a saturated color (nothing stands out).
- Related: [[#Prominent "Done" Button or Assumed Next Step]], [[04-layout#Visual Framework]]

### Hover or Pop-Up Tools

- Use when: A mouse-driven list where each item supports several actions, and showing every action on every row would clutter the surface.
- What it is: Buttons or controls placed next to an item but kept hidden until the pointer hovers (mouse) or the item is tapped (touch surfaces use a pop-up panel instead).
- Why it works: Keeps the resting UI clean; reveals tools exactly where and when needed; the rollover gesture itself draws attention.
- How to apply:
  - Reserve enough space in each row so revealed tools don't reflow neighbours.
  - Show/hide instantly — no animated transitions.
  - Optionally highlight the hovered row to reinforce the focus.
  - On touch, replace hover with a tap-revealed pop-up panel anchored to the item.
- Signals present (in code/spec): Row components with CSS `:hover` toggling tool visibility; React `onMouseEnter`/`onMouseLeave` controlling a per-row tool overlay.
- Signals missing (red flag): Long lists where the only way to delete/archive/share an item is a top-of-screen toolbar requiring a prior selection step; cluttered rows where every action is rendered always.
- Anti-patterns / mis-applications: Hover Tools on a touch-only surface (no hover state exists); animated reveals that delay access to the tool.
- Related: [[#Action Panel]], [[07-lists#List Inlay]], [[10-forms#Dropdown Chooser]]

### Action Panel

- Use when: A surface has too many possible actions for hover/per-item tools and too many or too non-linear for a menu bar; actions need to be highly visible and discoverable.
- What it is: A panel — often beside or beneath the target — that displays grouped actions as a free-form, structured menu always rendered on the main UI.
- Why it works: Full visibility removes the discovery cost of hidden menus; free-form layout lets you organise actions by task instead of forcing a linear list; can change contents based on selection/state.
- How to apply:
  - Place beside or beneath the target object; proximity makes the link.
  - Structure actions however the task demands: simple list, multicolumn, categorised headings, tables, trees, or a mix.
  - Choose label style — text, icons, or both — based on what conveys the action best; longer labels are OK for occasional users.
  - Let the panel be dynamic — show different actions in different contexts.
  - If closable, make reopening trivial; never hide actions that exist only there.
- Signals present (in code/spec): A persistent side panel or drawer component that reads selection state and renders contextual action lists; route-level shells that always render an action sidebar.
- Signals missing (red flag): Hard-to-find actions stuffed into a kebab menu on a surface with screen space to spare; new users unable to discover what the screen can do.
- Anti-patterns / mis-applications: Action Panel on small mobile screens where it crowds out content; static panel that never reflects what's selected (forces a hunt every time).
- Related: [[#Button Groups]], [[04-layout#Movable Panels]], [[04-layout#Center Stage]]

### Prominent "Done" Button or Assumed Next Step

- Use when: A screen, form, or transaction has an obvious final step — Submit, Done, Continue, Buy, Send.
- What it is: A visually prominent button that lands exactly where the user's eye comes to rest at the end of the task flow.
- Why it works: Gives closure — the user has no doubt the transaction will complete; layout hierarchy and visual flow funnel attention to that one button.
- How to apply:
  - Style as a real button (border, fill, size), not a link.
  - Place at the end of the task flow's visual path — usually bottom-right or below the last field.
  - Use a specific verb where possible ("Send", "Buy", "Change Record") over generic "Done"/"Submit".
  - Set off with whitespace and contrasting color; keep adjacent to the last input so the user doesn't hunt.
- Signals present (in code/spec): A single `<PrimaryButton>` per form/screen, styled distinctly from `<SecondaryButton>`; design tokens for `primary`/`secondary` action color.
- Signals missing (red flag): Form with three equally weighted buttons at the bottom and no clear "next"; primary action rendered as a text link far from the last field.
- Anti-patterns / mis-applications: Multiple equally prominent primaries on one screen splitting the user's attention; icon-only primary buttons that force interpretation work.
- Related: [[#Button Groups]], [[01-foundations-cognition#P-03. Satisficing]], [[04-layout#Visual Framework]]

### Smart Menu Items

- Use when: Menu items, button labels, or links that operate on a specific object or context (Close X, Undo Y, Delete Z) where the target can change at runtime.
- What it is: Labels that dynamically include the name of the object or last action they will affect, instead of generic verbs.
- Why it works: The UI becomes self-explanatory; reduces accidental destructive operations; supports Safe Exploration.
- How to apply:
  - When selection or last action changes, update the label to include the specific name ("Undo Increase Clarity", "Delete 'Chapter 8'").
  - Disable the item entirely when there is no valid target.
  - For multi-selection, use plural form ("Delete Selected Objects").
  - Apply equally to buttons, links, tooltips — not only menu bars.
- Signals present (in code/spec): Menu/button labels built from a template that interpolates `currentSelection.name` or `lastAction.name`; disabled state bound to selection.
- Signals missing (red flag): "Delete" / "Undo" labels that never specify *what* — user has to remember context to act safely.
- Anti-patterns / mis-applications: Smart labels that overflow narrow menus, truncating mid-word; using object IDs instead of human names ("Delete 0x7F3E").
- Related: [[#Multilevel Undo]], [[#Cancelability]], [[01-foundations-cognition#P-01. Safe Exploration]]

### Preview

- Use when: The user is about to commit a heavyweight action (large file open, multi-page print, form submit, purchase, irreversible photo filter) and needs reassurance the outcome will be right.
- What it is: A lightweight rendering of the action's likely result, shown *before* commit, with one-click commit and an escape hatch.
- Why it works: Prevents errors caused by typos or misunderstandings; makes the action self-describing — the user learns the verb by seeing its effect.
- How to apply:
  - Show only what's relevant to confirming the outcome — print layout, image-with-filter, transaction summary.
  - Include a commit control directly on the preview surface.
  - Provide a back / cancel / "change X" path for every editable input that fed into the preview.
  - For multi-option actions (filters, skin tones, configurations), render a preview per option so the user picks by recognition.
- Signals present (in code/spec): A `ReviewOrder` / `PreviewFilter` / `PrintPreview` screen between the form and the commit endpoint; thumbnail-per-option components.
- Signals missing (red flag): One-shot destructive or expensive actions that commit on first click with no intermediate review.
- Anti-patterns / mis-applications: Preview screens that strip out "Edit" links so the user has to navigate all the way back to the start to fix one field; previews that take longer to render than the action itself.
- Related: [[#Cancelability]], [[#Multilevel Undo]], [[10-forms#Forgiving Format]]

### Spinners and Loading Indicators

- Use when: A user-initiated operation will take longer than ~1 second, blocking the UI or running in the background.
- What it is: A spinner (stateless animation) for short waits; a loading indicator (meter with percent / bytes / time-remaining) for longer ones.
- Why it works: Tells the user the system is alive; experiments show users tolerate longer waits when there is feedback; sets expectation for "wait" vs "switch tasks".
- How to apply:
  - <0.1s: no indicator needed.
  - 0.1-1s: usually no indicator; maybe a pointer change.
  - >1s and indeterminate: stateless spinner.
  - >1s and measurable: loading indicator with proportion complete, time remaining, what's happening, and a way to stop.
  - Don't lock the rest of the UI if you can avoid it.
- Signals present (in code/spec): A shared `<Spinner>` and `<ProgressBar>` component; async actions wrap state with `pending`/`progress`/`done`; thread-safe progress updates.
- Signals missing (red flag): Buttons that go quiet after click with no visible state change; long fetches that show no progress and no cancel.
- Anti-patterns / mis-applications: Spinner that runs forever after the operation finished (forgotten teardown); progress bar with no relationship to actual progress (cosmetic only).
- Related: [[#Cancelability]], [[01-foundations-cognition#P-08. Spatial Memory]]

### Cancelability

- Use when: Any operation longer than ~2 seconds (print, query, file load, network request) or any modal state that locks the user out of other actions.
- What it is: A way to instantly abort the in-progress operation with no side effects.
- Why it works: Supports user control and freedom (Nielsen heuristic); enables Safe Exploration; lets users abandon a clearly doomed operation (unreachable URL) without waiting it out.
- How to apply:
  - First, see if the operation can be made *fast enough* that cancel isn't needed.
  - Otherwise, place a Cancel/Stop button next to the loading indicator, with a recognisable icon (red X / stop sign).
  - On click, abort immediately — within 1-2 seconds — and visibly confirm the cancel (halt the indicator, show a status message).
  - For multiple parallel operations, give each its own Cancel control and label it with what it cancels.
- Signals present (in code/spec): `AbortController` / `CancellationToken` wired into long-running fetches; Cancel button rendered alongside every loading state.
- Signals missing (red flag): Modal "Loading..." dialogs with no Cancel; long downloads that the user can't stop without killing the app.
- Anti-patterns / mis-applications: A Cancel button that takes 10+ seconds to actually stop the operation; a Cancel that leaves partial side effects (half-written files, partial database commits).
- Related: [[#Spinners and Loading Indicators]], [[01-foundations-cognition#P-01. Safe Exploration]]

### Multilevel Undo

- Use when: Highly interactive applications — editors, authoring tools, graphics, mail, database UIs — where users perform sequences of state-changing operations.
- What it is: A reversible action history; each commit pushes onto a stack, and successive Undos pop operations off in reverse order. Redo walks back up.
- Why it works: Encourages Safe Exploration for novices; enables experts to try whole paths and roll back; supports flow because mistakes aren't expensive.
- How to apply:
  - Model every state-changing operation as a discrete, named, reversible command.
  - Reversible: text edits, DB transactions, image edits, layout changes, file ops, create/delete/rearrange, cut/copy/paste.
  - Not reversible (don't pollute the stack): selection, navigation, scroll, panel sizing, mouse position.
  - Define operation granularity around user intent (words, not letters).
  - Stack depth: at least 10-12; longer if feasible.
  - Surface as Edit > Undo / Redo with `Ctrl-Z` / `Cmd-Z`; pair with Smart Menu Items naming the next undoable action.
- Signals present (in code/spec): A `Command`/`Action` interface with `apply()` and `undo()`; a central `UndoManager` (UIKit's `NSUndoManager`, Redux undo middleware, etc.).
- Signals missing (red flag): A complex editor where undo only reverses the most recent action; no Redo; or undo is per-field instead of per-user-intent.
- Anti-patterns / mis-applications: Undo that reverses navigation or selection (creates "what just happened?" confusion); undo across irreversible operations (purchase, sent email) without an explicit warning.
- Related: [[#Smart Menu Items]], [[#Command History]], [[01-foundations-cognition#P-01. Safe Exploration]], [[01-foundations-cognition#P-06. Incremental Construction]]

### Command History

- Use when: Users perform long sequences of actions in graphical editors, programming environments, or command-line interfaces, and might want to review, repeat, or script what they did.
- What it is: A visible, scrollable record of the user's actions — what was done, to what, in what order.
- Why it works: Supports reviewing prior work, repeating older actions, applying a sequence to a new object, audit logging, and converting interactive work into Macros.
- How to apply:
  - Record every undoable command in a chronological list; same granularity rules as Multilevel Undo.
  - Express each action consistently and concisely (text or icon).
  - Persist history across sessions if feasible.
  - Display in an optional panel (history palette); allow search, optional timestamps.
- Signals present (in code/spec): A History sidebar / panel reading from the same action log that powers undo; browser-style history in any app that needs traceability.
- Signals missing (red flag): Editor where users can't see what they did 10 minutes ago; CLI with no `history` equivalent.
- Anti-patterns / mis-applications: History that records UI noise (mouse-overs, focus changes); history with no way to act on entries (replay / share / convert to macro).
- Related: [[#Multilevel Undo]], [[#Macros]]

### Macros

- Use when: Users repeat long sequences of actions over many objects (batch image edits, ETL on many files, repeated transformations); the app already has Multilevel Undo or Command History to draw on.
- What it is: A user-defined named command composed of a recorded sequence of smaller actions, replayable on demand with one gesture.
- Why it works: Streamlined Repetition pattern from Ch.1 — automates what computers should automate; reduces finger slips; supports flow by collapsing many steps into one.
- How to apply:
  - Provide a Record / Stop mechanism that captures a sequence of commands.
  - Let users name, save, browse, and edit macros; allow one macro to invoke another.
  - Make playback a single click / keyboard shortcut / drag-and-drop.
  - Optionally parameterise — let the same macro act on different targets — and support batch application across many objects.
  - Don't call it "programming" if your users don't see themselves as programmers.
- Signals present (in code/spec): An `Action`/`Recording`/`Script` data model; a Record button in the UI; a macro library persisted per user.
- Signals missing (red flag): Power users hand-repeating the same 10-step procedure on hundreds of files; feature requests for "batch X" with no way to compose existing commands.
- Anti-patterns / mis-applications: Macros that can't be inspected or edited (black-box playback); macros that fail silently on the first error instead of reporting which step broke.
- Related: [[#Multilevel Undo]], [[#Command History]], [[01-foundations-cognition#P-11. Streamlined Repetition]]
