# Coding Standards

For AFK issue implementation agents. Apply only to code changes.

## Style

- Follow `.editorconfig`: UTF-8, LF, spaces, final newline; Swift/Python/shell use 4-space indent, others 2-space.
- Touch only issue-relevant code. Remove only unused code/imports your change creates.
- Use domain names over abbreviations. Keep DB columns `snake_case`; map app types to camelCase.
- TypeScript: strict types, no `any`; use `unknown` at boundaries and narrow.
- Model states with discriminated unions, not boolean clusters.
- Prefer named exports except framework-required defaults.
- Next.js: Server Components by default; `"use client"` only for hooks/browser APIs/events/subscriptions.
- React props typed at boundaries; move real state-machine branching into named helpers.
- Swift UI state belongs on `@MainActor`; route decisions stay pure.
- Use existing tokens/primitives. Do not hardcode colors, spacing, radii, or motion when a token exists.
- Preserve locked copy and accessibility strings unless issue changes them.
- Comments only for invariants, security, races, or non-obvious test hooks.

## Testing

- Bug fix: add focused regression coverage when practical.
- New domain logic: pure-unit tests first.
- UI change: test pure state decisions, visible shape, and contracted a11y identifiers/labels.
- Web tests: colocated `*.test.ts(x)`, Vitest/Testing Library, mocked app/Supabase boundaries unless integration is required.
- Edge tests: Deno tests against injectable handlers; no live network/DB in unit tests.
- Swift tests: prefer pure helpers/host contracts; test hooks may drive production paths.
- SQL/RLS: cover allow/deny paths when feasible.
- Never weaken tests to pass. Update tests only for intended behavior changes.

## Architecture

- Keep pure logic separate from IO: DB, HTTP, env, clock, randomness, and clients stay in adapters.
- Edge Functions: `index.ts` binds runtime deps; `handler.ts` validates requests and maps responses.
- Validate untrusted input at boundaries; reject malformed input before costly work.
- Return stable machine-readable error strings.
- Fail closed. Do not trust client-supplied identity or authorization.
- Never expose service-role keys or privileged secrets to browser/iOS clients.
- Use conditional writes for single-use or race-prone flows.
- Parse wire/DB/API payloads into typed local shapes before business logic.
- Do not duplicate domain rules across iOS/web/Edge; reuse shared modules, generated outputs, or explicit mappers.
- SQL migrations must be forward-safe and handle existing data.
- New tables: enable RLS intentionally and grant least privilege.
- Keep generated artifacts synced with source changes.
- Avoid speculative abstractions; abstract only repeated current behavior or required shared contracts.
