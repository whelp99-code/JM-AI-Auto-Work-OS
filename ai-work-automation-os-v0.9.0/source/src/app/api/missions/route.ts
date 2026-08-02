import { NextRequest } from "next/server";
import { createMission, createMissionRun, listMissions } from "@/server/mission-service";
import { apiError, assertLocalRequest } from "@/server/local-security";
import { serializeBigInt } from "@/lib/json";

export async function GET(request: NextRequest) {
  try { assertLocalRequest(request); return Response.json(serializeBigInt(await listMissions()), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertLocalRequest(request);
    const body = await request.json();
    const mission = await createMission(body);
    const run = body.execute === false ? null : await createMissionRun(mission.id, request.headers.get("idempotency-key") ?? undefined);
    return Response.json(serializeBigInt({ mission, run }), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
