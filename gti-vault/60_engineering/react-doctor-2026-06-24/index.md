# React Doctor remediation - 2026-06-24

## Production React app roots

- `web/` - Next.js App Router production web app.
- `mobile/` - Expo / React Native production mobile app.

## Raw scan artifacts

- `web-baseline-verbose.txt` - full initial `npx -y react-doctor@latest --verbose` output for `web/`.
- `mobile-baseline-verbose.txt` - full initial `npx -y react-doctor@latest --verbose` output for `mobile/`.
- `web-final.json` - final `npx -y react-doctor@latest --verbose --json` proof for `web/`.
- `mobile-final.json` - final `npx -y react-doctor@latest --verbose --json` proof for `mobile/`.

## Baseline

- `web/`: React Doctor 0.5.8, score 43/100 Critical, 2 errors, 74 warnings, 55 source files. Share: `https://react.doctor/share?p=gettoit-web&s=43&e=2&w=74&f=15`.
- `mobile/`: React Doctor 0.5.8, score 28/100 Critical, 8 errors, 20 warnings, 42 source files. Share: `https://react.doctor/share?p=gettoit-mobile&s=28&e=8&w=20&f=8`.

## Final proof

- `web/`: React Doctor 0.5.8, score 100/100 Great, 0 errors, 0 warnings, 56 source files.
- `mobile/`: React Doctor 0.5.8, score 100/100 Great, 0 errors, 0 warnings, 42 source files.

## Verification

- `npm run verify:web` passed: web typecheck, 25 Vitest files / 150 tests, and `next build` on Next.js 15.5.18.
- `npm run mobile:verify` passed: mobile typecheck and 11 Jest suites / 123 tests.
- `npm run verify:edge` passed: 466 Deno tests passed, 0 failed, 2 ignored.
