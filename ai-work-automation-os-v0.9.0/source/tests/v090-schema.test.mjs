import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { CORE_TABLES, SCHEMA_VERSION, createV090Schema, detectSchemaGeneration, listUserTables } from "../scripts/db-v090-schema.mjs";

test("v0.9.0 canonical schema has exactly 18 physical tables", () => {
  const db = new DatabaseSync(":memory:"); createV090Schema(db);
  assert.equal(CORE_TABLES.length, 18);
  assert.deepEqual(listUserTables(db), [...CORE_TABLES].sort());
  assert.equal(detectSchemaGeneration(db), SCHEMA_VERSION);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(Object.values(db.prepare("PRAGMA integrity_check").get())[0], "ok");
  db.close();
});

test("core tables cover organization, mission, workflow, council, quality, delivery and ops", () => {
  const required = ["workspace","org_unit","role","agent","mission","mission_run","work_item","workflow_step","workflow_transition","review","approval","council_session","council_message","decision_record","artifact","external_effect","event_log","file_asset"];
  assert.deepEqual(CORE_TABLES, required);
});
