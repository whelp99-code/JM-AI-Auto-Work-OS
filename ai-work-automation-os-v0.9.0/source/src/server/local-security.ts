import { NextRequest } from "next/server";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function normalizedHost(value: string | null): string {
  if (!value) return "";
  const host = value.trim().toLowerCase();
  if (host.startsWith("[")) return host.split("]")[0] + "]";
  return host.split(":")[0];
}

export function assertLocalRequest(request: NextRequest): void {
  if (process.env.APP_DEPLOYMENT_MODE !== "local") return;
  const host = normalizedHost(request.headers.get("host"));
  const forwarded = normalizedHost(request.headers.get("x-forwarded-host"));
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const isLoopbackIp = (value?: string | null) => !value || value === "::1" || value.startsWith("127.");
  if (!LOOPBACK_HOSTS.has(host)) throw new Error("local_loopback_required");
  if (forwarded && !LOOPBACK_HOSTS.has(forwarded)) throw new Error("local_loopback_required");
  if (!isLoopbackIp(realIp) || !isLoopbackIp(forwardedFor)) throw new Error("local_loopback_required");
}

export function apiError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "unknown_error";
  const status = message === "not_found" ? 404
    : message === "local_loopback_required" ? 403
    : message.includes("expired") ? 410
    : message.includes("conflict") || message.includes("reused") || message === "approval_scope_mismatch" ? 409
    : message.includes("required") || message.includes("invalid") || message.includes("mismatch") ? 400
    : 500;
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
