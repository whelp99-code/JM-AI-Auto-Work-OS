#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
if (!args.has("--yes")) throw new Error("Refusing rollback without --yes");
const index = process.argv.indexOf("--from");
const explicit = index >= 0 ? resolve(process.argv[index + 1]) : null;
const raw = process.env.DATABASE_URL ?? "file:../data/ai-work-automation.db";
if (!raw.startsWith("file:")) throw new Error("SQLite file URL required");
const current = resolve(process.cwd(), "prisma", raw.slice(5));
const source = explicit ?? `${current}.v0.8.0`;
if (!existsSync(source)) throw new Error(`v0.8.0 rollback source not found: ${source}`);
mkdirSync(dirname(current), { recursive: true });
const safety = `${current}.v0.9.0.rollback-safety.${new Date().toISOString().replace(/[:.]/g, "-")}`;
if (existsSync(current)) renameSync(current, safety);
try {
  copyFileSync(source, current);
} catch (error) {
  if (existsSync(safety)) renameSync(safety, current);
  throw error;
}
for (const suffix of ["-wal", "-shm"]) rmSync(current + suffix, { force: true });
console.log(JSON.stringify({ rolledBack: true, from: source, to: current, safetyBackup: safety, file: basename(current) }, null, 2));
