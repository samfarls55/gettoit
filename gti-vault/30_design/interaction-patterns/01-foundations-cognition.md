---
title: Foundations — cognition + behavior principles
source_chapter: 1 — Designing for People
purpose: Universal audit checks that apply to every surface regardless of which structural pattern it uses
---

# Foundations — Cognition + Behavior

13 principles drawn from how people actually perceive and use software. Each principle applies to every surface. Treat each as a yes/no audit check. A failure on any of them is grounds for rework before patterns are even considered.

Source: Ch.1, *Designing Interfaces* 3rd ed.

## P-01. Safe Exploration

- **User mindset**: *"Let me explore without getting lost or getting into trouble."*
- **Audit check**: Can a user click any visible control without irreversible loss, lost data, or modal traps? Is there always a Back / Undo / Cancel?
- **Why it matters**: People learn an interface by trying things. If trying things costs them, they stop trying and engagement collapses.
- **Signals present**: Multilevel undo, Back-button works everywhere, cancel works during long ops, no surprise side-effects (e.g., autoplay audio, hijacked nav).
- **Signals missing / red flag**: Destructive primary actions without confirmation+undo; nav that traps; auto-submit on field blur with no undo.
- **Related patterns**: Multilevel Undo, Cancelability (Ch.8), Escape Hatch (Ch.3).

## P-02. Instant Gratification

- **User mindset**: *"I want to accomplish something now, not later."*
- **Audit check**: Can a brand-new user complete the first useful action in the first few seconds, before any registration / tutorial / consent wall?
- **Why it matters**: Early success builds confidence + commitment. Friction before value kills funnel.
- **Signals present**: First useful action is on the first screen; deferred sign-up; no required modal on cold start except platform OS prompts.
- **Signals missing / red flag**: Forced sign-up before any value; mandatory tour/walkthrough; multi-step onboarding before any task.
- **Related patterns**: Clear Entry Points (Ch.3), Mobile Direct Access (Ch.2), Wizard (use sparingly).

## P-03. Satisficing

- **User mindset**: *"Good enough. Not going to spend more time learning."*
- **Audit check**: Will a user *scanning* (not reading) the screen pick the right control on first guess? Are labels short, plain, and meaningful?
- **Why it matters**: Users scan, they don't read. They click the first plausible option and back out if wrong. Reading-required interfaces fail.
- **Signals present**: Short, plain labels; calls-to-action that name the verb ("Save", "Buy"); layout that communicates meaning before text is read.
- **Signals missing / red flag**: Marketing-speak labels; clever icon-only buttons with no tooltip; long instructional copy before any control.
- **Related patterns**: Prominent "Done" Button (Ch.8), Smart Menu Items (Ch.8), Input Hints (Ch.10).

## P-04. Changes in Midstream

- **User mindset**: *"I changed my mind about what I was doing."*
- **Audit check**: Can a user switch tasks midway, save state, come back later? Or are they locked into a linear flow?
- **Why it matters**: Real users get interrupted, change their minds, and come back. Locked flows lose them.
- **Signals present**: Reentrance (form state survives navigation away); multiple workspaces; non-modal where possible.
- **Signals missing / red flag**: Modal-only flows for long tasks; cleared form on tab-switch; no draft-saving.
- **Related patterns**: Many Workspaces (Ch.2), Deferred Choices, Wizard (only when reentrance not needed).

## P-05. Deferred Choices

- **User mindset**: *"Don't ask me that now; just let me finish."*
- **Audit check**: Are required fields actually required *at this step*, or could they be answered later? Are optional fields clearly marked?
- **Why it matters**: Front-loading every possible question kills task completion. Most info can be filled in later or with sensible defaults.
- **Signals present**: Short required-field set; defaults pre-filled; "you can change this later" affordances; sign-up-after-value patterns.
- **Signals missing / red flag**: 20-field registration before any value; "select category" gates before browsing.
- **Related patterns**: Good Defaults and Smart Prefills (Ch.10), Wizard (with caution).

## P-06. Incremental Construction

- **User mindset**: *"Let me change this. That doesn't look right; change it again."*
- **Audit check**: For any "make" surface (editor, canvas, builder), is feedback on changes near-instant? Can the user iterate in small steps?
- **Why it matters**: Creative work is iterative. Slow feedback breaks flow.
- **Signals present**: Live preview; <500ms feedback on edits; non-blocking saves; reorderable / undoable construction.
- **Signals missing / red flag**: Mandatory save-then-render cycle; long compile-feedback delays; modal "preview" windows.
- **Related patterns**: Preview (Ch.8), Canvas Plus Palette (Ch.2), Multilevel Undo.

## P-07. Habituation

- **User mindset**: *"That gesture works everywhere else; why not here?"*
- **Audit check**: Do platform-standard gestures, shortcuts, and controls do what users expect everywhere in the app? Same gesture, same effect.
- **Why it matters**: Reflexive actions become automatic. Breaking them is worse than not supporting them — experts get hurt most.
- **Signals present**: Ctrl-S saves; Esc dismisses modals; Back navigates back; swipe gestures consistent across screens.
- **Signals missing / red flag**: One screen overrides a standard gesture; modal that traps Esc; Back-button overridden to do something else; confirmation dialogs the user habitually clicks past (defeats the protection).
- **Related patterns**: Keyboard Only, Sign-In Tools (placement), all platform-standard controls.

## P-08. Microbreaks

- **User mindset**: *"I'm waiting for the train. Let me do something useful for two minutes."*
- **Audit check**: On mobile especially, can a returning user open the app and consume / contribute value in under 5 seconds with no setup?
- **Why it matters**: Mobile usage is dominated by short sessions in fragmented attention contexts.
- **Signals present**: Persistent auth (no re-login each open); restore-to-where-they-were; freshest content first; quick triage tools (star, archive, delete).
- **Signals missing / red flag**: Cold-start sign-in every session; landing page that loads slowly; "today's feed" not first; no quick triage.
- **Related patterns**: Streams and Feeds (Ch.2), Infinite List (Ch.6), Mobile Direct Access.

## P-09. Spatial Memory

- **User mindset**: *"I swear that button was here a minute ago."*
- **Audit check**: Do controls stay in consistent locations across screens, sessions, and visits? Are top/bottom of menus stable?
- **Why it matters**: People find things by *where* they are, not *what they're named*. Moving controls breaks expert efficiency.
- **Signals present**: Stable nav placement across pages; OK/Cancel in predictable positions; "recently used" lists that append rather than reorder.
- **Signals missing / red flag**: Auto-resorting menus ("most-used to the top"); A/B tests that move primary CTAs between sessions; dynamic chrome that reflows.
- **Related patterns**: Visual Framework (Ch.4), Movable Panels (user-controlled rearrangement is OK; system-controlled is not).

## P-10. Prospective Memory

- **User mindset**: *"I'm putting this here to remind myself to deal with it later."*
- **Audit check**: Does the app let users leave artifacts (drafts, flags, open tabs, notes) as their own reminder system? Or does it "helpfully" clean up?
- **Why it matters**: Users externalize memory onto the UI. Auto-tidying destroys that.
- **Signals present**: Drafts persist; bookmarks/stars/flags exist; closed-without-saving recovers; nothing auto-deletes idle state.
- **Signals missing / red flag**: Auto-clear of unsaved data; auto-archive of "stale" items; auto-close of "unused" tabs/windows; over-eager garbage collection.
- **Related patterns**: Deferred Choices, Many Workspaces, Tags (Ch.2).

## P-11. Streamlined Repetition

- **User mindset**: *"I have to repeat this how many times?"*
- **Audit check**: For any task a user might do many times, is there a one-action repeat (keyboard shortcut, macro, batch operation, copy-paste)?
- **Why it matters**: Repetition is where users burn most time. Small reductions multiply.
- **Signals present**: Bulk operations; Find/Replace; recorded actions or macros; keyboard shortcuts on the high-traffic actions; copy/paste of structured objects.
- **Signals missing / red flag**: Multi-select with no batch action; "do this one at a time" workflows; no shortcuts on the most-used actions.
- **Related patterns**: Macros (Ch.8), Command History (Ch.8), Smart Menu Items.

## P-12. Keyboard Only

- **User mindset**: *"Please don't make me use the mouse."*
- **Audit check**: Can every primary task be completed via keyboard alone, with predictable Tab order and accessible focus indicators?
- **Why it matters**: Data-entry users, accessibility users, and power users all live on the keyboard. Mouse-only is hostile.
- **Signals present**: Tab traversal works; visible focus rings; arrow keys move list selection; Enter activates default action; Esc cancels; standard shortcuts wired.
- **Signals missing / red flag**: Tab order skips controls or traverses in visual-disorder; click-only menus; primary action with no Enter binding; controls only reachable by hover.
- **Related patterns**: All form patterns (Ch.10), Sign-In Tools, Smart Menu Items.

## P-13. Social Media, Social Proof, Collaboration

- **User mindset**: *"What did everyone else say about this?"*
- **Audit check**: Where decisions are made or content is consumed, is there a layer for peer signal (reviews, ratings, "X others did this", co-presence)? Does the app afford collaboration where multiple users could plausibly want it?
- **Why it matters**: Social signals shift behavior more than copy. Co-presence drives engagement.
- **Signals present**: Reviews/ratings; "N people are looking at this"; share affordances; collaborative editing or discussion; activity feeds.
- **Signals missing / red flag**: Decision UI in total silence (no other-user context); collaboration-shaped task forced into single-user flow; share buttons that go to dead-ends.
- **Related patterns**: Help Systems (Ch.2), social cues woven across navigation + lists.

---

## How to use this list

In an audit, this list is **gate 0**. Run all 13 checks against each surface before drilling into pattern-level questions. A surface that violates P-01 (Safe Exploration), P-07 (Habituation), or P-12 (Keyboard Only) is broken regardless of how well its individual patterns are implemented — fix those first.

Foundation violations tend to be systemic (the whole app has the bug). Pattern misuses tend to be local (one screen has the bug). The audit report should separate the two.
