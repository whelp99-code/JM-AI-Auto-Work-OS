import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { addOutOfOrderOrganizationFixture, createV080Fixture } from "./helpers/create-v080-fixture.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

function migrate(dbPath, ...extra) {
  return spawnSync(process.execPath, [join(root, "scripts/db-v090-migrate.mjs"), "--db", dbPath, "--backup-dir", join(join(dbPath, ".."), "backups"), ...extra], { cwd: root, encoding: "utf8" });
}

test("v0.8.0 database is atomically rebuilt and preserves core records", () => {
  const dir = mkdtempSync(join(tmpdir(), "aiwa-v090-"));
  const dbPath = join(dir, "legacy.db");
  createV080Fixture(dbPath);
  const result = spawnSync(process.execPath, [join(root, "scripts/db-v090-migrate.mjs"), "--db", dbPath, "--backup-dir", join(dir, "backups")], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(existsSync(`${dbPath}.v0.8.0`));
  const db = new DatabaseSync(dbPath, { readOnly: true });
  assert.equal(db.prepare("SELECT schema_version v FROM workspace").get().v, "0.9.0");
  assert.equal(db.prepare("SELECT COUNT(*) c FROM mission").get().c, 1);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM work_item").get().c, 1);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM review").get().c, 1);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM approval").get().c, 1);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM artifact").get().c, 1);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});

test("team and manager relations are restored independently of legacy row order", () => {
  const dir = mkdtempSync(join(tmpdir(), "aiwa-v090-relations-"));
  const dbPath = join(dir, "legacy.db");
  createV080Fixture(dbPath);
  addOutOfOrderOrganizationFixture(dbPath);
  const result = spawnSync(process.execPath, [join(root, "scripts/db-v090-migrate.mjs"), "--db", dbPath, "--backup-dir", join(dir, "backups")], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  assert.equal(db.prepare("SELECT parent_id parent FROM org_unit WHERE id='team-child'").get().parent, "team-parent");
  assert.equal(db.prepare("SELECT manager_agent_id manager FROM agent WHERE id='agent-child'").get().manager, "agent-manager");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});

test("dry-run and unsupported-schema failures never modify the source database", () => {
  const dir = mkdtempSync(join(tmpdir(), "aiwa-v090-safe-"));
  const dbPath = join(dir, "legacy.db");
  createV080Fixture(dbPath);
  const before = hash(dbPath);
  const dry = spawnSync(process.execPath, [join(root, "scripts/db-v090-migrate.mjs"), "--db", dbPath, "--dry-run"], { cwd: root, encoding: "utf8" });
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(hash(dbPath), before);

  const unknown = join(dir, "unknown.db");
  const db = new DatabaseSync(unknown); db.exec("CREATE TABLE random_table(id TEXT PRIMARY KEY)"); db.close();
  const unknownBefore = hash(unknown);
  const failed = spawnSync(process.execPath, [join(root, "scripts/db-v090-migrate.mjs"), "--db", unknown], { cwd: root, encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.equal(hash(unknown), unknownBefore);
});

test("already rebuilt database is a safe no-op", () => {
  const dir = mkdtempSync(join(tmpdir(), "aiwa-v090-noop-"));
  const dbPath = join(dir, "new.db");
  let result = spawnSync(process.execPath, [join(root, "scripts/db-v090-migrate.mjs"), "--db", dbPath], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const before = hash(dbPath);
  result = spawnSync(process.execPath, [join(root, "scripts/db-v090-migrate.mjs"), "--db", dbPath], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /already-v0\.9\.0/);
  assert.equal(hash(dbPath), before);
});

test("explicit rollback restores the v0.8.0 sidecar and keeps a v0.9.0 safety copy", () => {
  const dir = mkdtempSync(join(tmpdir(), "aiwa-v090-rollback-"));
  const dbPath = join(dir, "legacy.db");
  createV080Fixture(dbPath);
  let result = spawnSync(process.execPath, [join(root, "scripts/db-v090-migrate.mjs"), "--db", dbPath, "--backup-dir", join(dir, "backups")], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync(process.execPath, [join(root, "scripts/db-v090-rollback.mjs"), "--from", `${dbPath}.v0.8.0`, "--yes"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  assert.equal(db.prepare("SELECT COUNT(*) c FROM Mission").get().c, 1);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM Organization").get().c, 1);
  db.close();
  const parsed = JSON.parse(result.stdout);
  assert.ok(existsSync(parsed.safetyBackup));
});
