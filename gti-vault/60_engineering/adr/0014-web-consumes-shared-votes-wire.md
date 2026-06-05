---
adr: 0014
title: Web consumes a shared votes-wire module from supabase/functions/_shared
status: accepted
date: 2026-05-21
supersedes: null
superseded_by: null
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# 0014 â€” Web consumes a shared votes-wire module

## Status

Accepted â€” 2026-05-21. Decided in the `/grill-with-docs` session
on the web invitee single-link flow
([[../../50_product/0.1.0-workflow-overhaul-web-invitee-flow|0.1.0-workflow-overhaul-web-invitee-flow]]
Â§Q2). Implemented by tb-WF-10.

## Context

The vote **wire shape** â€” the `{ meta, answer }` envelope per quiz
slot, plus the helpers that build it from a set of quiz answers â€” is
currently defined **three separate times**:

1. iOS, in Swift.
2. The web fallback, in `web/lib/quiz.ts`.
3. The edge functions, in `supabase/functions/_shared/votes-schema.ts`.

Copies 1 and 3 are kept honest because iOS and `compute-verdict` are
exercised on every quiz run. Copy 2 is a **hand-mirror that rotted**:
`web/lib/quiz.ts` still writes the 0.1.0 typed vote columns
(`q1_vetoes` / `q2_budget` / `q3_walk_minutes` / `q4_vibe` /
`q5_regret`) and the web screen still renders the deleted
`DUMMY_CANDIDATES` fixture. The 0.1.0 redesign moved iOS and the
engine onto the generic jsonb votes schema
([[0010-generic-jsonb-votes-schema|ADR 0010]]); the web hand-mirror
silently fell a whole quiz generation behind because nothing forces
it to track the other two.

The web invitee flow has to produce 0.1.0-shaped votes. The naive fix
is to hand-update `web/lib/quiz.ts` to match â€” i.e. keep the mirror
and re-sync it. But three hand-copies already produced one silent
divergence; a fourth re-sync just resets the clock on the next one.

Two existing ADRs frame how this monorepo shares code:

- [[0004-monorepo-layout|ADR 0004]] chose **no shared package** â€” no
  pnpm workspaces, no git submodules, "no package-publish overhead"
  for a solo dev with one consumer pair. It also accepted "no
  enforced package boundaries," assuming cross-imports would be
  *accidental* and caught in review.
- [[0003-web-fallback-nextjs-vercel|ADR 0003]] ruled that **`web/`
  must not import from `design-system/code/`** â€” the design-system
  JSX is *spec*, web re-implements it, and the `verify.mjs` drift
  gate is the contract.

A webâ†’`supabase/functions/_shared` import is neither of those
situations, but it is close enough to both that proceeding silently
would leave a future reader unsure whether it was a mistake.

## Decision

**Extract the vote wire types and `buildVotesSlotsFromLegacyAnswers`
into a new leaf module, `supabase/functions/_shared/votes-wire.ts`.
The web app imports it directly. The `web/lib/quiz.ts` hand-mirror is
deleted.**

`votes-wire.ts` is a **leaf module**: it imports no engine code â€”
only the tiny `Q5Rating` / `Axis` types â€” and it has no relative
imports of its own. That property is load-bearing (see Consequences):
it is what keeps the module consumable by both the Deno edge runtime
and the Next.js / Node web build without a resolution mismatch.

This is the **first deliberate cross-sibling code import** in the
monorepo.

## Why

1. **One un-forkable contract.** Three hand-copies produced exactly
   one silent rot; a fourth copy guarantees the next. A single
   imported module cannot drift from itself â€” the web app and the
   edge functions compile against the same source.
2. **ADR 0004's "no shared package" reasoning does not bite here.**
   That decision rejected the *publish overhead* of npm workspaces /
   submodules â€” versioning, pinning, a publish step. A direct
   relative import of one leaf `.ts` file has none of that overhead.
   "No package" and "no shared file" are different claims; ADR 0004
   only made the first.
3. **ADR 0003's prohibition is about visual spec, and does not
   transfer.** `web/` must not import `design-system/code/` because
   that JSX is a *visual* spec and `verify.mjs` is the drift gate. A
   vote contract is a *data* contract: drift in it is **silent and
   dangerous** (a malformed vote, a verdict computed on the wrong
   shape), and no drift gate can catch it the way `verify.mjs` catches
   an orphan hex. For a data contract, importing the one true source
   is *safer* than re-implementing it â€” the opposite of the
   design-system case.
4. **The seam is already narrow.** The web invitee grill (Â§Q1/Â§Q2)
   pinned the shellâ†”quiz boundary to exactly a vote envelope and a
   progress envelope. `votes-wire.ts` *is* that boundary made into a
   file.

## Deviations recorded

- **From [[0004-monorepo-layout|ADR 0004]].** ADR 0004 assumed
  cross-sibling imports would be accidental. This establishes a
  *deliberate, sanctioned* one. It is **not** a reversal â€” no package,
  no workspace, no publish step is introduced; ADR 0004's actual
  decision stands. What changes is that the monorepo now has one
  intentional cross-import, and future readers must treat
  `votes-wire.ts` as **the** sanctioned web-importable file under
  `supabase/functions/_shared`, not as a precedent that the whole
  directory is web-importable.
- **From [[0003-web-fallback-nextjs-vercel|ADR 0003]].** ADR 0003's
  literal rule ("`web/` must not import from `design-system/code/`")
  is **not violated** â€” `votes-wire.ts` lives under
  `supabase/functions/_shared`, not `design-system/`. But ADR 0003's
  *spirit* â€” "web re-implements rather than imports" â€” is being
  deliberately set aside for this one data-contract module, because
  the reasoning behind that spirit (visual spec, drift gate) does not
  apply to a data contract (see Why Â§3).

## Considered options

- **Re-sync the `web/lib/quiz.ts` hand-mirror and keep it.** Rejected
  â€” the rot is the proof that hand-mirrors do not survive. Re-syncing
  resets the clock; it does not stop the next divergence.
- **Publish a real shared npm package (pnpm workspaces).** Rejected â€”
  reintroduces exactly the publish / version / pin overhead ADR 0004
  declined, to share one leaf file. ADR 0004's re-evaluation trigger
  for workspaces ("external consumer of the design-system appears")
  has not fired.
- **Put the shared types in `design-system/`.** Rejected â€” ADR 0003
  explicitly forbids `web/` importing `design-system/code/`, and a
  vote wire shape is not a design-system artifact in the first place.
- **Generate the web copy from `votes-schema.ts` via a codegen
  step.** Rejected â€” a codegen script is more machinery than a direct
  import, and it still leaves two files that can diverge between
  regenerations.

## Consequences

### Positive

- The vote wire contract is defined **once** and imported by both the
  web app and the edge functions. `web/lib/quiz.ts`'s hand-mirror is
  deleted.
- The next quiz-shape change physically cannot leave the web app a
  generation behind â€” there is no separate web copy to forget.
- The shellâ†”quiz seam from the web invitee grill (Â§Q2) now has a
  concrete, reviewable artifact.

### Negative / costs

- **First cross-sibling import.** The monorepo's "no enforced
  package boundaries" reality (ADR 0004) now contains one real,
  intentional cross-import. The mitigation is the leaf-module rule:
  `votes-wire.ts` imports no engine code, so the import graph it
  pulls into the web bundle stays shallow and auditable.
- **Two build systems now compile one file.** `votes-wire.ts` is
  authored under `supabase/functions/` (Deno) but is also type-checked
  and bundled by the Next.js / Node web build. Deno and Node differ on
  import-extension resolution; keeping `votes-wire.ts` a **leaf with
  no relative imports** sidesteps that mismatch entirely. If the
  module ever needs to import another file, that portability
  constraint has to be solved first.
- A future reader could over-generalize this into "web may import
  anything from `_shared`." The Deviations section above is the
  guard: only `votes-wire.ts` is sanctioned.

## Re-evaluation triggers

- A **second** cross-sibling import request appears â€” at two, the
  question becomes whether a real shared package (ADR 0004's
  workspace trigger) is finally warranted.
- `votes-wire.ts` needs a non-type relative import â€” revisit the
  Deno/Node portability constraint before adding it.

## References

- [[../../50_product/0.1.0-workflow-overhaul-web-invitee-flow|0.1.0-workflow-overhaul-web-invitee-flow]]
  Â§Q2 â€” the grill decision this ADR records.
- [[0003-web-fallback-nextjs-vercel|ADR 0003]] â€” the
  web-re-implements-the-spec rule whose spirit this sets aside for
  one data-contract module.
- [[0004-monorepo-layout|ADR 0004]] â€” the no-shared-package decision
  this does not reverse but does add a deliberate cross-import to.
- [[0010-generic-jsonb-votes-schema|ADR 0010]] â€” the generic jsonb
  votes schema the wire shape belongs to; `votes-schema.ts` is the
  sibling module `votes-wire.ts` is carved out alongside.
