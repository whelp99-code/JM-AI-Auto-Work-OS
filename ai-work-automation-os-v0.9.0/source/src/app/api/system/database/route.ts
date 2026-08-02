import { NextRequest } from "next/server";
import { databaseStatus } from "@/server/database-service";
import { apiError, assertLocalRequest } from "@/server/local-security";

export async function GET(request: NextRequest) {
  try { assertLocalRequest(request); return Response.json(await databaseStatus(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiError(error); }
}
