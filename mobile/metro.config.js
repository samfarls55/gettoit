const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;
const defaultEnhanceMiddleware = config.server?.enhanceMiddleware;
const wsStubPath = path.resolve(__dirname, "src/native/wsStub.js");
const devRunLogsEnabled =
  process.env.CI !== "true" && process.env.GTI_DEV_RUN_LOGS !== "0";
const devRunLogRunId = `${new Date().toISOString().replace(/[:.]/g, "-")}-pid-${
  process.pid
}`;
const devRunLogDir = path.join(__dirname, ".dev-run-logs");
const devRunLogFile = path.join(devRunLogDir, `${devRunLogRunId}.jsonl`);
const devRunLogEndpoint = "/__gti_dev_run_log";
const maxDevRunLogBodyBytes = 25 * 1024 * 1024;

config.resolver.resolverMainFields = ["react-native", "browser", "module", "main"];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ws: wsStubPath,
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "ws") {
    return { type: "sourceFile", filePath: wsStubPath };
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

function writeDevRunLogEvent(event, payload = {}) {
  if (!devRunLogsEnabled) return;

  fs.mkdirSync(devRunLogDir, { recursive: true });
  fs.appendFileSync(
    devRunLogFile,
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      runId: devRunLogRunId,
      event,
      payload: redact(payload),
    })}\n`,
  );
}

function redact(value, key = "") {
  if (shouldRedactKey(key)) return "[redacted]";
  if (Array.isArray(value)) {
    return value.map((entry, index) => redact(entry, String(index)));
  }
  if (!value || typeof value !== "object") return value;

  const out = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    out[entryKey] = redact(entryValue, entryKey);
  }
  return out;
}

function shouldRedactKey(key) {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, "");
  if (!normalized || normalized.startsWith("has")) return false;
  return (
    normalized === "authorization" ||
    normalized === "apikey" ||
    normalized === "xgoogapikey" ||
    normalized === "bearer" ||
    normalized.endsWith("token") ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("servicerole")
  );
}

function setDevRunLogHeaders(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

function handleDevRunLogRequest(req, res) {
  if (!req.url?.startsWith(devRunLogEndpoint)) return false;

  setDevRunLogHeaders(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    res.end();
    return true;
  }

  let body = "";
  let tooLarge = false;
  req.on("data", (chunk) => {
    if (tooLarge) return;
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > maxDevRunLogBodyBytes) {
      tooLarge = true;
      res.writeHead(413);
      res.end();
      req.destroy();
    }
  });
  req.on("end", () => {
    if (tooLarge) return;

    try {
      const record = JSON.parse(body);
      const payload =
        record.payload && typeof record.payload === "object" &&
          !Array.isArray(record.payload)
          ? record.payload
          : {};
      writeDevRunLogEvent(record.event ?? "app.event", {
        ...payload,
        clientTimestamp: record.timestamp,
        platform: record.platform,
      });
      res.writeHead(204);
    } catch {
      res.writeHead(400);
    }
    res.end();
  });

  return true;
}

if (devRunLogsEnabled) {
  writeDevRunLogEvent("dev_run_log.started", {
    cwd: __dirname,
    logFilePath: devRunLogFile,
    pid: process.pid,
  });
  console.log(`Expo dev-run log: ${devRunLogFile}`);
}

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const enhancedMiddleware = defaultEnhanceMiddleware
      ? defaultEnhanceMiddleware(middleware, server)
      : middleware;

    return (req, res, next) => {
      if (handleDevRunLogRequest(req, res)) return;
      return enhancedMiddleware(req, res, next);
    };
  },
};

module.exports = config;
