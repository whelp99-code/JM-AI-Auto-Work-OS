import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateGateReceipt } from "./verify-gate-receipt.mjs";

const packageRoot = resolve(import.meta.dirname, "../..");
const verifierPath = join(import.meta.dirname, "verify-gate-receipt.mjs");
const canonicalReceipt = join(packageRoot, "docs/integration-receipts/PLAN_APPROVAL.json");
const canonical = JSON.parse(readFileSync(canonicalReceipt, "utf8"));
const signedGateProfiles = {
  "MANUAL-GATE-02": { role: "MW Administrator", identity: "mw-admin" },
  "MANUAL-GATE-03A": { role: "Action Hub Administrator", identity: "action-hub-admin" },
  "MANUAL-GATE-03B": { role: "Action Hub Administrator", identity: "action-hub-admin" },
  "MANUAL-GATE-04": { role: "Fable5", identity: "fable5" },
  "MANUAL-GATE-05": { role: "Installed Target Owner", identity: "installed-target-owner" }
};
const digest = (value) => createHash("sha256").update(value).digest("hex");
const digestFile = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const commandError = (result) => result.error?.message || result.stderr || result.stdout || "command failed";

function receiptFixture(mutator = () => {}) {
  const receipt = structuredClone(canonical);
  mutator(receipt);
  const dir = mkdtempSync(join(tmpdir(), "aiwa-gate-receipt-"));
  const path = join(dir, "receipt.json");
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
  return path;
}

function makeKey(directory, name) {
  const path = join(directory, name);
  const result = spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", path], { encoding: "utf8" });
  assert.equal(result.status, 0, `ssh-keygen must be available for fail-closed signature coverage: ${commandError(result)}`);
  return path;
}

function signedFixture({ gateId = "MANUAL-GATE-04", mutate = () => {}, signWithWrongKey = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "aiwa-gate-signature-"));
  const allowedSignersPath = join(directory, "allowed_signers");
  const key = makeKey(directory, "allowed");
  const signingKey = signWithWrongKey ? makeKey(directory, "wrong") : key;
  const profile = gateId === "MANUAL-GATE-00" ? { role: "Fable5", identity: "fable5" } : signedGateProfiles[gateId];
  assert.ok(profile, `missing signed gate profile for ${gateId}`);
  const receipt = structuredClone(canonical);
  receipt.gateId = gateId;
  receipt.issuer = { role: profile.role, id: `${profile.identity}-receipt` };
  if (gateId !== "MANUAL-GATE-00") {
    receipt.issuedAt = new Date().toISOString();
    receipt.expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }
  mutate(receipt);
  const receiptPath = join(directory, "receipt.json");
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  const publicKey = readFileSync(`${key}.pub`, "utf8").trim();
  writeFileSync(allowedSignersPath, `${profile.identity} ${publicKey}\n`);
  receipt.inputs = { ...receipt.inputs, allowedSignersSha256: digestFile(allowedSignersPath) };
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  const result = spawnSync("ssh-keygen", ["-Y", "sign", "-f", signingKey, "-n", "jm-ai-integration", receiptPath], { encoding: "utf8" });
  assert.equal(result.status, 0, `ssh-keygen must create detached signatures: ${commandError(result)}`);
  assert.ok(existsSync(`${receiptPath}.sig`), "ssh-keygen must produce a detached signature");
  return { directory, receiptPath, allowedSignersPath, key };
}

test("MANUAL-GATE-00 accepts the normalized authoritative file receipt without SSH material", () => {
  const absentSignersPath = join(mkdtempSync(join(tmpdir(), "aiwa-gate-absent-")), "allowed_signers");
  assert.deepEqual(validateGateReceipt("MANUAL-GATE-00", canonicalReceipt, { allowedSignersPath: absentSignersPath }).gateId, "MANUAL-GATE-00");
});

test("MANUAL-GATE-00 rejects partial SSH material and accepts a complete optional signature", () => {
  const signatureOnly = receiptFixture();
  writeFileSync(`${signatureOnly}.sig`, "partial signature");
  assert.throws(() => validateGateReceipt("MANUAL-GATE-00", signatureOnly, { allowedSignersPath: join(tmpdir(), "missing-allowed_signers") }));

  const allowedOnly = receiptFixture();
  const allowedOnlyPath = join(mkdtempSync(join(tmpdir(), "aiwa-gate-partial-")), "allowed_signers");
  writeFileSync(allowedOnlyPath, "fable5 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIE9ubHktcGFydGlhbC1tYXRlcmlhbA== partial\n");
  assert.throws(() => validateGateReceipt("MANUAL-GATE-00", allowedOnly, { allowedSignersPath: allowedOnlyPath }));

  const signed = signedFixture({ gateId: "MANUAL-GATE-00" });
  assert.deepEqual(
    validateGateReceipt("MANUAL-GATE-00", signed.receiptPath, { allowedSignersPath: signed.allowedSignersPath }).gateId,
    "MANUAL-GATE-00"
  );
});

for (const [name, mutate] of [
  ["wrong plan hash", (receipt) => { receipt.plan.sha256 = "0".repeat(64); }],
  ["expired receipt", (receipt) => { receipt.expiresAt = "2026-08-02T00:00:00Z"; }],
  ["wrong issuer", (receipt) => { receipt.issuer.role = "MW Administrator"; }],
  ["missing provenance", (receipt) => { delete receipt.provenance.messageId; }],
  ["malformed timestamp", (receipt) => { receipt.issuedAt = "2026-08-03"; }],
  ["approval source hash mismatch", (receipt) => { receipt.approvalSource.sha256 = "f".repeat(64); }],
  ["forged approval provenance", (receipt) => { receipt.provenance.contentSha256 = digest("forged"); }]
]) {
  test(`MANUAL-GATE-00 rejects ${name}`, () => {
    assert.throws(() => validateGateReceipt("MANUAL-GATE-00", receiptFixture(mutate)));
  });
}

test("signed gates accept a valid ed25519 detached signature", () => {
  const signed = signedFixture();
  assert.deepEqual(
    validateGateReceipt("MANUAL-GATE-04", signed.receiptPath, { allowedSignersPath: signed.allowedSignersPath }).gateId,
    "MANUAL-GATE-04"
  );
});

test("signed gates reject a detached signature from a wrong ed25519 key", () => {
  const signed = signedFixture({ signWithWrongKey: true });
  assert.throws(() => validateGateReceipt("MANUAL-GATE-04", signed.receiptPath, { allowedSignersPath: signed.allowedSignersPath }));
});

test("signed gates reject forged receipt bytes after a valid detached signature", () => {
  const signed = signedFixture();
  writeFileSync(signed.receiptPath, `${readFileSync(signed.receiptPath, "utf8")}\n`);
  assert.throws(() => validateGateReceipt("MANUAL-GATE-04", signed.receiptPath, { allowedSignersPath: signed.allowedSignersPath }));
});

test("signed gates reject allowed_signers byte drift", () => {
  const signed = signedFixture();
  writeFileSync(signed.allowedSignersPath, `${readFileSync(signed.allowedSignersPath, "utf8")}# byte drift\n`);
  assert.throws(() => validateGateReceipt("MANUAL-GATE-04", signed.receiptPath, { allowedSignersPath: signed.allowedSignersPath }));
});

test("signed gates reject issuedAt materially in the future", () => {
  const signed = signedFixture({ mutate: (receipt) => { receipt.issuedAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); } });
  assert.throws(() => validateGateReceipt("MANUAL-GATE-04", signed.receiptPath, { allowedSignersPath: signed.allowedSignersPath }), /future/);
});

test("signed gates reject expiresAt at or before issuedAt", () => {
  const signed = signedFixture({ mutate: (receipt) => { receipt.expiresAt = receipt.issuedAt; } });
  assert.throws(() => validateGateReceipt("MANUAL-GATE-04", signed.receiptPath, { allowedSignersPath: signed.allowedSignersPath }), /after issuedAt/);
});

test("MANUAL-GATE-04 rejects a signed receipt older than 24 hours", () => {
  const nowMs = Date.parse("2026-08-03T12:00:00Z");
  const signed = signedFixture({ mutate: (receipt) => {
    receipt.issuedAt = new Date(nowMs - 24 * 60 * 60 * 1000 - 1).toISOString();
    receipt.expiresAt = new Date(nowMs + 60 * 60 * 1000).toISOString();
  } });
  assert.throws(() => validateGateReceipt("MANUAL-GATE-04", signed.receiptPath, { allowedSignersPath: signed.allowedSignersPath, nowMs }), /too old/);
});

test("MANUAL-GATE-02 rejects a signed receipt older than seven days and accepts a current one", () => {
  const nowMs = Date.parse("2026-08-03T12:00:00Z");
  const stale = signedFixture({ gateId: "MANUAL-GATE-02", mutate: (receipt) => {
    receipt.issuedAt = new Date(nowMs - 7 * 24 * 60 * 60 * 1000 - 1).toISOString();
    receipt.expiresAt = new Date(nowMs + 60 * 60 * 1000).toISOString();
  } });
  assert.throws(() => validateGateReceipt("MANUAL-GATE-02", stale.receiptPath, { allowedSignersPath: stale.allowedSignersPath, nowMs }), /too old/);

  const current = signedFixture({ gateId: "MANUAL-GATE-02", mutate: (receipt) => {
    receipt.issuedAt = new Date(nowMs - 6 * 24 * 60 * 60 * 1000).toISOString();
    receipt.expiresAt = new Date(nowMs + 60 * 60 * 1000).toISOString();
  } });
  assert.equal(validateGateReceipt("MANUAL-GATE-02", current.receiptPath, { allowedSignersPath: current.allowedSignersPath, nowMs }).gateId, "MANUAL-GATE-02");
});

test("CLI temp copies through logical /var and physical paths reject missing arguments with Usage", () => {
  const directory = mkdtempSync(join("/var/tmp", "aiwa-gate-cli-"));
  const logicalCopy = join(directory, "verify-gate-receipt.mjs");
  cpSync(verifierPath, logicalCopy);
  const physicalCopy = join(realpathSync(directory), "verify-gate-receipt.mjs");
  const logicalVarCopy = physicalCopy.replace(/^\/private\/var\//, "/var/");
  assert.match(logicalVarCopy, /^\/var\//);
  for (const path of [logicalVarCopy, physicalCopy]) {
    const result = spawnSync(process.execPath, [path], { encoding: "utf8" });
    assert.equal(result.status, 64, `${path}: ${commandError(result)}`);
    assert.match(result.stderr, /Usage: verify-gate-receipt\.mjs/);
  }
});
