import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "./db";
import { PRODUCT } from "@/lib/product";

const TABLES = ["workspace","org_unit","role","agent","mission","mission_run","work_item","workflow_step","workflow_transition","review","approval","council_session","council_message","decision_record","artifact","external_effect","event_log","file_asset"] as const;

function localDbPath(): string | null {
  const url = process.env.DATABASE_URL ?? "file:../data/ai-work-automation.db";
  if (!url.startsWith("file:")) return null;
  return resolve(process.cwd(), "prisma", url.slice(5));
}

export async function ensureLocalWorkspace() {
  return prisma.workspace.upsert({
    where: { slug: process.env.COMPANY_LOCAL_ORGANIZATION_SLUG ?? "ai-company" },
    update: { schemaVersion: PRODUCT.schemaVersion, mode: "local" },
    create: {
      name: PRODUCT.name,
      slug: process.env.COMPANY_LOCAL_ORGANIZATION_SLUG ?? "ai-company",
      schemaVersion: PRODUCT.schemaVersion,
      mode: "local",
      ownerPrincipalId: process.env.COMPANY_LOCAL_PRINCIPAL_ID ?? "local:owner",
      settingsJson: JSON.stringify({ installedVersion: PRODUCT.version })
    }
  });
}

export async function databaseStatus() {
  const workspace = await ensureLocalWorkspace();
  const [missions, runs, workItems, agents, artifacts, pendingApprovals, events] = await Promise.all([
    prisma.mission.count({ where: { workspaceId: workspace.id } }),
    prisma.missionRun.count({ where: { mission: { workspaceId: workspace.id } } }),
    prisma.workItem.count({ where: { mission: { workspaceId: workspace.id } } }),
    prisma.agent.count({ where: { workspaceId: workspace.id } }),
    prisma.artifact.count({ where: { mission: { workspaceId: workspace.id } } }),
    prisma.approval.count({ where: { mission: { workspaceId: workspace.id }, status: "pending" } }),
    prisma.eventLog.count({ where: { workspaceId: workspace.id } })
  ]);
  const path = localDbPath();
  const file = path && existsSync(path) ? statSync(path) : null;
  return {
    product: PRODUCT,
    mode: "local-first",
    engine: "SQLite",
    orm: "Prisma",
    schemaVersion: workspace.schemaVersion,
    expectedSchemaVersion: PRODUCT.schemaVersion,
    tableCount: TABLES.length,
    tables: TABLES,
    databaseFile: path ? path.replace(process.cwd(), ".") : null,
    sizeBytes: file?.size ?? 0,
    modifiedAt: file?.mtime.toISOString() ?? null,
    counts: { missions, runs, workItems, agents, artifacts, pendingApprovals, events },
    healthy: workspace.schemaVersion === PRODUCT.schemaVersion && TABLES.length === 18
  };
}
