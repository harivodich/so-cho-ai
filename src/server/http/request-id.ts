import { randomUUID } from "node:crypto";

export function extractOrGenerateRequestId(request: Request): string {
  const headerId = request.headers.get("x-request-id") || request.headers.get("request-id");
  if (headerId && typeof headerId === "string" && headerId.trim().length > 0) {
    // Sanitize to alphanumeric + dashes/underscores
    return headerId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || randomUUID();
  }
  return randomUUID();
}
