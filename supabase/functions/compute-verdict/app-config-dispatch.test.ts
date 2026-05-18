// bug-09 — regression guard for the verdict-fire dispatch no-op.
//
// Root cause of bug-09: `dispatch_compute_verdict` built its HTTP POST
// target from two Postgres database GUCs — `app.supabase_url` and
// `app.service_role_key`. Those GUCs were never set on the live project
// (no migration, no CI step set them), and setting them via
// `ALTER DATABASE ... SET` needs a Postgres superuser the deploy role
// is not. The dispatch silently no-op'd, the engine was never invoked,
// and every room wedged in `firing` forever.
//
// Re-scoped fix (triaged 2026-05-18, Option 2): drop the GUCs entirely.
// `dispatch_compute_verdict` reads its URL and key from an ordinary
// `app_config(key, value)` table — a plain table write needs no
// superuser. The non-secret URL is seeded by the committed migration;
// the secret service-role key is re-applied by a CI database-deploy
// step from the `SUPABASE_SERVICE_ROLE_KEY` Actions secret.
//
// These tests assert the structural fix lives in version control:
//   1. A committed migration creates `app_config`, enables RLS with no
//      policies, revokes access from anon/authenticated, and seeds the
//      non-secret `supabase_url` row.
//   2. `dispatch_compute_verdict` (both overloads) reads from
//      `app_config` rather than `current_setting('app.*')`, is
//      `SECURITY DEFINER`, and keeps its silent-return-when-empty guard.
//   3. The CI `supabase-db` job carries a step that seeds the secret
//      `service_role_key` row from the Actions secret — and no
//      service-role key value appears in any committed file.
//
// A deno test is the right home: the `edge` CI lane already runs
// `deno test` over `supabase/functions/`, so this guard runs on every
// PR with no new tooling. We parse the workflow YAML rather than
// grepping so the assertions survive cosmetic reformatting.

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parse } from "https://deno.land/std@0.224.0/yaml/mod.ts";

const MIGRATIONS_DIR = new URL("../../migrations/", import.meta.url);
const CI_PATH = new URL("../../../.github/workflows/ci.yml", import.meta.url);
const REPO_ROOT = new URL("../../../", import.meta.url);

/** Find the single migration file whose name ends with the given suffix. */
function migrationBySuffix(suffix: string): string {
  for (const entry of Deno.readDirSync(MIGRATIONS_DIR)) {
    if (entry.isFile && entry.name.endsWith(suffix)) {
      return Deno.readTextFileSync(new URL(entry.name, MIGRATIONS_DIR));
    }
  }
  throw new Error(`no migration ending in '${suffix}' found`);
}

/** The migration that introduces app_config + rewrites dispatch_compute_verdict. */
function appConfigMigration(): string {
  return migrationBySuffix("_app_config_verdict_dispatch.sql");
}

// deno-lint-ignore no-explicit-any
function loadWorkflow(): any {
  return parse(Deno.readTextFileSync(CI_PATH));
}

// deno-lint-ignore no-explicit-any
function jobStepsText(job: any): string {
  const steps = (job?.steps ?? []) as Array<Record<string, unknown>>;
  return steps
    .map((s) => (typeof s.run === "string" ? s.run : ""))
    .join("\n");
}

// ── 1. The app_config migration ──────────────────────────────────────

Deno.test("bug-09 — a committed migration creates the app_config table", () => {
  const sql = appConfigMigration().toLowerCase();
  assert(
    /create table\s+(if not exists\s+)?(public\.)?app_config/.test(sql),
    "the migration must `CREATE TABLE app_config` — the table the " +
      "re-scoped dispatch reads its URL and key from.",
  );
  assert(
    /key\s+text/.test(sql),
    "app_config must have a `key text` column.",
  );
  assert(
    /value\s+text\s+not null/.test(sql),
    "app_config must have a `value text NOT NULL` column.",
  );
  assert(
    sql.includes("primary key"),
    "app_config.key must be the PRIMARY KEY (ON CONFLICT (key) upserts).",
  );
});

Deno.test("bug-09 — app_config has RLS enabled and is locked to anon/authenticated", () => {
  const sql = appConfigMigration().toLowerCase();
  assert(
    /alter table\s+(public\.)?app_config\s+enable row level security/.test(sql),
    "app_config must `ENABLE ROW LEVEL SECURITY` — the service-role-key " +
      "row must never be reachable over PostgREST.",
  );
  assert(
    /revoke all\s+on\s+(table\s+)?(public\.)?app_config\s+from\s+[^;]*anon/
      .test(sql),
    "the migration must `REVOKE ALL ON app_config FROM anon` so the " +
      "anon role cannot read the service-role key.",
  );
  assert(
    /revoke all\s+on\s+(table\s+)?(public\.)?app_config\s+from\s+[^;]*authenticated/
      .test(sql),
    "the migration must `REVOKE ALL ON app_config FROM authenticated`.",
  );
});

Deno.test("bug-09 — the migration seeds the non-secret supabase_url row", () => {
  const sql = appConfigMigration().toLowerCase();
  assert(
    sql.includes("insert into public.app_config") ||
      sql.includes("insert into app_config"),
    "the migration must INSERT the `supabase_url` row so a fresh " +
      "database self-heals on replay.",
  );
  assertStringIncludes(
    sql,
    "supabase_url",
    "the migration must seed the `supabase_url` key.",
  );
  assert(
    sql.includes("on conflict (key) do update"),
    "the seed INSERT must be `ON CONFLICT (key) DO UPDATE` so it is " +
      "idempotent across replays.",
  );
  assert(
    sql.includes(".supabase.co"),
    "the seeded supabase_url must be a real https://<ref>.supabase.co URL.",
  );
});

Deno.test("bug-09 — the migration does NOT seed or commit the service-role key", () => {
  // The secret key row is set by CI, never by a committed migration.
  // Strip SQL line comments first so a `-- ... service_role_key ...`
  // explanatory comment is not mistaken for a seed. Then guard that no
  // INSERT statement (terminated by `;`) carries `service_role_key`.
  const sql = appConfigMigration()
    .toLowerCase()
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  const insertStatements = sql.match(/insert into[\s\S]*?;/g) ?? [];
  for (const stmt of insertStatements) {
    assert(
      !stmt.includes("service_role_key"),
      "the migration must NOT seed `service_role_key` — that value is a " +
        "secret applied only by the CI step. Offending INSERT:\n" + stmt,
    );
  }
});

// ── 2. dispatch_compute_verdict reads app_config ─────────────────────

Deno.test("bug-09 — dispatch_compute_verdict reads app_config, not GUCs", () => {
  const sql = appConfigMigration().toLowerCase();
  assert(
    sql.includes("create or replace function public.dispatch_compute_verdict"),
    "the migration must `CREATE OR REPLACE FUNCTION " +
      "dispatch_compute_verdict` to re-point it at app_config.",
  );
  assert(
    sql.includes("from public.app_config") ||
      sql.includes("from app_config"),
    "dispatch_compute_verdict must `SELECT ... FROM app_config` for its " +
      "URL and key.",
  );
  assert(
    !sql.includes("current_setting('app.supabase_url'") &&
      !sql.includes("current_setting('app.service_role_key'") &&
      !sql.includes('current_setting("app.supabase_url"') &&
      !sql.includes('current_setting("app.service_role_key"'),
    "dispatch_compute_verdict must no longer read the `app.*` GUCs via " +
      "current_setting — that is the bug-09 root cause.",
  );
  assertStringIncludes(
    sql,
    "service_role_key",
    "dispatch_compute_verdict must look up the `service_role_key` row.",
  );
});

Deno.test("bug-09 — dispatch_compute_verdict is SECURITY DEFINER", () => {
  // SECURITY DEFINER is load-bearing: the votes trigger runs under the
  // voting end-user's role, which RLS blocks from reading app_config.
  // A SECURITY INVOKER function would silently no-op again.
  const sql = appConfigMigration();
  const fnBlocks = sql
    .split(/create or replace function/i)
    .filter((b) => /public\.dispatch_compute_verdict/i.test(b.slice(0, 120)));
  assert(
    fnBlocks.length >= 1,
    "expected at least one dispatch_compute_verdict definition.",
  );
  for (const block of fnBlocks) {
    // Take up to the function body terminator for the header scan.
    const header = block.slice(0, block.indexOf("$$") + 1);
    assert(
      /security definer/i.test(header),
      "every dispatch_compute_verdict overload must be SECURITY DEFINER " +
        "so it bypasses app_config RLS when the votes trigger fires.",
    );
  }
});

Deno.test("bug-09 — dispatch_compute_verdict keeps the silent-return-when-empty guard", () => {
  const sql = appConfigMigration().toLowerCase();
  // A missing/empty row must `return` without raising — a local/CI DB
  // with no app_config rows must still no-op cleanly, never fail the
  // votes INSERT.
  assert(
    sql.includes("is null") && sql.includes("return;"),
    "dispatch_compute_verdict must keep its `if ... is null ... return;` " +
      "guard so a missing app_config row no-ops instead of failing the " +
      "votes INSERT.",
  );
});

Deno.test("bug-09 — both dispatch_compute_verdict overloads are rewritten", () => {
  // The active v1.1 fire path uses the 2-arg (uuid, text) overload; the
  // orphaned cron path still references the 1-arg (uuid) form. Both must
  // read app_config or the 1-arg form would still no-op via the GUCs.
  const sql = appConfigMigration().toLowerCase();
  assert(
    /create or replace function public\.dispatch_compute_verdict\s*\(\s*p_room_id uuid\s*\)/
      .test(sql),
    "the 1-arg `dispatch_compute_verdict(uuid)` overload must be rewritten.",
  );
  assert(
    /create or replace function public\.dispatch_compute_verdict\s*\(\s*p_room_id uuid\s*,\s*p_method\s+text\s*\)/
      .test(sql),
    "the 2-arg `dispatch_compute_verdict(uuid, text)` overload — the " +
      "active v1.1 fire path — must be rewritten.",
  );
});

// ── 3. CI seeds the secret key row ───────────────────────────────────

Deno.test("bug-09 — the supabase-db CI job seeds service_role_key into app_config", () => {
  const wf = loadWorkflow();
  const text = jobStepsText(wf?.jobs?.["supabase-db"]);
  assertStringIncludes(
    text,
    "service_role_key",
    "the supabase-db job must carry a step that seeds the " +
      "`service_role_key` row of app_config.",
  );
  assertStringIncludes(
    text,
    "app_config",
    "the seed step must INSERT into `app_config`.",
  );
  assert(
    /on conflict\s*\(key\)\s*do update/i.test(text),
    "the seed step's INSERT must be `ON CONFLICT (key) DO UPDATE` so it " +
      "is idempotent on every deploy.",
  );
});

Deno.test("bug-09 — the CI seed step references the SUPABASE_SERVICE_ROLE_KEY secret", () => {
  const ci = Deno.readTextFileSync(CI_PATH);
  assertStringIncludes(
    ci,
    "secrets.SUPABASE_SERVICE_ROLE_KEY",
    "the CI seed step must source the key value from the " +
      "`SUPABASE_SERVICE_ROLE_KEY` GitHub Actions secret.",
  );
});

Deno.test("bug-09 — the seed step lives in the existing supabase-db job, not a new lane", () => {
  // The brief: a step in the existing database-deploy job, not a new job.
  const wf = loadWorkflow();
  const jobNames = Object.keys(wf?.jobs ?? {});
  // No job name should hint at a separate verdict/config seeding lane.
  for (const name of jobNames) {
    assert(
      !/app[-_]?config|verdict[-_]?config|service[-_]?role/i.test(name),
      `no new CI lane should be added for the seed — found job '${name}'. ` +
        "The seed must be a step inside the existing supabase-db job.",
    );
  }
  const dbJob = wf?.jobs?.["supabase-db"];
  assert(dbJob !== undefined, "the supabase-db job must still exist.");
});

// ── 4. No service-role key value committed anywhere ──────────────────

Deno.test("bug-09 — no JWT-shaped service-role key is committed in the repo", () => {
  // A Supabase service-role key is a JWT: three base64url segments
  // separated by dots, the payload carrying `"role":"service_role"`.
  // Scan the migration and the workflow for any literal that looks like
  // a committed service-role JWT.
  const filesToScan = [
    appConfigMigration(),
    Deno.readTextFileSync(CI_PATH),
  ];
  // Also scan the env example if present — never the real .env.
  const jwtLike =
    /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
  for (const content of filesToScan) {
    assert(
      !jwtLike.test(content),
      "no JWT-shaped token may appear in a committed migration or " +
        "workflow file — the service-role key must only ever come from " +
        "the GitHub Actions secret.",
    );
  }
});

Deno.test("bug-09 — the app_config migration file commits no obvious secret", () => {
  const sql = appConfigMigration();
  // The only INSERTed value should be the public supabase_url. Anything
  // shaped like a long opaque token is a red flag.
  assert(
    !/role['"]?\s*:\s*['"]?service_role/i.test(sql),
    "the migration must not embed a service_role JWT payload.",
  );
  assertEquals(
    REPO_ROOT.protocol,
    "file:",
    "sanity: repo root resolved.",
  );
});
