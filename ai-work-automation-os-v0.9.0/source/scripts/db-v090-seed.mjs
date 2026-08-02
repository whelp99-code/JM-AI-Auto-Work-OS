#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createV090Schema, SCHEMA_VERSION } from "./db-v090-schema.mjs";

function databasePath() {
  const raw = process.env.DATABASE_URL ?? "file:../data/ai-work-automation.db";
  if (!raw.startsWith("file:")) throw new Error("Local seed supports SQLite file: URLs only");
  return resolve(process.cwd(), "prisma", raw.slice(5));
}
const path = databasePath(); mkdirSync(dirname(path), { recursive: true });
const db = new DatabaseSync(path); createV090Schema(db);
const now = new Date().toISOString();
db.prepare(`INSERT INTO workspace(id,name,slug,schema_version,mode,owner_principal_id,settings_json,created_at,updated_at)
VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET schema_version=excluded.schema_version,updated_at=excluded.updated_at`).run(
  "local_workspace", "AI Work Automation OS", process.env.COMPANY_LOCAL_ORGANIZATION_SLUG ?? "ai-company",
  SCHEMA_VERSION, "local", process.env.COMPANY_LOCAL_PRINCIPAL_ID ?? "local:owner",
  JSON.stringify({ version: SCHEMA_VERSION, seededAt: now }), now, now
);
db.close(); console.log(JSON.stringify({ seeded: true, path, existed: existsSync(path), schemaVersion: SCHEMA_VERSION }, null, 2));
