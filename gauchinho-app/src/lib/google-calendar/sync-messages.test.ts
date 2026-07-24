import { describe, expect, it } from "vitest";
import { formatGoogleSyncUserMessage, appendSyncResultToSearchParams } from "./sync-messages";

describe("formatGoogleSyncUserMessage", () => {
  it("cenário 2: consultor não conectado", () => {
    expect(formatGoogleSyncUserMessage("consultor_not_connected", "João", false)).toBe(
      "Compromisso salvo no sistema, mas João ainda não conectou a Google Agenda.",
    );
  });

  it("cenário 3: token revogado / reconectar", () => {
    expect(formatGoogleSyncUserMessage("requires_reconnect", "João", false)).toBe(
      "Compromisso salvo no sistema, mas João precisa reconectar a Google Agenda.",
    );
  });

  it("confirma sincronização bem-sucedida", () => {
    expect(formatGoogleSyncUserMessage("synced", "João", true)).toContain("sincronizado");
  });
});

describe("appendSyncResultToSearchParams", () => {
  it("inclui motivo e nome do consultor no redirect", () => {
    const qs = new URLSearchParams();
    appendSyncResultToSearchParams(qs, {
      synced: false,
      reason: "consultor_not_connected",
      consultorNome: "João",
    });
    expect(qs.get("sync_flash")).toBe("consultor_not_connected");
    expect(qs.get("sync_nome")).toBe("João");
  });
});
