#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { CORE_TABLES, SCHEMA_VERSION, detectSchemaGeneration, listUserTables } from "./db-v090-schema.mjs";
function pathFromEnv(){const raw=process.env.DATABASE_URL??"file:../data/ai-work-automation.db";if(!raw.startsWith("file:"))throw new Error("Local doctor supports file: SQLite only");return resolve(process.cwd(),"prisma",raw.slice(5));}
const path=pathFromEnv(); if(!existsSync(path)){console.error(JSON.stringify({healthy:false,error:"database_missing",path},null,2));process.exit(2);}
const db=new DatabaseSync(path,{readOnly:true}); const generation=detectSchemaGeneration(db); const tables=listUserTables(db);
const integrity=db.prepare("PRAGMA integrity_check").all().map((r)=>Object.values(r)[0]); const fk=db.prepare("PRAGMA foreign_key_check").all();
const versions=tables.includes("workspace")?db.prepare("SELECT DISTINCT schema_version AS version FROM workspace").all().map((r)=>String(r.version)):[];
const missing=CORE_TABLES.filter((t)=>!tables.includes(t)); const unexpected=tables.filter((t)=>!CORE_TABLES.includes(t));
const healthy=generation===SCHEMA_VERSION&&missing.length===0&&unexpected.length===0&&fk.length===0&&integrity.every((v)=>v==="ok")&&versions.every((v)=>v===SCHEMA_VERSION);
const counts={}; for(const table of CORE_TABLES){if(tables.includes(table)) counts[table]=Number(db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count);}
db.close(); console.log(JSON.stringify({healthy,path,sizeBytes:statSync(path).size,generation,schemaVersion:SCHEMA_VERSION,tableCount:tables.length,missing,unexpected,foreignKeyProblems:fk,integrity,versions,counts},null,2)); process.exit(healthy?0:2);
