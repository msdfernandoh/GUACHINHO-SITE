import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertPropostaPdfPublicAccess,
  buildPropostaPdfPublicPath,
  createPropostaPdfPublicToken,
  isPropostaPdfParceiroScoped,
  verifyPropostaPdfPublicToken,
} from "./pdf-public-access";

describe("pdf public access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("marca escopo parceiro por org ou participant", () => {
    expect(isPropostaPdfParceiroScoped({ organizacao_parceira_id: "o1" })).toBe(true);
    expect(isPropostaPdfParceiroScoped({ participant_id: "p1" })).toBe(true);
    expect(
      isPropostaPdfParceiroScoped({
        empresa_id: null,
        organizacao_parceira_id: null,
        participant_id: null,
      })
    ).toBe(false);
  });

  it("exige token HMAC e bloqueia escopo parceiro mesmo com token", () => {
    vi.stubEnv("PROPOSTA_PDF_PUBLIC_SECRET", "teste-secreto-e9-pdf");
    const id = "11111111-1111-1111-1111-111111111111";
    const token = createPropostaPdfPublicToken(id);
    expect(verifyPropostaPdfPublicToken(id, token)).toBe(true);
    expect(verifyPropostaPdfPublicToken(id, "0".repeat(32))).toBe(false);
    expect(verifyPropostaPdfPublicToken(id, null)).toBe(false);

    expect(
      assertPropostaPdfPublicAccess({
        propostaId: id,
        token,
        row: { organizacao_parceira_id: null, participant_id: null },
      }).ok
    ).toBe(true);

    expect(
      assertPropostaPdfPublicAccess({
        propostaId: id,
        token: null,
        row: { organizacao_parceira_id: null, participant_id: null },
      }).ok
    ).toBe(false);

    const denied = assertPropostaPdfPublicAccess({
      propostaId: id,
      token,
      row: { organizacao_parceira_id: "org-a", participant_id: "p1" },
    });
    expect(denied.ok).toBe(false);

    const path = buildPropostaPdfPublicPath(id);
    expect(path).toContain(`/api/propostas/${id}/pdf?t=`);
    expect(path).toContain(token);
  });
});
