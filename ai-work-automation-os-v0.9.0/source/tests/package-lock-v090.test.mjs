import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const packagePath = join(root, "package.json");
const lockPath = join(root, "package-lock.json");
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
let npmCiInvocations = 0;
const runNpmCi = (cwd) => {
  npmCiInvocations += 1;
  return spawnSync("npm", ["ci", "--ignore-scripts"], { cwd, encoding: "utf8" });
};

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "aiwa-lock-v090-"));
  cpSync(packagePath, join(directory, "package.json"));
  cpSync(lockPath, join(directory, "package-lock.json"));
  return directory;
}

function assertDirectPackageLockConsistency(packageFile, lockFile) {
  const pkg = JSON.parse(readFileSync(packageFile, "utf8"));
  const lock = JSON.parse(readFileSync(lockFile, "utf8"));
  assert.equal(lock.lockfileVersion, 3, "package-lock must remain lockfile v3");
  assert.deepEqual(lock.packages[""].dependencies, pkg.dependencies, "direct dependencies must match package-lock");
  assert.deepEqual(lock.packages[""].devDependencies, pkg.devDependencies, "direct devDependencies must match package-lock");
}

test("lockfile v3 matches every direct package.json dependency", () => {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  assertDirectPackageLockConsistency(packagePath, lockPath);
  assert.equal(lock.name, "ai-work-automation-os");
  assert.equal(lock.version, "0.9.0");
  assert.equal(Object.keys(pkg.dependencies).length + Object.keys(pkg.devDependencies).length, 11);
});

test("npm ci accepts the lock alone and leaves its bytes unchanged", () => {
  const directory = fixture();
  const fixtureLock = join(directory, "package-lock.json");
  const before = digest(fixtureLock);
  const result = runNpmCi(directory);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(digest(fixtureLock), before);
});

test("a package specification mismatch is deterministic, lock-preserving, and never invokes npm", () => {
  const directory = fixture();
  const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  pkg.dependencies["left-pad"] = "1.3.0";
  writeFileSync(join(directory, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  const before = digest(join(directory, "package-lock.json"));
  const beforeInvocations = npmCiInvocations;
  assert.throws(
    () => assertDirectPackageLockConsistency(join(directory, "package.json"), join(directory, "package-lock.json")),
    /direct dependencies must match package-lock/
  );
  assert.equal(npmCiInvocations, beforeInvocations, "mismatch detection must not invoke npm or access a registry");
  assert.equal(digest(join(directory, "package-lock.json")), before);
});
