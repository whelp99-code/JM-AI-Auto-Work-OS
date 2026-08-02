import { NextRequest } from "next/server";
import { createMissionRun } from "@/server/mission-service";
import { apiError, assertLocalRequest } from "@/server/local-security";
import { serializeBigInt } from "@/lib/json";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    const { id } = await context.params;
    const result = await createMissionRun(id, request.headers.get("idempotency-key") ?? undefined);
    return Response.json(serializeBigInt(result), { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
