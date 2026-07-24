import type { GoogleCalendarSyncReason } from "./types";

type TokenErrorJson = { error?: string; error_description?: string };

export function classifyGoogleTokenError(json: TokenErrorJson, status: number): "invalid_grant" | "transient" | "unknown" {
  const err = String(json.error ?? "").toLowerCase();
  const msg = String(json.error_description ?? json.error ?? "").toLowerCase();
  if (err === "invalid_grant" || /invalid_grant|revoked|expired/.test(msg)) {
    return "invalid_grant";
  }
  if (status >= 500 || status === 429 || err === "temporarily_unavailable") {
    return "transient";
  }
  return "unknown";
}
