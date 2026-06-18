import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const functionsDir = join(repoRoot, "supabase", "functions");
const isCi = process.env.CI === "true";
const env = { ...process.env };
const denoArgs = ["test", "--allow-net", "--allow-env", "--allow-read"];

if (!isCi) {
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-pid-${process.pid}`;
  const logDir = join(functionsDir, ".local-test-logs");
  const relativeLogFile = `.local-test-logs/${runId}.jsonl`;

  mkdirSync(logDir, { recursive: true });
  env.GTI_LOCAL_TEST_LOGS = env.GTI_LOCAL_TEST_LOGS ?? "1";
  env.GTI_LOCAL_TEST_RUN_ID = env.GTI_LOCAL_TEST_RUN_ID ?? runId;
  env.GTI_LOCAL_TEST_LOG_FILE = env.GTI_LOCAL_TEST_LOG_FILE ?? relativeLogFile;
  denoArgs.push("--allow-write=.local-test-logs");

  console.log(`Local edge test debug log: ${join(logDir, `${runId}.jsonl`)}`);
}

denoArgs.push(...process.argv.slice(2));

const result = spawnSync("deno", denoArgs, {
  cwd: functionsDir,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.signal) {
  console.error(`deno test exited with signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
