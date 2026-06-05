// GetToIt web — App Store URL for the sg-03 "Download the app" CTA.
//
// Surfaced by `SessionRoom` on the S04 Waiting surface (web fallback,
// anonymous voter). Tapping the CTA opens this URL in a new tab while
// the user remains on S04 — the verdict still computes for the room
// they voted in, and the user can come back to read it.
//
// TODO (TB-02 quiz redesign / pre-public-launch milestone): swap the
// placeholder for the real App Store URL once the app's Apple ID
// allocates. The placeholder routes to a generic apps.apple.com URL
// path that will 404 — that's acceptable pre-launch because (a) only the
// founder is on the platform, (b) the public launch milestone gates
// on a real listing landing first. See the 0.1.0 _index "App Store URL
// placeholder" callout for the swap checklist.

/**
 * App Store URL for the active React Native mobile app. Placeholder until the Apple ID is
 * allocated (see TODO above).
 *
 * Web-friendly `https://` form is used unconditionally — the iOS-
 * specific `itms-apps://` scheme that the spec mentions for in-Safari
 * taps is a system-level handoff Safari does automatically on the
 * `https://apps.apple.com/...` URL. Going with one URL keeps the
 * handler small and avoids a UA sniff at tap-time.
 */
export const APP_STORE_URL = "https://apps.apple.com/app/id0000000000";
