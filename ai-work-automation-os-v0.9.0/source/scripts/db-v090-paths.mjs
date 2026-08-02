import { resolve, dirname } from "node:path";
import process from "node:process";

export function sqlitePath(explicit) {
  if (explicit) return resolve(explicit);
  const raw = process.env.DATABASE_URL || "file:../data/ai-work-automation.db";
  if (!raw.startsWith("file:")) throw new Error("Local v0.9.0 supports SQLite file: URLs only");
  return resolve(process.cwd(), "prisma", raw.slice(5));
}

export function databaseUrlFor(path) {
  return `file:${resolve(path)}`;
}

export function parent(path) { return dirname(resolve(path)); }
