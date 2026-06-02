# design-system/ — Agent Rules

This directory is the **authoritative spec** for every UI surface in GetToIt. Code (when it lands) must match these tokens, components, surfaces, and motion timings exactly. Drift here is a bug, not a refactor.

Read `README.md` first for the full inventory. This file is the contract for *editing* the design system.

---

## Source of truth

| Concern | Source | Notes |
|---|---|---|
| Tokens (color, type, spacing, radii, motion, shadow, texture) | `tokens.json` | Canonical. `code/tokens.css` is GENERATED from this. |
| Gradient stops per surface | `tokens.json` → `gradient.surfaces` | Same 4-stop schema for every surface. |
| Component visual + state spec | `components.md` | Each component has matching JSX in `code/components.jsx`. |
| Surface purpose, defenses, copy register | `surfaces/0N-*.md` | Each has matching JSX in `code/screens/`. |
| Motion choreography | `motion.md` + `code/screens/ScreenVerdict.jsx` (`VERDICT_CHOREO`) | Timings are ms-exact. |
| Accessibility (contrast, tap targets, VO) | `accessibility.md` | Contrast tables per gradient. |

**Generated files — never edit by hand:**
- `code/tokens.css` (regen via `node scripts/gen-css.mjs`)
- Future `*.swift` token outputs (regen via `scripts/gen-swift.mjs`)

If a generated file is wrong, fix `tokens.json` and re-run the generator.

---

## Editing rules

### Tokens
- Edit `tokens.json`. Run `node scripts/gen-css.mjs`. Commit both.
- New color → add to `tokens.json`. Register even external/chrome colors (use the `chrome.*` subgroup) so the orphan-hex sweep stays green.
- New token category → extend `gen-css.mjs` AND `tokens.md` AND (when build lands) the Swift generator.

### Components
- Editing a component JSX → also edit its `components.md` entry in the same change.
- New component → add JSX in `code/components.jsx` OR a dedicated file, add a `C-NN` section in `components.md`, add a row to `README.md` if it's user-visible.

### Surfaces
- Editing a screen JSX → also edit its `surfaces/0N-*.md` doc in the same change.
- New surface → add JSX in `code/screens/`, add `surfaces/NN-*.md`, update `README.md` code map.
- A surface doc and its JSX must always be edited together. They are the **why** and the **what** of the same artifact.

### Motion
- Timings live in `tokens.json` (`motion.duration-ms`, `motion.choreo-delay-ms`).
- Per-surface choreography (e.g. `VERDICT_CHOREO`) is in the JSX. Document the timing table in `motion.md` mirror.

### Anything user-visible
- Append a one-line entry to `CHANGELOG.md` — date, what, why.
- Prefix breaking changes with `BREAKING:`.

---

## Verification

Run before commit:

```
node design-system/scripts/gen-css.mjs --check   # tokens.css matches tokens.json
node design-system/scripts/verify.mjs            # drift gate + orphan-hex sweep
```

`verify.mjs` checks:
1. `tokens.json` parses, has all required top-level keys, every surface has 4 gradient stops.
2. `code/tokens.css` is byte-identical to what `gen-css.mjs` would emit.
3. Every hex color in any JSX appears somewhere in `tokens.json`. Orphan hex = either a missing token or sneaky drift.
4. Every `surfaces/0N-*.md` has frontmatter (`surface`, `status`, `locked-date`, `jsx`), every JSX in `code/screens/` is claimed by exactly one surface doc. No orphans, no double-claims.

---

## Do / Don't

**Do:**
- Treat `tokens.json` as the single contract every consumer reads from.
- Keep `surfaces/0N-*.md` and `code/screens/Screen*.jsx` in sync — same PR, same commit.
- Register external chrome colors (iOS Messages, system UI mocks) under `color.chrome.*` rather than leaving them as unregistered hex.
- Update `CHANGELOG.md` on every spec change.
- Reach for an existing token before inventing a new color. Sun-yellow is THE accent.

**Don't:**
- Hand-edit `code/tokens.css`.
- Introduce raw hex (`#FFAA22`) directly in a JSX without registering it in `tokens.json`.
- Add red or green as state signals. No red. No green. Sun is the only state color (`tokens.md §1.3`).
- Add tweak knobs (palette switcher, motion variants, hue offset) — those live in the prototype repo, not here. This is the locked canonical state.
- Silently rename or move tokens. Removal/rename is a `BREAKING:` change.

---

## Vault relationship

This directory is **not** in `gti-vault/`. It is authoritative spec; the vault is narrative. The vault references this folder via `gti-vault/60_engineering/` but never duplicates its content. Don't promote design-system contents into the vault — link to it instead.

---

## When iOS code lands

`scripts/gen-swift.mjs` will emit `GTITokens.swift` from the same `tokens.json`. Same contract — never hand-edit the Swift output, always regenerate. Add a CI step that runs both `--check` modes (CSS + Swift) on every PR.
