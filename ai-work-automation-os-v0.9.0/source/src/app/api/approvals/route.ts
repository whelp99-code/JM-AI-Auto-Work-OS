import { NextRequest } from "next/server";
import { listApprovals } from "@/server/approval-service";
import { apiError, assertLocalRequest } from "@/server/local-security";
import { serializeBigInt } from "@/lib/json";

export async function GET(request: NextRequest) {
  try {
    assertLocalRequest(request);
    const status = new URL(request.url).searchParams.get("status") ?? undefined;
    return Response.json(serializeBigInt({ approvals: await listApprovals(status) }), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return apiError(error);
  }
}
