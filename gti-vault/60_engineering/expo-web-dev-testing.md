---
status: approved
---

# Expo web dev testing

Expo web is a smoke-test surface for the active React Native app in `mobile/`.
It proves JavaScript boot, navigation, Supabase client calls, and UI flows on a
Windows machine. It does not prove TestFlight signing, iOS entitlements, native
Apple Sign-In, keychain behavior, or App Store binary launch behavior.

## Dev auth

The production mobile auth policy remains Apple-only for signed-in users. The
Expo web smoke path has a guarded dev-only password login because
`expo-apple-authentication` cannot complete on web.

Enable it only for local Expo web testing:

```powershell
cd C:\development\gettoit\mobile
npx expo start --web
```

Local Expo web config lives in ignored file `mobile/.env.local`:

- `EXPO_PUBLIC_ENABLE_WEB_DEV_LOGIN=1`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `MOBILE_WEB_DEV_LOGIN_EMAIL=dev-web-tester@gettoit.app`
- `MOBILE_WEB_DEV_LOGIN_PASSWORD`

The Supabase project must have the email provider enabled
(`external_email_enabled=true`) for the dev password user to sign in. The app
still maps any non-anonymous Supabase session to its signed-in router state so
RLS and app data flows can be exercised without an iOS build. Do not present
this as a 0.1.0 product auth option.

## Maps

The search-area picker uses a platform split:

- Native iOS/Android: `react-native-maps`, which is supported by Expo Go.
- Expo web: `maplibre-gl`, so `npx expo start --web` shows a real pan/zoom map
  on Windows without an EAS build.

For local web smoke testing, MapLibre falls back to CARTO Dark Matter raster
tiles when no paid/free provider key is present. That fallback is acceptable
only for developer iteration, not production traffic. To test with a hosted
style, set one of these in `mobile/.env.local`:

- `EXPO_PUBLIC_MAPTILER_KEY` - loads MapTiler Dataviz Dark by default
  (`dataviz-v4-dark`).
- `EXPO_PUBLIC_MAPTILER_STYLE_ID` - optional MapTiler style id override.
- `EXPO_PUBLIC_MAPTILER_STYLE_URL` - optional full style URL override.
