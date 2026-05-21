---
surface: web-01-invitee-shell
status: locked
locked-date: 2026-05-21
jsx: web-only
---

# Web-01 · Web invitee shell

> **Web-only surface.** No paired `code/screens/*.jsx` lives in this repo. The
> shell is built directly in the Next.js fallback (`web/`) by the paired
> shell-wiring tracer-bullets **tb-WF-11** (foundation) and **tb-WF-12**
> (re-click behaviors). This doc is the design-system contract those two
> tracer-bullets consume.

The web invitee shell is the surface tree a **Web invitee** reaches through the
iMessage / SMS deep link `/join/<roomId>`. The Web invitee is the
Account-disjoint Plan-member subtype — no homepage, no Plan list, one Plan only.

**Behavior is locked elsewhere.** The *what* of this flow — identity
persistence, resume routing, the read-only verdict, leave semantics — is
resolved and frozen in the decision doc
[[../../gti-vault/50_product/workflow-overhaul-web-invitee-flow|workflow-overhaul-web-invitee-flow]]
(the `/grill-with-docs` session of 2026-05-21, Q1–Q8). This file is purely the
*visual / UX / copy / motion* layer that sits on top of those decisions. Where
this doc says "behavior" it points at the decision doc; it never re-decides.

This is a `web-NN-*` surface, not a `NN-*` ritual-arc surface, on purpose: it
never reaches iOS, and its implementation is web source rather than
design-system `code/screens/` JSX. The `verify.mjs` surface↔jsx pairing gate
(which matches only `NN[a-z]?-*.md`) intentionally skips it; a separate
`verify.mjs` check gates that this doc stays present and complete.

## Scope

This doc specs the **shell** — the five surfaces/states below. The **quiz
itself** (Q1–Q5 on web at v1.1 parity — scenario questions, the per-member
candidate fetch, the Q5 factorial probe) is a separate sibling tracer-bullet,
**tb-WF-10**, and is spec'd by [[03-quiz|S03 Quiz]]. The shell hands the quiz a
member identity and a room; the quiz hands back vote slots. Anything the shell
needs that the design system does not already have is a **spec gap to flag** —
not an inline hex, not an invented component.

## Surfaces / states covered

| # | State | When the invitee sees it |
|---|---|---|
| A | First-landing name entry | First-ever click of the link in this browser |
| B | Resume routing | Re-click mid-flow — routes to the invitee's current state |
| C | Read-only verdict card | Re-click of a decided Plan, membership resolves |
| D | "This plan is closed" terminal | Re-click whose membership does not resolve |
| E | Quiz-chrome Leave + "you left this plan" terminal | Leave affordance on the Q1–Q5 chrome |

All five render the Sunset Pop gradient + grain and consume only registered
tokens. No surface introduces a new component or a new token.

## Shared shell chrome

Every shell surface is a single full-viewport gradient surface — the same
`GradientSurface` web port (`web/components/SunsetPop.tsx`) the existing web
fallback already uses. There is **no Plan list, no nav bar, no back chrome** at
the shell level — the Web invitee's only handle on the Plan is the link itself.

| Element | Spec |
|---|---|
| Surface | full-viewport `GradientSurface` + `gti-grain` overlay (the existing web port) |
| Wordmark | `GTIMark` top-leading, 22px from the leading + top safe-area edge — quiet brand anchor, present on A / C / D / E (suppressed on B's transient routing frame) |
| Content column | centered, `max-width: 360`, horizontal padding `22` — matches the existing web fallback column |
| Type | Inter via `--ff-body`; display strings use the `gti-display` class (Inter 900) |
| Motion register | `gti-fade-up` on first paint of each surface, 380ms `var(--ease-out-soft)` — the same calm entrance the rest of the web fallback uses. No spinners, no celebration motion. |

Reduced motion: the `gti-fade-up` entrances collapse to a 200ms opacity fade,
consistent with the rest of the design system's reduced-motion posture
([[../accessibility|accessibility.md]]). No surface depends on motion to convey
state.

---

## A · First-landing name entry

The first click of `/join/<roomId>` in a browser with no prior anonymous
session. Behavior — anonymous-session mint, no plan summary, the single
`members.display_name` write — is locked in the decision doc §Q4. This section
specs only what the invitee sees.

**Single text input, one CTA. No plan summary.** A plan summary would credit
the initiator's name, which would need a new public RLS read path and depends
on the unresolved v1.1 #2b initiator-display-name blocker (decision doc §Q4).
The landing's job is to mint a member identity — nothing else.

### Layout

| Element | Spec |
|---|---|
| Gradient stop | `initiator` — the warm yellow-to-coral wash that opens the Sunset Pop arc. The Web invitee's first interaction should land on the same warmth an iOS user gets on S00. |
| Eyebrow | `eyebrow` token (Inter 700 / 11 / tracking 0.18em / UPPERCASE), white 0.78, label `"You're invited"` |
| Headline | `gti-display` (Inter 900), 38px on web (matches the existing web `QuestionHeader` display size), white, `text-wrap: balance`, label `"What should we call you?"` |
| Name input | single-line text field, see §"Name input" below |
| Primary CTA | `PillCTA fill="white"`, label `"Join the plan"`, full-column width, disabled until the input is valid |
| Vertical rhythm | eyebrow → 10 → headline → 24 → input → 16 → CTA |

### Name input

The input is built from the existing web type + glass tokens — it is **not** a
new component. It is a single soft-glass text field, the same dark-on-gradient
glass register as the C-23 LocationPicker typeahead input.

| Property | Spec |
|---|---|
| Container | full-column width, height 56, radius `var(--r-row)` (12), `--glass-fill-soft` background, `1px white 0.42` border (`--glass-stroke`), `backdrop-filter: blur(12px)` |
| Focus state | border → `var(--sun)`, 140ms `var(--ease-out)` — sun is the "system registered your input" signal |
| Text | Inter 600 / 16, white (`--paper`) |
| Placeholder | Inter 600 / 16, white 0.6 (`--text-tertiary`), literal `Your name` |
| Character cap | **30 characters.** The field hard-stops input at 30 — there is no counter chip and no error state; the cap is enforced silently by `maxLength`. |
| Trimming | leading/trailing whitespace is ignored for the validity check (see CTA below) |
| Autofocus | the input is focused on first paint so a mobile keyboard rises immediately — the fastest path to the one action this surface offers |
| Inputmode | default text; `autocapitalize="words"`, `autocomplete="off"` (a display label, not an account field) |

### CTA enable rule

`"Join the plan"` is **disabled until the trimmed input value is non-empty.**
Disabled state is the existing `PillCTA` disabled treatment (opacity 0.45,
`cursor: not-allowed`). A whitespace-only value never enables the CTA. There is
no separate inline validation message — the disabled CTA is the only feedback,
matching the rest of the design system's "disabled CTA, no error copy" posture
([[01-setup|S01 Setup]] name-required rule).

### Copy register

- **Eyebrow `"You're invited"`** — frames the moment as a personal invitation,
  not a system task. NEVER `"Welcome"`, NEVER `"Sign up"`.
- **Headline `"What should we call you?"`** — question-form, warm-friend
  register; the invitee is making a small call right then. NEVER
  `"Enter your name"` (procedural), NEVER `"Create a profile"`.
- **Placeholder `Your name`** — LOCKED (decision doc §Q4). Plain, lowercase
  in source where the field renders it sentence-case.
- **CTA `"Join the plan"`** — voluntary verb, plain noun. The `cta` token
  renders it UPPERCASE. NEVER `"Continue"`, NEVER `"Submit"`, NEVER `"Next"`.

### Notes (behavior, not re-decided here)

- The name is **not editable after entry** — there is no edit affordance on any
  later surface (decision doc §Q4). A mistyped name is re-fixable only by
  leaving and rejoining (§E).
- Duplicate names across members are allowed — the name is a label, the
  `user_id` is the identity (decision doc §Q4).
- **Name entry runs per Plan.** A Web invitee invited to a second Plan by a
  different person sees this surface again — there is no cross-plan name
  pre-fill, because there is no cross-plan surface to pre-fill from (decision
  doc §Q8).

---

## B · Resume routing

A re-click of the link by a browser that already holds an anonymous session
**routes the invitee to their current state**, not back to name entry. Behavior
— the `members.quiz_progress` read, the three resume cases — is locked in the
decision doc §Q5. This section specs the *transient routing frame* the invitee
sees while that read resolves.

### Routing frame

Resume is a read, not a surface — the invitee should land on their actual
state, not on an interstitial. But the read is not instantaneous, so the shell
shows a minimal **routing frame** for the gap:

| Element | Spec |
|---|---|
| Gradient stop | `initiator` (the same warm entry stop — the invitee has not yet been routed onto a quiz/waiting/verdict gradient) |
| Content | a single centered `eyebrow`-token line, white 0.6, label `"Picking up where you left off…"` |
| Wordmark | suppressed — the frame is transient chrome, not a destination |
| Motion | the line fades in only if the read exceeds ~250ms (avoid a flash on a fast read); `gti-fade-up` 200ms |
| Max dwell | the frame is replaced the instant the resume read returns. It is never a terminal state — every read resolves to one of: quiz, Waiting, Verdict, or (if membership does not resolve) §D. |

### Resume destinations

The three locked destinations (decision doc §Q5) and the surface each lands on:

| Invitee state | Lands on |
|---|---|
| Mid-quiz (some questions answered, no verdict) | [[03-quiz|S03 Quiz]] at the **last-answered question**, prior answers preserved |
| Quiz finished, no verdict yet | [[04-waiting|S04 Waiting]] (web variant) |
| Plan decided | §C read-only verdict card |

The quiz and Waiting surfaces are the existing web fallback ports — the shell
does not restyle them; it only routes into them. The resume *into Q5*
re-fires the per-member candidate fetch — an inherited limitation that belongs
to the quiz port (tb-WF-10), not the shell (decision doc §Q5).

### Accepted constraint — cross-browser / cleared-storage resume

**Resume only works within the same browser, with storage intact.** Identity is
the anonymous Supabase session held in `localStorage` (decision doc §Q3) — the
shared `/join/<roomId>` link carries no per-member token, so it cannot. A Web
invitee who:

- switches devices,
- switches browsers, or
- clears browser storage

is a **new member on re-click** — they land on §A name entry again, and their
prior vote strands in the room.

This is **not a bug and not a deferred fix** — it is the accepted cost of a
single shareable link with no per-member token (decision doc §Q3). The shell
must not paper over it with a recovery prompt or a "is this you?" surface;
treating the returning-with-cleared-storage invitee as a fresh first-landing
keeps the routing logic single-path. The §A copy ("What should we call you?")
reads correctly for both a true first-timer and a storage-cleared returner —
that is by design.

The cross-context bridge for the *app-install* case (a Web invitee who installs
the iOS app) is a separate, real problem — out of scope here, owned by sg-WF-7.

---

## C · Read-only verdict card

A re-click of a **decided** Plan whose membership still resolves. Behavior —
why one card serves both `decided-active` and `decided-expired`, the
`plans_decided_for_user` / `plans_history_for_user` read path — is locked in the
decision doc §Q6. A Web invitee never has a reroll affordance (reroll is
initiator-only), so the two decided states are indistinguishable to them and
collapse to one card.

### Layout

| Element | Spec |
|---|---|
| Gradient stop | `verdict` — the golden-top sunrise gradient, the same stop S05 Verdict uses. The decided Plan reads as a resolved outcome. |
| Eyebrow | `eyebrow` token, white 0.78, label `"Tonight's verdict"` — past-tense-implicit, matching [[05-verdict|S05 read-only]] |
| Plan name | `gti-display` (Inter 900), 32px on web, white, `text-wrap: balance`, 1–2 lines |
| Verdict venue | the venue name, in a single `Glass` card (the existing web `Glass` component, default fill): Inter 800 / 22, white, centered, padding `20 18` |
| Vertical rhythm | wordmark → auto → eyebrow → 10 → plan name → 18 → verdict card → auto |

**Plan name + verdict venue only.** No receipts, no per-axis cuts, no rule
chip — `votes` is ephemeral and is gone by the time a Plan is decided (decision
doc §Q6). This card is a read, not the full S05 Verdict surface.

### Live update

During `decided-active` the card **live-updates on the existing Realtime
rebroadcast** — if a reroll changes the verdict while the invitee has the card
open, the venue name cross-fades to the new value (`all 320ms var(--ease-out)`,
the same transition the web fallback uses for live state changes). The invitee
takes no action — they are a read-only observer of the initiator's reroll.

### No CTA

The read-only verdict card has **no primary CTA**. A Web invitee has no reroll,
no ratify, no "start a new decision" path — they were invited to one Plan and
that Plan is decided. The card is terminal-by-completion: closing the tab is the
exit. (Contrast §D, which is terminal-by-failure and also has no CTA.)

> **Spec adjacency — not built here.** sg-WF-8 layers a low-key "Getting the
> app?" claim-code mint affordance onto this card (and the web Waiting screen).
> That affordance is spec'd by sg-WF-8 and wired by tb-WF-13; this doc leaves a
> documented seam for it but does not spec it. The base card above is
> CTA-less; sg-WF-8's affordance is additive and quiet.

### Copy register

- **Eyebrow `"Tonight's verdict"`** — past-tense-implicit. The Plan already
  decided; the invitee is reading a result, not awaiting one. Matches S05
  read-only. NEVER `"The verdict is"` (present-tense, implies a reveal moment
  that already happened).
- **Place name** — UPPERCASE via the display treatment, the same finality
  statement S05 makes.
- No "you missed it" / "this already happened" body copy — the past-tense
  eyebrow carries the timing; spelling it out would read as a scold.

---

## D · "This plan is closed" terminal

A re-click whose **membership does not resolve**. This happens when the member
row was purged by the 30-day anonymous-user TTL ([[../../gti-vault/60_engineering/adr/0006-privacy-posture-v1|ADR 0006]]),
or when a stranger opens a forwarded link and has no member row at all.
Behavior is locked in the decision doc §Q6.

### Layout

| Element | Spec |
|---|---|
| Gradient stop | `midnight` — the quiet dark gradient. A closed Plan is a dead end; the surface should read calm and final, not alarming. NOT a red / error register — Sunset Pop has no red ([[../tokens#13-semantic-roles|tokens.md §1.3]]). |
| Eyebrow | `eyebrow` token, white 0.6, label `"This plan"` |
| Headline | `gti-display` (Inter 900), 32px on web, white, `text-wrap: balance`, label `"This plan is closed"` |
| Body | Inter 600 / 15 / line 1.4, white 0.78, `max-width: 280`, `text-wrap: balance`, label `"This invite has wrapped up. Ask whoever shared it to start a new one."` |
| Vertical rhythm | wordmark → auto → eyebrow → 10 → headline → 12 → body → auto |

### No CTA

Like §C, the terminal has **no primary CTA**. There is nothing the invitee can
do — no Plan to resume, no account to recover into. A CTA would imply a path
that does not exist. The body copy points the invitee at the human who shared
the link, which is the only real next step. Closing the tab is the exit.

### Copy register

- **Eyebrow `"This plan"`** — bare, no verb. There is no live state to
  describe.
- **Headline `"This plan is closed"`** — flat statement of fact, the same
  register as S06 Hard-close's `"Verdict locked"`. NEVER `"Oops"`, NEVER
  `"Something went wrong"`, NEVER `"Error"` — nothing went wrong; the link
  simply aged out.
- **Body** — points at the person, not the system. `"Ask whoever shared it to
  start a new one."` NEVER `"Contact support"`, NEVER `"Try again"` (there is
  nothing to retry).

---

## E · Quiz-chrome Leave + "you left this plan" terminal

A Web invitee can leave a Plan **while in the quiz**. Behavior — the affordance
appears on Q1–Q5 chrome only, the `members` row delete, soft rejoin — is locked
in the decision doc §Q7.

### Affordance placement

The `Leave` affordance appears on the **Q1–Q5 quiz chrome only** — not on
Waiting, not on the read-only verdict card. This reuses the existing
[[03-quiz|S03 Quiz chrome]] top-trailing affordance: the `QuizChrome` row's
trailing slot, which already renders `Leave` for a joiner role
(S03 §"Role-conditional labels"). The Web invitee is a joiner — the chrome
renders `Leave`, not `Exit`, with no shell-specific change to the S03 chrome
spec.

A Web invitee has no Plan list to clean up; once they reach Waiting or Verdict
they have committed their vote, and closing the tab is a sufficient exit. The
`Leave` affordance earns its place only while there is an in-progress quiz whose
answers a leave would discard (decision doc §Q7).

### Leave confirm step

Tapping `Leave` opens a confirm step. The Web invitee leave **reuses the locked
`joinedLeave` confirm copy** from [[00-plan-list|surfaces/00-plan-list.md]]
§"Confirm sheet copy (LOCKED)" — verbatim, do not paraphrase:

| Element | Copy |
|---|---|
| Title | `Leave this plan?` |
| Body | `Your answers will be removed. The room continues for everyone else.` |
| Primary | `Leave plan` |
| Dismiss | `STAY` |

Visual register — the web fallback's existing dark-glass alert treatment (the
same one the web quiz exit confirm uses):

| Element | Spec |
|---|---|
| Backdrop | `rgba(0,0,0,0.42)`, tap-to-dismiss (equivalent to `STAY`) |
| Card | dark glass, radius `var(--r-sheet)` (26), `1px white 0.10` border, centered |
| Title | Inter 800 / 18, white |
| Body | Inter 600 / 14 / line 1.4, white 0.78 |
| Primary pill | `PillCTA fill="white"`, label `Leave plan` — **never** sun, **never** any red token. The destructive weight is carried by the copy, not by a colored button (the [[00-plan-list|S00]] confirm-sheet rule). |
| Dismiss | `STAY` — `eyebrow`-token label, white 0.6, 44pt-tall hit row, below the pill |

On confirm: the `members` row is dropped (`quiz_progress` rides along on the
row delete — decision doc §Q7); the surface routes to the terminal below. On
dismiss (`STAY` or backdrop tap): the alert closes, the quiz surface is
unchanged, no state mutation.

### "You left this plan" terminal

After a confirmed leave, the invitee lands on a minimal terminal — **no
upsell.** The web fallback is plumbing, not a growth surface
([[00-plan-list|S00]] "Algorithmic / suggestion framing" defense).

| Element | Spec |
|---|---|
| Gradient stop | `midnight` — same quiet dark register as §D; a left Plan is a dead end for this invitee |
| Eyebrow | `eyebrow` token, white 0.6, label `"This plan"` |
| Headline | `gti-display` (Inter 900), 32px on web, white, `text-wrap: balance`, label `"You left this plan"` |
| Body | Inter 600 / 15 / line 1.4, white 0.78, `max-width: 280`, `text-wrap: balance`, label `"Your answers were removed. Tap the link again any time to rejoin."` |
| CTA | none — re-clicking the link is the rejoin path (see below); a button here would duplicate the link the invitee already has |
| Vertical rhythm | wordmark → auto → eyebrow → 10 → headline → 12 → body → auto |

### Soft rejoin

Re-clicking the link after leaving is a **fresh first-landing** — §A name entry
again. No tombstone, no hard block (decision doc §Q7). The §A surface and copy
read correctly for a returning leaver exactly as they do for a true
first-timer — the same single-path landing logic. The body copy on this
terminal ("Tap the link again any time to rejoin") tells the invitee the door
is open without needing a button.

### Copy register

- **Eyebrow `"This plan"`** — bare, shared with §D. Both are post-flow
  terminals.
- **Headline `"You left this plan"`** — flat, factual, second-person. NEVER
  `"Goodbye"`, NEVER `"Sorry to see you go"` (sentimental upsell register).
- **Body** — states the consequence (`Your answers were removed.`) and the open
  door (`Tap the link again any time to rejoin.`) in one line each. NEVER
  `"Changed your mind?"` (re-engagement-bait register).

---

## What this surface tree defends against

- **Capability-URL identity leak.** The `/join/<roomId>` link is forward-by-
  design — it is shared into a group chat. The shell never embeds a per-member
  token in the URL and never shows a "resume as <name>" prompt keyed off the
  link; identity is the browser-held anonymous session only (decision doc §Q3).
  A forwarded link lands a stranger on §A (fresh landing) or §D (closed) —
  never inside someone else's identity.
- **Onboarding-cliff friction.** The Web invitee exists so a non-installer can
  participate without downloading. §A is one input + one CTA — no account, no
  email, no consent wall. The shell adds nothing between the link tap and the
  quiz beyond the single name the verdict screen needs.
- **Growth-surface creep.** The terminals (§D, §E) carry no upsell, no "get the
  app" hard sell, no re-engagement bait. The web fallback is plumbing. The one
  install-adjacent affordance (sg-WF-8's claim-code mint) is deliberately
  low-key and is spec'd by its own issue, not smuggled in here.
- **State-distinction noise.** A Web invitee cannot reroll, so `decided-active`
  and `decided-expired` are the same to them — §C is one card, not two.
  Surfacing a distinction the invitee cannot act on would be noise (decision
  doc §Q6).
- **False-recovery prompts.** A storage-cleared returner is, by construction,
  indistinguishable from a new invitee. The shell does not try to "recover"
  them with an "is this you?" surface — it treats them as a fresh landing,
  which is both honest and single-path (decision doc §Q3).

## Tokens used

All values above resolve to registered Sunset Pop tokens — no inline hex, no
inline px easing literals beyond the spacing scale.

| Concern | Token(s) |
|---|---|
| Gradient stops | `gradient.surfaces.initiator` (§A, §B), `.verdict` (§C), `.midnight` (§D, §E) |
| Accent / focus | `--sun` (input focus ring) |
| Surface text | `--paper` (primary), white 0.78 (secondary), `--text-tertiary` white 0.6 |
| Glass | `--glass-fill-soft`, `--glass-stroke` (name input); default `Glass` fill (§C verdict card) |
| Radii | `--r-row` (12, name input), `--r-sheet` (26, leave confirm card) |
| Type | `eyebrow`, `gti-display` (Inter 900), `body`, `cta` |
| Motion | `gti-fade-up` 380ms `--ease-out-soft` (surface entrance); `--ease-out` 140/320ms (focus, live update) |

No new token, no new component. If a future shell need cannot be met from this
table, that is a spec gap — flag it in `design-system/`, do not inline a value.

## Out of scope (owned elsewhere)

- **The web quiz at v1.1 parity** — scenario questions, the per-member
  candidate fetch, the Q5 factorial probe. Sibling tracer-bullet **tb-WF-10**;
  spec'd by [[03-quiz|S03 Quiz]].
- **The shell wiring** — the `/join/<roomId>` scaffold, the name-entry form,
  the `members.display_name` migration (tb-WF-11); the resume read, the
  read-only verdict card wiring, the leave wiring (tb-WF-12). This doc is the
  contract; those tracer-bullets are the build.
- **The web Waiting surface** — already an existing web fallback port; the
  shell routes into it, does not restyle it.
- **The app-installed account-claim bridge** — a Web invitee who installs the
  iOS app gets a fresh Apple `user_id` unlinked to their web anonymous
  identity. Sibling issue **sg-WF-7** and its decomposed build issues
  (sg-WF-8 / tb-WF-13 / tb-WF-14); see [[../../gti-vault/50_product/workflow-overhaul-web-invitee-account-claim|workflow-overhaul-web-invitee-account-claim]].
- **iOS member display names.** §A introduces the system's first real
  `members.display_name` source, for Web invitees only. iOS members still
  render the `m<uuid>` placeholder — closing that is a separate decision
  (decision doc §Q4, "Open follow-ups").

## Cross-references

- [[../../gti-vault/50_product/workflow-overhaul-web-invitee-flow|workflow-overhaul-web-invitee-flow]] — the decision doc; locked behavior for every surface above (Q1–Q8). **This doc never re-decides what that doc locked.**
- [[03-quiz|S03 Quiz]] — the quiz the shell routes into; owns the `QuizChrome` `Leave` affordance §E reuses.
- [[04-waiting|S04 Waiting]] — the web Waiting surface §B routes into.
- [[05-verdict|S05 Verdict]] — the iOS verdict surface; §C's read-only card is the web invitee's far-smaller analogue (plan name + venue only).
- [[00-plan-list|S00 Plan list]] — source of the locked `joinedLeave` confirm-sheet copy §E reuses verbatim.
- [[02-invite|S02 Invite]] — the iMessage unfurl / web fallback landing card that precedes `/join/<roomId>`.
- [[../tokens|tokens.md]] — the Sunset Pop token reference; every value above resolves here.
