#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
function dbPath(){const raw=process.env.DATABASE_URL??"file:../data/ai-work-automation.db";if(!raw.startsWith("file:"))throw new Error("SQLite file URL required");return resolve(process.cwd(),"prisma",raw.slice(5));}
const source=dbPath(); if(!existsSync(source))throw new Error(`Database not found: ${source}`);
const dir=resolve(process.cwd(),process.env.LOCAL_BACKUP_DIR??"backups");mkdirSync(dir,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,"-");const target=join(dir,`${basename(source,".db")}.v0.9.0.${stamp}.db`);
const db=new DatabaseSync(source);db.exec("PRAGMA wal_checkpoint(FULL)");db.exec(`VACUUM INTO '${target.replaceAll("'","''")}'`);db.close();
const checksum=createHash("sha256").update(readFileSync(target)).digest("hex");const metadata={version:"0.9.0",source,target,checksum,createdAt:new Date().toISOString()};writeFileSync(`${target}.json`,JSON.stringify(metadata,null,2)+"\n");console.log(JSON.stringify(metadata,null,2));
