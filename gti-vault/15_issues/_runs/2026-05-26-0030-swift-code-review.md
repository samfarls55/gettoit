---
run: 2026-05-26-0030
type: swift-code-review
scope: ios/Sources/App/*.swift + ios/Sources/GTITokens.swift (Tests excluded)
standards: CODING_STANDARDS.md (repo root)
---

# 2026-05-26 00:30 UTC — swift-code-review

## Totals

- Files scanned: 75 (74 in `ios/Sources/App/` + `ios/Sources/GTITokens.swift`)
- Raw scan-agent findings: ~560 (heavy duplication; 4 parallel Explore agents)
- True unique findings (dedup by file:line+rule): ~21
- Isolated candidates surfaced: 7
- Deferred / architectural: 2 buckets
- False positives rejected: 4

## Top rule IDs by frequency

| Rule | Severity | Hits | Notes |
| ---- | -------- | ---- | ----- |
| NAME-003 | S3 | 15 | missing `///` doc comments on public inits — bucketed; not actioned individually |
| CONC-010 | S2 | 3 | `DispatchQueue.main.async` in `LocationCoordinator` |
| FUN-002 | S3 | 4 | `@escaping` on closures called synchronously (judgment call) |
| ENUM-002 | S2 | 2 | `default:` on in-module enum (RerollScreen, VerdictScreen) |
| OPT-001 | S1 | 2 | force-unwraps in `SetupScreen.snapDistance` |
| PROP-005 | S3 | 2 | `{ $0.x }` over `\.x` (PreferenceFunction, Q5FactorialCardGenerator) |

Repo-wide grep confirmed **clean** on: `try!`, `as!`, `unowned self`, `lazy var` in struct, `T!` IUOs, `(T?, Error?)` completion callbacks, `open class`.

## Candidates presented

| # | Rule | Sev | File:line |
| - | ---- | --- | --------- |
| 1 | OPT-001 | S1 | SetupScreen.swift:103-104 |
| 2 | ENUM-002 | S2 | RerollScreen.swift:498-508 |
| 3 | ENUM-002 | S2 | VerdictScreen.swift:949-955 |
| 4 | PROP-005 | S3 | PreferenceFunction.swift:365 |
| 5 | PROP-005 | S3 | Q5FactorialCardGenerator.swift:252 |
| 6 | CONC-010 | S2 | LocationCoordinator.swift:296,342,386 |
| 7 | FUN-002 | S3 | SetupScreen.swift:668-669 |

## Picks applied

User picked: `all S1 + S2` → issues created, not direct edits. Per `/to-issues`:

| Pick | Vault issue | GH issue | Status |
| ---- | ----------- | -------- | ------ |
| 1 (OPT-001 S1) | bug-30 | #239 | ready-for-agent / AFK |
| 2 (ENUM-002 S2) | bug-31 | #240 | ready-for-agent / AFK |
| 3 (ENUM-002 S2) | bug-32 | #241 | ready-for-agent / AFK |
| 6 (CONC-010 S2) | bug-33 | #242 | ready-for-agent / AFK |

S3 candidates (4, 5, 7) not actioned this run — surface again on next sweep if not addressed organically.

## Deferred (architectural)

- **NAME-003 doc-comment debt** (~100+ sites repo-wide) — better as one dedicated bulk pass than scattered through code-review tickets.
- **LocationCoordinator `@MainActor` migration** — wholesale move would ripple through CoreLocation delegate signatures. Out of scope for bug-33's local-replacement fix.

## False positives (logged)

- `case error(String)` in State enums (AuthCoordinator:40, FireVerdictCoordinator:44) flagged as ERR-005 — these are state payloads, not error types.
- `preconditionFailure(...)` in InviteLink.swift:62 flagged as OPT-001 — explicit trap, not a force unwrap.
- `[weak self] response, _ in guard let self else` in LocationCoordinator (lines 294, 384) flagged as REF-001 — correct pattern.
- `now: @escaping () -> Date` stored as `self.now` flagged as FUN-002 — the closure IS escaping (stored as property).

## Coverage caveats

- A–F scan agent fixated on NAME-003 / ERR-005; cross-greppable correctness rules confirmed via direct grep, not via that agent.
- `ios/Tests/` not scanned this run.

## Next sweep

Run `/swift-code-review` again after bug-30..33 merge to confirm cleanup + catch S3 candidates not picked.
