const TRUTHY_LOG_FLAGS = new Set(["1", "true", "yes", "on", "force"]);
const FALSY_LOG_FLAGS = new Set(["0", "false", "no", "off"]);

let cachedLogFilePath: string | null | undefined;
let cachedRunId: string | undefined;
let started = false;
let disabled = false;

export type LocalDebugTraceEvent = {
  timestamp: string;
  event: string;
  payload: unknown;
};

type TraceSink = (entry: LocalDebugTraceEvent) => void;

const traceSinks: TraceSink[] = [];

export async function collectLocalDebugTrace<T>(
  run: () => Promise<T>,
): Promise<{ result: T; trace: LocalDebugTraceEvent[] }> {
  const trace: LocalDebugTraceEvent[] = [];
  const sink: TraceSink = (entry) => trace.push(entry);

  traceSinks.push(sink);
  try {
    const result = await run();
    return { result, trace };
  } finally {
    const index = traceSinks.lastIndexOf(sink);
    if (index >= 0) {
      traceSinks.splice(index, 1);
    }
  }
}

export function isLocalTestRunLoggingEnabled(): boolean {
  const raw = Deno.env.get("GTI_LOCAL_TEST_LOGS")?.trim().toLowerCase();
  if (!raw || FALSY_LOG_FLAGS.has(raw)) return false;
  if (!TRUTHY_LOG_FLAGS.has(raw)) return false;
  if (raw !== "force" && Deno.env.get("CI")?.toLowerCase() === "true") {
    return false;
  }
  return true;
}

export function logLocalTestEvent(
  event: string,
  payload: Record<string, unknown> = {},
): void {
  pushTraceEvent(event, payload);

  if (disabled || !isLocalTestRunLoggingEnabled()) return;

  const filePath = localTestLogFilePath();
  if (!filePath) return;

  try {
    ensureLogDirectory(filePath);
    if (!started) {
      started = true;
      writeEvent(filePath, "local_test_log.started", {
        logFilePath: filePath,
        cwd: Deno.cwd(),
        denoArgs: Deno.args,
        denoVersion: Deno.version,
      });
    }
    writeEvent(filePath, event, payload);
  } catch {
    disabled = true;
  }
}

function pushTraceEvent(
  event: string,
  payload: Record<string, unknown>,
): void {
  const sink = traceSinks[traceSinks.length - 1];
  if (!sink) return;

  sink({
    timestamp: new Date().toISOString(),
    event,
    payload: toJsonSafe(payload),
  });
}

function writeEvent(
  filePath: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  const record = {
    timestamp: new Date().toISOString(),
    runId: localTestRunId(),
    event,
    payload,
  };
  Deno.writeTextFileSync(filePath, `${safeStringify(record)}\n`, {
    append: true,
    create: true,
  });
}

function localTestLogFilePath(): string | null {
  if (cachedLogFilePath !== undefined) return cachedLogFilePath;

  const fromEnv = Deno.env.get("GTI_LOCAL_TEST_LOG_FILE")?.trim();
  if (fromEnv) {
    cachedLogFilePath = fromEnv;
    return cachedLogFilePath;
  }

  const logDir = pathFromFileUrl(
    new URL("../.local-test-logs/", import.meta.url),
  );
  cachedLogFilePath = joinPath(logDir, `${localTestRunId()}.jsonl`);
  return cachedLogFilePath;
}

function localTestRunId(): string {
  if (cachedRunId) return cachedRunId;

  const fromEnv = Deno.env.get("GTI_LOCAL_TEST_RUN_ID")?.trim();
  if (fromEnv) {
    cachedRunId = sanitizeRunId(fromEnv);
    return cachedRunId;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const random = crypto.randomUUID().slice(0, 8);
  cachedRunId = sanitizeRunId(`${timestamp}-pid-${Deno.pid}-${random}`);
  return cachedRunId;
}

function ensureLogDirectory(filePath: string): void {
  const directory = dirname(filePath);
  if (!directory) return;
  Deno.mkdirSync(directory, { recursive: true });
}

function dirname(path: string): string | null {
  const slashIndex = path.lastIndexOf("/");
  const backslashIndex = path.lastIndexOf("\\");
  const index = Math.max(slashIndex, backslashIndex);
  if (index <= 0) return null;
  return path.slice(0, index);
}

function joinPath(directory: string, fileName: string): string {
  if (directory.endsWith("/") || directory.endsWith("\\")) {
    return `${directory}${fileName}`;
  }
  return `${directory}${Deno.build.os === "windows" ? "\\" : "/"}${fileName}`;
}

function pathFromFileUrl(url: URL): string {
  const decoded = decodeURIComponent(url.pathname);
  if (Deno.build.os !== "windows") return decoded;
  return decoded.replace(/^\/([A-Za-z]:)/, "$1").replaceAll("/", "\\");
}

function sanitizeRunId(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120);
  return sanitized || `run-${Date.now()}`;
}

function safeStringify(value: unknown): string {
  return JSON.stringify(toJsonSafe(value));
}

function toJsonSafe(
  value: unknown,
  key = "",
  stack: readonly object[] = [],
): unknown {
  if (shouldRedactKey(key)) return "[redacted]";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && !Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "symbol") return String(value);
  if (typeof value === "function") {
    return `[function ${value.name || "anonymous"}]`;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object" || value === null) return value;
  if (stack.includes(value)) return "[Circular]";

  const nextStack = [...stack, value];
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [mapKey, mapValue] of value.entries()) {
      const stringKey = String(mapKey);
      out[stringKey] = toJsonSafe(mapValue, stringKey, nextStack);
    }
    return out;
  }
  if (value instanceof Set) {
    return [...value.values()].map((entry, index) =>
      toJsonSafe(entry, String(index), nextStack)
    );
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      toJsonSafe(entry, String(index), nextStack)
    );
  }

  const out: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    out[entryKey] = toJsonSafe(entryValue, entryKey, nextStack);
  }
  return out;
}

function shouldRedactKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, "");
  if (!normalized || normalized.startsWith("has")) return false;
  return normalized === "authorization" ||
    normalized === "apikey" ||
    normalized === "xgoogapikey" ||
    normalized === "bearer" ||
    normalized.endsWith("token") ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("servicerole");
}
