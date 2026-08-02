import { NextRequest } from "next/server";
import { retryMissionRun } from "@/server/mission-service";
import { apiError, assertLocalRequest } from "@/server/local-security";
import { serializeBigInt } from "@/lib/json";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { assertLocalRequest(request); const { id } = await context.params; return Response.json(serializeBigInt(await retryMissionRun(id)), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiError(error); }
}
