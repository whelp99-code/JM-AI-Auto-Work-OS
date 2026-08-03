import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const run = (command, args, env = {}) => spawnSync(command, args, { cwd: root, env: { ...process.env, ...env }, encoding: "utf8" });

test("offline verifier requires the project-local TypeScript compiler", () => {
  const result = run("bash", ["verify-offline.sh", "--check-toolchain"], { AIWA_TSC_BIN: "/definitely/missing/tsc" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TypeScript compiler unavailable/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /PASS v0\.9\.0 offline verification/);
});

test("offline verifier toolchain check succeeds with the installed local compiler", () => {
  const result = run("bash", ["verify-offline.sh", "--check-toolchain"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS TypeScript compiler available/);
});

test("runtime runner rejects unsafe test database URLs before reset", () => {
  const result = run("bash", ["scripts/run-runtime-tests-v090.sh"], { AIWA_TEST_DATABASE_URL: "postgresql://unsafe/test" });
  assert.equal(result.status, 64, result.stderr);
  assert.match(result.stderr, /must be a file: URL/);
});

test("runtime runner rejects production and symlink database paths before reset", () => {
  const production = run("bash", ["scripts/run-runtime-tests-v090.sh", "--check-database-url"], { AIWA_TEST_DATABASE_URL: "file:../data/ai-work-automation.db" });
  assert.equal(production.status, 64, production.stderr);
  assert.match(production.stderr, /absolute file path|parent directory must exist|disposable temporary directory/);

  const directory = mkdtempSync(join(tmpdir(), "aiwa-runner-link-"));
  const link = join(directory, "runtime-link.db");
  symlinkSync(join(directory, "target.db"), link);
  const symlink = run("bash", ["scripts/run-runtime-tests-v090.sh", "--check-database-url"], { AIWA_TEST_DATABASE_URL: `file:${link}` });
  assert.equal(symlink.status, 64, symlink.stderr);
  assert.match(symlink.stderr, /must not be a symlink/);
});

test("runtime runner rejects explicit relative traversal and a default data-parent symlink before reset", () => {
  const traversal = run("bash", ["scripts/run-runtime-tests-v090.sh", "--check-database-url"], { AIWA_TEST_DATABASE_URL: "file:../data/test-v0.9.0.db" });
  assert.equal(traversal.status, 64, traversal.stderr);
  assert.match(traversal.stderr, /absolute file path/);

  const fixtureRoot = mkdtempSync(join(tmpdir(), "aiwa-runner-default-root-"));
  const escapedData = mkdtempSync(join(tmpdir(), "aiwa-runner-escaped-data-"));
  symlinkSync(escapedData, join(fixtureRoot, "data"));
  const defaultSymlink = run("bash", ["scripts/run-runtime-tests-v090.sh", "--check-database-url"], { AIWA_RUNTIME_ROOT: fixtureRoot });
  assert.equal(defaultSymlink.status, 64, defaultSymlink.stderr);
  assert.match(defaultSymlink.stderr, /default test database must not use a symlink/);
});

test("runtime runner accepts a fresh disposable temporary database path without reset", () => {
  const directory = mkdtempSync(join(tmpdir(), "aiwa-runner-positive-"));
  const result = run("bash", ["scripts/run-runtime-tests-v090.sh", "--check-database-url"], { AIWA_TEST_DATABASE_URL: `file:${join(directory, "runtime-test.db")}` });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS test database URL accepted: file:\/private\/var\//);
});

test("verification scripts have no fixed compiler path or skip branch", () => {
  const offline = readFileSync(resolve(root, "verify-offline.sh"), "utf8");
  const pure = readFileSync(resolve(root, "verification/scripts/v090_pure_tests.mjs"), "utf8");
  const syntax = readFileSync(resolve(root, "verification/scripts/v090_ts_syntax.mjs"), "utf8");
  assert.doesNotMatch(`${offline}\n${pure}\n${syntax}`, /\/opt\/nvm|SKIP/);
  assert.match(offline, /AIWA_TSC_BIN/);
  assert.match(pure, /import ts from "typescript"/);
  assert.match(syntax, /fileURLToPath/);
});
