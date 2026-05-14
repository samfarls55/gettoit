# Design System Changelog

Append-only log of every change to the design system spec. Newest at top. One line per change unless a `BREAKING:` entry needs context.

Format: `YYYY-MM-DD — short description. (PR / commit / reason)`

Prefix `BREAKING:` for any change that requires code or downstream consumers to update.

---

## 2026-05-13

- Added `scripts/gen-swift.mjs` — reads `tokens.json`, emits `ios/Sources/GTITokens.swift` (GTIColor / GTIGradient / GTIFont / GTISpacing / GTIRadii / GTIMotion / GTIVibeLabels / GTITexture). `--check` mode enforced by `scripts/verify.mjs`, so any drift between Swift output and `tokens.json` fails CI alongside the existing CSS drift gate. (TB-01.)

## 2026-05-12

- **S05 Verdict:** added `read-only` mode for late-joiners. Eyebrow shifts to `"Tonight's verdict"`, ratification CTA + reroll + `"Start over"` secondary suppressed, replaced by `"Start a new decision"` re-invite CTA (returns to S01 as new initiator, defaults pre-populated from prior room). Receipt row excludes the late-joiner — they didn't contribute. Cuts drawer remains available (informational). Motion: same `choreo` sequence; CTA fade-up lands on re-invite CTA. (Spec gap 03 — consumed by TB-11.)
- **S05 Verdict:** added `no-survivor` terminal mode for the case where VerdictEngine exits with `method = 'no_survivor'`. Hero `"NO SPOT / FITS"` (one word per line), meta line surfaces surviving hard-needs, rule chip carries load-bearing message in aggregate-rule register (never names members). Time badge + receipts + cuts drawer suppressed. Primary CTA `"Widen radius"` (sun-fill, initiator-only) opens inline C-21 slider range `1–10 mi`; commit re-runs engine. Secondary ghost `"Start over"` returns to S01. Widen re-run does not consume a reroll. Motion: compressed reveal (no time/receipt beats). (Spec gap 04 — consumed by TB-09.)
- **S04 Waiting:** brought initiator force-verdict into v1 (was reserved for v2). Added `"Decide now"` ghost CTA — initiator-only, disabled until ≥2 members have answered, label exposes quorum cost (`"Decide now · 3 of 4 in"`). Added live mono-tag countdown (`"Auto-fires in 7:42"`), low-emphasis, visible to all members, ticks every second. Added expired-quorum terminal copy for the no-quorum case. (Spec gap 02 — consumed by TB-07.)
- Updated `motion.md` with utility-motion rows for countdown tick + Decide-now quorum unlock.
- Added **C-21 Range Slider** component (`components.md`, `code/components.jsx`). Sun-filled track + white thumb, 44pt hit row over a 6px visual bar. First consumer: S01 radius. (Spec gap 01.)
- **S01 Initiator Landing:** added timer chip group (`5 · 10 · 15 · 30` min, default 10) and radius slider (`0.5–5.0 mi`, step 0.5, default 2.0) above the vertical picker. Documents explicit exception to the "no optional fields" defense — both controls have sensible defaults that ship the zero-tap session. Persisted to `rooms.timer_minutes` + `rooms.radius_meters`. (Spec gap 01 — consumed by TB-03.)
- Updated `accessibility.md` with C-21 + timer-chip rows (tap-target table, VO labels).
- **BREAKING:** Product renamed `figureitout` → `GetToIt`. Domain locked to `gettoit.app`. Identifier sweep: `Fio*` types/functions → `GTI*` (`FioTokens` → `GTITokens`, `FioMark` → `GTIMark`, `FioColor` → `GTIColor`, `FioGradient`/`FioSurface`/`FioChip` similarly). Constants `FIO_GRADIENTS` / `FIO_PALETTES` → `GTI_*`. CSS classes + keyframes `fio-*` → `gti-*` (`fio-canvas`, `fio-display`, `fio-rise`, `fio-fade-up`, `fio-pop`, `fio-stagger-in`, `fio-shutter-top`/`bot`, `fio-gradient`, `fio-grain`, `fio-eyebrow`, `fio-cta`). Wordmark tile letter `f` → `g`. Vault directory `fio-vault/` → `gti-vault/`. Web fallback URL paths shift from `fio.app/s/<id>` → `gettoit.app/s/<id>` (see surfaces/02-invite, ScreenInviteUnfurl, ScreenInviteWeb).
- Introduced `tokens.json` as canonical source of truth. `code/tokens.css` is now generated via `scripts/gen-css.mjs`. (Motivation: prevent three-way drift between `tokens.md`, `tokens.css`, and `components.jsx GTI_GRADIENTS`.)
- Added `scripts/verify.mjs` — drift gate + orphan-hex sweep over all JSX in `code/`.
- Added `--r-sheet: 26px` to generated CSS. Previously in `tokens.md §4` but missing from the hand-written `tokens.css`. Now consistent.
- Registered `color.ink-3` (`#0A0A0F`) — hard-close shutter fill (S06). Spec-backed per `surfaces/06-hard-close.md`. Was previously inlined hex in `ScreenLocked.jsx`.
- Registered `color.member-identity` (`#7DDFB5`, `#FF8DA1`, `#9BC0FF`) — per-member dot colors on the waiting surface (S08). **Spec gap closure** — previously inlined in `ScreenWaiting.jsx` with no spec coverage. Flag: tension with the "Sun is THE accent" rule (`tokens.md §1`) — palette beyond 3 members needs design review.
- Registered `color.chrome.imessage` (`#1C1C1E`, `#26262A`, `#3A3A3C`) — external iOS Messages dark-theme chrome mocked in `ScreenInviteUnfurl.jsx`. Not GetToIt brand; registered only to keep the orphan-hex sweep clean.
- Added `CLAUDE.md` — editing rules for this directory (source-of-truth contract, regenerate steps, verification commands).
- Added YAML frontmatter to every `surfaces/0N-*.md` (`surface`, `status`, `locked-date`, `jsx`). Extended `verify.mjs` with a third check: every surface doc claims its JSX, every JSX in `code/screens/` is claimed by exactly one surface, no orphans or double-claims.
