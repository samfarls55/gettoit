# Verification

Use the narrowest check that covers the files you changed. Prefer the combined command before handing off broad changes.

| Area changed | Command |
| --- | --- |
| Design system tokens, surfaces, generated CSS or Swift tokens | `npm run verify:design-system` |
| Web app code or tests | `npm run verify:web` |
| Supabase Edge Functions | `npm run verify:edge` |
| Mixed design-system, web, and Edge Function changes | `npm run verify:local` |
| iOS Swift code | Run the relevant Swift/Xcode checks through CI or XcodeBuildMCP when available; local non-macOS shells cannot run `xcodebuild`. |
| Migrations or deployed Supabase config | Prefer CI/remote verification; local checks do not prove hosted DB state. |

## Root Scripts

- `npm run web:typecheck` runs `tsc --noEmit` in `web/`.
- `npm run web:test` runs Vitest in `web/`.
- `npm run web:build` runs `next build` in `web/`.
- `npm run verify:web` runs typecheck, tests, and build.
- `npm run verify:edge` runs all Deno tests under `supabase/functions/`.
- `npm run verify:local` runs design-system, web, and Edge Function checks.

## Notes

- Design-system verification includes generated-token drift checks.
- iOS simulator tests, TestFlight upload, live canaries, Supabase DB push, and Edge Function deploy are CI responsibilities.
- If a command needs credentials that are not present locally, record that and rely on the matching CI lane.
