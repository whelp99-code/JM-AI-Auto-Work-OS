import { NextRequest } from "next/server";
import { missionWorkspace } from "@/server/workspace-service";
import { apiError, assertLocalRequest } from "@/server/local-security";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { assertLocalRequest(request); const { id } = await context.params; return Response.json(await missionWorkspace(id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiError(error); }
}
