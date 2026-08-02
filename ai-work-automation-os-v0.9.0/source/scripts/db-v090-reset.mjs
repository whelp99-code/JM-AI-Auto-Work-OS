#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createV090Schema, SCHEMA_VERSION } from "./db-v090-schema.mjs";
const args=new Set(process.argv.slice(2));if(!args.has("--yes"))throw new Error("Refusing reset without --yes");
const raw=process.env.DATABASE_URL??"file:../data/ai-work-automation.db";if(!raw.startsWith("file:"))throw new Error("SQLite file URL required");const path=resolve(process.cwd(),"prisma",raw.slice(5));mkdirSync(dirname(path),{recursive:true});
let backup=null;if(existsSync(path)){const dir=resolve(process.cwd(),"backups");mkdirSync(dir,{recursive:true});backup=join(dir,`${basename(path)}.before-reset.${new Date().toISOString().replace(/[:.]/g,"-")}`);copyFileSync(path,backup);}
for(const suffix of ["","-wal","-shm"]){rmSync(path+suffix,{force:true});}
const db=new DatabaseSync(path);createV090Schema(db);const now=new Date().toISOString();db.prepare("INSERT INTO workspace(id,name,slug,schema_version,mode,owner_principal_id,settings_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run("local_workspace","AI Work Automation OS","ai-company",SCHEMA_VERSION,"local","local:owner",JSON.stringify({resetAt:now}),now,now);db.close();console.log(JSON.stringify({reset:true,path,backup,schemaVersion:SCHEMA_VERSION},null,2));
