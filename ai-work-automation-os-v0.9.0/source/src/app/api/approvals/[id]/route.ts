import { NextRequest } from "next/server";
import { resolveApproval } from "@/server/approval-service";
import { apiError, assertLocalRequest } from "@/server/local-security";
import { serializeBigInt } from "@/lib/json";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    const { id } = await context.params;
    const body = await request.json();
    if (!['approved','rejected'].includes(body.decision)) throw new Error("invalid_decision");
    return Response.json(serializeBigInt(await resolveApproval(id, body)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
