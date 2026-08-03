#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "../..");
const repositoryRoot = resolve(packageRoot, "..");
const planPath = resolve(packageRoot, "docs/INTEGRATION_EXEC_PLAN_V1.md");
const allowedSignersPath = resolve(packageRoot, "docs/integration-receipts/allowed_signers");
const manualApprovalSource = "/Volumes/DevSpace/Playground/JM AI-OS Pack/ops/MASTER_REVIEW_ROUND1.md";
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const gateIssuer = {
  "MANUAL-GATE-00": { role: "Fable5", identity: "fable5" },
  "MANUAL-GATE-02": { role: "MW Administrator", identity: "mw-admin", maxIssuedAgeMs: 7 * 24 * 60 * 60 * 1000 },
  "MANUAL-GATE-03A": { role: "Action Hub Administrator", identity: "action-hub-admin", maxIssuedAgeMs: 24 * 60 * 60 * 1000 },
  "MANUAL-GATE-03B": { role: "Action Hub Administrator", identity: "action-hub-admin" },
  "MANUAL-GATE-04": { role: "Fable5", identity: "fable5", maxIssuedAgeMs: 24 * 60 * 60 * 1000 },
  "MANUAL-GATE-05": { role: "Installed Target Owner", identity: "installed-target-owner", maxIssuedAgeMs: 24 * 60 * 60 * 1000 }
};
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const sha256Text = (value) => createHash("sha256").update(value).digest("hex");
const isHash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const isTimestamp = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && !Number.isNaN(Date.parse(value));

function fail(message) { throw new Error(message); }
function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${name} must be an object`);
  return value;
}
function currentHead() {
  const result = spawnSync("git", ["-C", repositoryRoot, "rev-parse", "HEAD"], { encoding: "utf8" });
  if (result.status !== 0) fail("unable to resolve repository HEAD");
  return result.stdout.trim();
}
function configuredAllowedSignersPath(options) {
  const configured = options?.allowedSignersPath ?? allowedSignersPath;
  if (typeof configured !== "string" || !configured.trim()) fail("allowed_signers path is invalid");
  return resolve(configured);
}
function validationNowMs(options) {
  const nowMs = options?.nowMs ?? Date.now();
  if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) fail("validation clock is invalid");
  return nowMs;
}
function verifySignature(receiptPath, receipt, expected, signersPath) {
  const signaturePath = `${receiptPath}.sig`;
  if (!existsSync(signaturePath) || !existsSync(signersPath)) fail("detached signature and allowed_signers are required");
  if (!isHash(receipt.inputs?.allowedSignersSha256) || receipt.inputs.allowedSignersSha256 !== sha256(signersPath)) fail("allowed_signers hash mismatch");
  const result = spawnSync("ssh-keygen", ["-Y", "verify", "-f", signersPath, "-I", expected.identity, "-n", "jm-ai-integration", "-s", signaturePath], { input: readFileSync(receiptPath), encoding: "utf8" });
  if (result.status !== 0) fail(`signature verification failed: ${(result.stderr || result.stdout).trim()}`);
}

export function validateGateReceipt(gateId, receiptPath, options = {}) {
  const expected = gateIssuer[gateId];
  if (!expected) fail(`unsupported gate: ${gateId}`);
  const signersPath = configuredAllowedSignersPath(options);
  const absoluteReceipt = resolve(receiptPath);
  let receipt;
  try { receipt = JSON.parse(readFileSync(absoluteReceipt, "utf8")); }
  catch { fail("receipt must be valid JSON"); }
  requireObject(receipt, "receipt");
  if (receipt.schemaVersion !== "jm-ai-integration-gate.v1") fail("schemaVersion mismatch");
  if (receipt.gateId !== gateId || receipt.decision !== "APPROVED") fail("gate decision mismatch");
  const issuer = requireObject(receipt.issuer, "issuer");
  if (issuer.role !== expected.role || typeof issuer.id !== "string" || !issuer.id.trim()) fail("issuer mismatch");
  const provenance = requireObject(receipt.provenance, "provenance");
  for (const field of ["provider", "sourceId", "messageId"]) if (typeof provenance[field] !== "string" || !provenance[field].trim()) fail(`missing provenance.${field}`);
  if (!isHash(provenance.contentSha256)) fail("invalid provenance.contentSha256");
  if (!isTimestamp(receipt.issuedAt)) fail("invalid issuedAt");
  if (receipt.expiresAt !== null && !isTimestamp(receipt.expiresAt)) fail("invalid expiresAt");
  const issuedAt = Date.parse(receipt.issuedAt);
  if (gateId !== "MANUAL-GATE-00") {
    const nowMs = validationNowMs(options);
    if (issuedAt > nowMs + MAX_FUTURE_CLOCK_SKEW_MS) fail("receipt issuedAt is too far in the future");
    if (expected.maxIssuedAgeMs !== undefined && issuedAt < nowMs - expected.maxIssuedAgeMs) fail("receipt issuedAt is too old for this gate");
    if (receipt.expiresAt !== null) {
      const expiresAt = Date.parse(receipt.expiresAt);
      if (expiresAt <= issuedAt) fail("receipt expiresAt must be after issuedAt");
      if (expiresAt <= nowMs) fail("receipt expired");
    }
  }
  const plan = requireObject(receipt.plan, "plan");
  if (plan.path !== "ai-work-automation-os-v0.9.0/docs/INTEGRATION_EXEC_PLAN_V1.md" || !isHash(plan.sha256) || plan.sha256 !== sha256(planPath)) fail("plan hash mismatch");
  const repository = requireObject(receipt.repository, "repository");
  if (!isAbsolute(repository.realpath) || repository.realpath !== realpathSync(repositoryRoot) || repository.head !== currentHead()) fail("repository binding mismatch");

  if (gateId === "MANUAL-GATE-00") {
    if (receipt.issuedAt !== "2026-08-03T00:00:00Z" || receipt.expiresAt !== null) fail("MANUAL-GATE-00 timestamp mismatch");
    const source = requireObject(receipt.approvalSource, "approvalSource");
    if (source.path !== manualApprovalSource || !isHash(source.sha256) || !existsSync(source.path) || source.sha256 !== sha256(source.path)) fail("approval source mismatch");
    const sourceText = readFileSync(source.path, "utf8");
    if (!sourceText.includes("APPROVED") || !sourceText.includes("2026-08-03") || provenance.contentSha256 !== sha256Text(sourceText)) fail("approval source content mismatch");
    const signaturePresent = existsSync(`${absoluteReceipt}.sig`) || existsSync(signersPath);
    if (signaturePresent) verifySignature(absoluteReceipt, receipt, expected, signersPath);
  } else {
    verifySignature(absoluteReceipt, receipt, expected, signersPath);
  }
  return { gateId, receiptPath: absoluteReceipt };
}

function pathsReferToSameFile(left, right) {
  try { return realpathSync(left) === realpathSync(right); }
  catch { return false; }
}
function runCli(argv) {
  const [, , gateId, receiptPath, ...extra] = argv;
  if (!gateId || !receiptPath || extra.length !== 0 || !gateIssuer[gateId]) {
    console.error("Usage: verify-gate-receipt.mjs <gate-id> <receipt-path>");
    return 64;
  }
  try {
    const result = validateGateReceipt(gateId, receiptPath);
    console.log(`PASS ${result.gateId}: ${result.receiptPath}`);
    return 0;
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : "unknown validation error"}`);
    return 1;
  }
}

if (process.argv[1] && pathsReferToSameFile(process.argv[1], fileURLToPath(import.meta.url))) process.exitCode = runCli(process.argv);
