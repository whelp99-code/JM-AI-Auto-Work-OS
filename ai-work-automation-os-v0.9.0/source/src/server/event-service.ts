import type { Prisma, PrismaClient } from "@prisma/client";
import { newId, stableHash } from "@/lib/ids";
import { stringifyJson } from "@/lib/json";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export type EventInput = {
  workspaceId: string;
  missionId?: string | null;
  missionRunId?: string | null;
  workItemId?: string | null;
  sourceType: string;
  sourceId: string;
  eventType: string;
  actorType?: string;
  actorId?: string | null;
  severity?: string;
  message: string;
  data?: unknown;
};

export async function appendEvent(db: DbClient, input: EventInput) {
  const current = await db.eventLog.aggregate({
    where: { sourceType: input.sourceType, sourceId: input.sourceId },
    _max: { sequence: true }
  });
  const sequence = (current._max.sequence ?? 0) + 1;
  return db.eventLog.create({ data: {
    id: newId("evt"),
    workspaceId: input.workspaceId,
    missionId: input.missionId ?? null,
    missionRunId: input.missionRunId ?? null,
    workItemId: input.workItemId ?? null,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sequence,
    eventType: input.eventType,
    actorType: input.actorType ?? "system",
    actorId: input.actorId ?? null,
    severity: input.severity ?? "info",
    message: input.message,
    dataJson: stringifyJson(input.data ?? {})
  }});
}

export function approvalScopeHash(value: unknown): string {
  return stableHash({ schema: "approval-scope.v0.9.0", value });
}
