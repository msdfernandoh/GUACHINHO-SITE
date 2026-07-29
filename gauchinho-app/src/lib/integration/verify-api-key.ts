import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

function safeEquals(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

export function verifyIntegrationApiKey(request: Request): NextResponse | null {
  const expected = process.env.GAUCHINHO_INTEGRATION_API_KEY?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "Integração não configurada (GAUCHINHO_INTEGRATION_API_KEY)" },
      { status: 503 },
    );
  }
  const header = request.headers.get("x-api-key")?.trim();
  const auth = request.headers.get("authorization")?.trim();
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const provided = header || bearer;
  if (!provided || !safeEquals(provided, expected)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return null;
}
