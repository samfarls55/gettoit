# Verification

Use the narrowest check that covers the files you changed. Prefer the combined command before handing off broad changes.

| Area changed | Command |
| --- | --- |
| Expo mobile app code or tests | `npm run mobile:verify` |
| Web app code or tests | `npm run verify:web` |
| Supabase Edge Functions | `npm run verify:edge` |
| Mixed web and Edge Function changes | `npm run verify:local` |
| Migrations or deployed Supabase config | Prefer CI/remote verification; local checks do not prove hosted DB state. |

## Root Scripts

- `npm run web:typecheck` runs `tsc --noEmit` in `web/`.
- `npm run web:test` runs Vitest in `web/`.
- `npm run web:build` runs `next build` in `web/`.
- `npm run mobile:typecheck` runs `tsc --noEmit` in `mobile/`.
- `npm run mobile:test` runs Jest in `mobile/`.
- `npm run mobile:verify` runs typecheck and tests in `mobile/`.
- `npm run verify:web` runs typecheck, tests, and build.
- `npm run verify:edge` runs all Deno tests under `supabase/functions/` and
  writes local-only JSONL debug logs to `supabase/functions/.local-test-logs/`.
- `npm run verify:local` runs web and Edge Function checks.

## Notes

- EAS/TestFlight release, live canaries, Supabase DB push, and Edge Function deploy are CI or release-lane responsibilities.
- If a command needs credentials that are not present locally, record that and rely on the matching CI lane.
