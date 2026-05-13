# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

Single-context repo. `CONTEXT.md` lives at the repo root. ADRs live inside the vault at `gti-vault/60_engineering/adr/`.

```
/
├── CONTEXT.md
├── gti-vault/
│   └── 60_engineering/
│       └── adr/
│           ├── 0001-<slug>.md
│           └── 0002-<slug>.md
└── (future source code)
```

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — domain glossary and project-wide vocabulary.
- **`gti-vault/60_engineering/adr/`** — read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (<slug>) — but worth reopening because…_
