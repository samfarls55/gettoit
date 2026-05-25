---
title: Sunset Pop — Design System Handover Brief
description: Self-contained brief for a fresh Claude design session. Pulls "Sunset Pop" direction from the 0.1.0 prototype and asks for a full token + component system around it.
type: handover-brief
status: superseded
created: 2026-05-12
related:
  - "[[0.1.0-directions]]"
  - "[[frontend-design-brief]]"
  - "[[0.1.0-design-locks]]"
  - "[[verdict-screen-spec]]"
---

# Sunset Pop — Design System Handover Brief

> **Superseded — design system shipped.** The handover this brief requested was completed; the Sunset Pop design system lives at `design-system/` (repo root). Kept as a historical record of the handover brief.

This file is the prompt to feed to a fresh Claude design session. Everything between the horizontal rules is self-contained — paste it as context along with the five screenshots (drag-and-dropped into the session).

Screenshots (filenames are stable; expect them attached in the session):

- `01-q1-vetoes.png` — quiz Q1, multi-select veto chips, one chip in selected state (yellow fill on coral gradient).
- `02-q4-vibe.png` — quiz Q4, vibe slider with display-sized live label ("LOUD").
- `03-q5-regret.png` — quiz Q5, regret-rater cards on indigo gradient.
- `04-verdict.png` — verdict default state on sunset-to-midnight gradient.
- `05-verdict-expanded-committed.png` — verdict with cuts drawer open, "I'M IN" pressed.

---

## Brief

You're designing a full design system for **GetToIt**, an iOS app that kills group decision paralysis in 60 seconds. The 0.1.0 vertical is **food**: a group decides where to eat by answering 5 quick questions on their own phones, then the app returns one verdict the group commits to.

The five attached screenshots show the locked aesthetic direction — codename **Sunset Pop**. It's loud, gradient-driven, display-typography forward. The job *of the app* is to end the conversation; the visual language is built to match that finality.

### Who uses it

2–8 people, lateral relationships (friend groups, couples, small co-worker crews). No boss, no host, no curator. Phone-first, often end-of-workday, often decision-fatigued. Use happens in <60-second windows between other things. Design for a tired, distracted user holding a phone in one hand at 6:47pm — not for a focused user at a desk.

### What the design optimizes for

**North-star metric: % of verdicts the group actually follows through on.** Measured via a next-day check-in. The whole product is judged by this number, not by clicks, time-to-verdict, or DAU. Every design decision should ladder up to "did the group actually go?"

This is why finality matters, why the loser must feel heard, why the check-in card is a real surface and not an afterthought, and why pre-commit ratification is non-negotiable.

### What you're building

A production-ready design system: tokens, components, and motion language. Output should be structured markdown I can drop into `gti-vault/30_design/sunset-pop/` and translate to SwiftUI later.

### Hard product constraints (do not negotiate)

These come from prior research; the visual system has to live inside them.

1. **Voice register: warm friend, not court formal, not algorithmic.**
    - ✅ "Budget cap cut Sushi Ren."
    - ❌ "Alex said no to Sushi Ren."
    - ❌ "The algorithm picked Pico's."
2. **Distribution rule: NEED-then-EQUALITY. Never EQUITY.** No "your turn", no win counts, no exchange-relationship framing on any surface.
3. **Voluntary commitment language only.** Use "I'm in." Never "Confirm", "Accept", or any coercive label.
4. **Aggregate-rule attribution.** The rule + the inputs are the decider. The app is not the decider. The verdict's rule chip names *what* eliminated options, never *who*.
5. **Loser-targeted copy as the default voice.** Procedural-justice research (Brockner & Wiesenfeld 1996 meta-analysis) shows fairness signals matter most when the outcome is unfavorable. The losing member is the rate-limiting follow-through reader. Verdict copy should *include* the loser, not celebrate the winner. No "🎉 we picked X!" energy.
6. **Implementation-intention copy.** "We meet at Sushi Ren at 7pm" beats "We picked Sushi Ren." The verdict must specify where + when + who. Gollwitzer & Sheeran 2006 implementation-intention effect (d ≈ 0.65) is one of the primary levers on the follow-through metric.
7. **Anti-patterns — must NOT design these:**
    - Ranked lists or "top 3" reveals.
    - Per-member vote tallies on the verdict screen.
    - Likert-rate-each-option grids beyond the regret tiebreaker.
    - Slot-machine reroll mechanics.
    - Celebration / win framing on the verdict ("🏆", confetti, "you won this round").
    - "Confirm" / "Accept" buttons (coercive register, triggers reactance).

### Direction summary — Sunset Pop

- **Energy.** Loud finality. Party-mode wrapper over serious mechanics. The verdict closes the conversation.
- **Palette.** Per-screen gradient (coral → magenta → indigo → midnight, advancing as the quiz progresses). Sun yellow `#FFD23F` as the single fixed accent. Ink `#0E1011` for typography on light surfaces.
- **Type.** Inter Black (900) for all display, Inter Bold/Semibold for body. No serif anywhere. Uppercase + tracked for short labels and CTAs.
- **Verdict device.** Display-sized stacked ALL-CAPS place name, full-bleed gradient hero, sun-yellow time block, glass-effect receipt chips, white pill CTA.

### Drift risks specific to this direction (design defenses)

Sunset Pop's confidence and gradient bombast carry two specific risks that the design system must actively defend against. These are not optional callouts — they're load-bearing:

1. **Algorithm-as-decider drift.** A loud, definitive verdict screen can read as "the app decided for us." That violates aggregate-rule attribution and damages the relational signal that drives follow-through. **Defense:** the rule chip and voice-receipt row are not decoration. They are the proof that the verdict came from the inputs, not from the app. Treat them as primary content — not secondary chrome — and make sure they read in the verdict's first 2 seconds.
2. **Equity-celebration drift.** Bright accent + display-size winner can tip into "we won!" energy, which converts a communal frame into an exchange frame ("your turn next time"). **Defense:** no celebration motifs (confetti, trophies, sparkles). The verdict is a statement of fact, delivered with finality — not a reward. Loud, not festive.

### The seven surfaces (scope)

The prototype covers quiz + verdict. The full system has to cover all seven:

1. **Initiator landing** — pick vertical, start session, generate share link.
2. **Invite unfurl** — link preview in iMessage/WhatsApp, plus web fallback for non-installers.
3. **Quiz** — 5 fixed questions, ~10s each, total budget <60s. Mobile-native, one decision per screen. The five questions are locked:
    - **Q1 — dietary deal-breakers** (allergy / vegan / halal / kosher): EBA veto, multi-select chips.
    - **Q2 — budget cap**: EBA veto, threshold (binary or single-select tier).
    - **Q3 — logistics constraint** (distance / time / open-now): EBA veto, threshold.
    - **Q4 — vibe**: cardinal scalar on a single axis (low-key ↔ lively). Range/score signal, not ordinal ranking.
    - **Q5 — regret-of-omission tiebreaker**: rate-each-survivor scalar. The *only* surface where multi-option rating is permitted.
4. **Waiting / coordination state** — invitees still answering. Honest, calm, no anxiety-inducing spinners. Avatar dots show who's answered.
5. **Verdict screen** — the hero. One option. Where + when + who. Rule chip. Voice-receipt row. Eliminated-options drawer (collapsed by default). "I'm in" ratification with mutual-state visibility ("3 of 4 in"). Time-boxed correctability window (30–90 seconds) then hard-close.
6. **Reroll-with-reason** — capped at 3 per session. Reason taxonomy (cost / distance / mood / diet / availability). Friction is the feature — reroll is meant to be costly so paralysis can't sneak back as a slot-machine. After cap, forced commit or exit-with-no-verdict.
7. **Next-day check-in** — single-tap thumbs-up / thumbs-down / snooze, fired 12–24h after the verdict. This is the surface that feeds the north-star metric. Treat it as a first-class surface, not a system notification afterthought.

### The five-second test the verdict screen must pass

The verdict has roughly five seconds of attention from each member, and the *loser* is the rate-limiting reader. In those five seconds, the loser must see — in this priority order:

1. **The verdict** — winner shown, single option, no negotiation surface.
2. **The rule that produced it** — one short sentence, not a paragraph.
3. **Their voice was counted** — visible per-member input receipt.
4. **A path to ratify** — pre-commit "I'm in" tap.
5. **A correctability path** — friction-bearing, not free.

If a visual treatment hides or downgrades any of these five in the first 5-second read, the screen fails. Test every verdict variant against this checklist before showing it.

### Why hard-close exists (don't soften it)

The verdict screen visibly closes after the correctability window expires. This is intentional and load-bearing — it's the mechanic that converts *agreement* into *follow-through*. Without it, the group says "sounds good" and then nobody actually goes (the exact failure mode the product exists to prevent). The correctability window honors Leventhal's correctability rule; the hard-close prevents endless re-litigation. Both serve the north-star metric. If the visual treatment makes the hard-close feel abrupt or punitive, that's a problem to solve in motion / transition — not by removing the hard-close.

### Component inventory I need specced

Build these as the minimum component set. For each, define: visual spec at all states (default / pressed / selected / disabled), spacing rules, motion, accessibility (tap target ≥44pt, contrast on gradient surfaces).

- **Gradient surface** — the five per-screen gradients as a token family + the rule for picking them by step.
- **Top bar** — close `×`, segmented progress (5 segments, white fills as steps complete), step counter.
- **Question header** — eyebrow ("Q1 OF 5") + display-bold prompt + body sub.
- **Veto chip** — multi-select. Default = white outline on gradient. Selected = sun-yellow fill, ink text.
- **Single-select chip** — same as veto but mutually exclusive.
- **Vibe scalar** — 5-stop bar with a live word label ("ZZZ → CHILL → LIT → LOUD → WILD"). Show the label at display size; it changes as the user picks.
- **Regret rater card** — name + meta + 5-button rating row. Selected = sun-yellow fill ink.
- **Primary pill CTA** — white pill, ink text, all-caps, full-width, bottom-anchored.
- **Verdict hero** — display-stacked place name (one word per line for ≥7-char words), eyebrow, meta line.
- **Time badge** — sun-yellow rounded block, large time + small uppercase audience line.
- **Rule chip** — single-line aggregate-rule sentence, tappable to expand. Translucent background on gradient.
- **Voice-receipt chip** — small glass-effect pill, "{name} {action}". Anonymize private constraints ("filtered shellfish", not "alex has a shellfish allergy" — but the *who* still surfaces because that part is consented).
- **Cuts drawer** — collapsed by default. Reveals struck-through eliminated options with the rule that killed each.
- **Ratification button** — primary pill at "I'M IN". On commit, transitions to confirmed state showing N-of-M counter ("YOU'RE IN · 3 OF 4"). Mutual-state visibility is the lever (solidarity pressure), not enforcement — the button must read as voluntary, not required.
- **Hard-close artifact** — the verdict screen visibly closes after the correctability window (30–90s). Need a transition spec that feels like finality, not like an error. After close, the verdict is not editable from this surface; re-opening requires quorum via the reroll path.
- **Waiting state** — honest copy, gentle motion (no spinners), avatar dots showing who's answered. End-of-workday users are fatigued — no anxiety-inducing pulses.
- **Reroll dialog** — friction-bearing. Reason picker chips (cost / distance / mood / diet / availability), count remaining (max 3 per session). The reason becomes a new constraint feeding the next verdict — design the dialog so the user understands their reason matters.
- **Check-in card** — thumbs-up (went) / thumbs-down (skipped) / snooze, fired 12–24h after verdict. Optional second tap on thumbs-down: "why didn't you go?" with a reason taxonomy. This card feeds the north-star metric — design it to be tappable in 2 seconds from a lock-screen notification.

### Tokens I need defined

- **Color** — gradient stops, gradient assignment by step, sun-yellow accent, ink, white, semantic roles (success / destructive / muted) styled to live on gradient surfaces.
- **Type ramp** — display (verdict hero, vibe label), heading (question), body, eyebrow (uppercase tracked), CTA (uppercase tracked). All Inter weights.
- **Spacing scale** — 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- **Radii** — chip, card, pill, hero.
- **Shadows / elevation** — limited (gradient backgrounds resist drop shadows). Glass/blur effects for chips on gradient.
- **Motion** — gradient transitions between steps, chip selection feedback, verdict reveal (the "drop"), ratification confirmation. Include durations + easing.
- **Accessibility** — contrast ratios on every gradient stop, focus rings, reduced-motion fallbacks.

### Translation note

This system will be re-implemented in SwiftUI for the iOS app (Swift + SwiftUI + Supabase per the project's ADR 0001). Output should map cleanly to SwiftUI primitives — avoid effects that require web-only CSS. Glass/blur is fine (SwiftUI has `.ultraThinMaterial`). Per-step gradient transitions need to feel native, not web-y.

### Deliverables

1. `tokens.md` — full token system.
2. `components.md` — every component above with all states and ASCII or text-described specs.
3. `motion.md` — motion language + per-component spec.
4. `surfaces/` — one file per surface (initiator, invite, quiz, waiting, verdict, reroll, check-in) describing the layout using the component inventory.
5. `accessibility.md` — contrast tables, focus order, reduced-motion behavior, tap target audit.

Lean and structured beats long and prose-y. Bullet points and tables. Don't re-explain the product — just design the system.

### Open decisions you can make

- Exact gradient stops (current prototype values are a starting point, not locked).
- Vibe-label vocabulary at each stop.
- Whether the verdict "drop" reveal uses a transition or is static.
- Glass receipt chip blur level + opacity.
- Whether the per-step gradient family is 5 distinct gradients or one gradient that animates a hue shift.

### Open decisions you should flag, not decide

- Logo / wordmark — does not exist yet, not your job.
- Brand voice copy strings — owned by a separate session (`gti-vault/40_marketing_branding/`).
- Whether warm-friend vs. court-formal copy register wins — A/B post-launch, but you can recommend a starting register and lock the visual to it.

---

End of brief. Ask any clarifying questions before producing the system.
