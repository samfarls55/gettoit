import { NativeModules, Platform } from "react-native";

const devRunLogPath = "/__gti_dev_run_log";

declare const __DEV__: boolean | undefined;

let cachedEndpoint: string | null | undefined;

type SourceCodeModule = {
  scriptURL?: string;
};

function isDevRuntime(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__ === true;
}

function webOrigin(): string | null {
  const location = (globalThis as { location?: { origin?: string } }).location;
  return typeof location?.origin === "string" ? location.origin : null;
}

function nativeBundleOrigin(): string | null {
  const sourceCode = (NativeModules as { SourceCode?: SourceCodeModule })
    .SourceCode;
  const scriptURL = sourceCode?.scriptURL;
  if (!scriptURL) return null;

  const match = /^https?:\/\/[^/]+/.exec(scriptURL);
  return match?.[0] ?? null;
}

function devRunLogEndpoint(): string | null {
  if (cachedEndpoint !== undefined) return cachedEndpoint;

  const origin = Platform.OS === "web" ? webOrigin() : nativeBundleOrigin();
  cachedEndpoint = origin ? `${origin}${devRunLogPath}` : null;
  return cachedEndpoint;
}

export function shouldRequestDevRunTrace(): boolean {
  return isDevRuntime() && devRunLogEndpoint() !== null;
}

export function logDevRunEvent(
  event: string,
  payload: Record<string, unknown>,
): void {
  if (!isDevRuntime()) return;

  const endpoint = devRunLogEndpoint();
  if (!endpoint) return;

  void fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event,
      payload,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => undefined);
}
