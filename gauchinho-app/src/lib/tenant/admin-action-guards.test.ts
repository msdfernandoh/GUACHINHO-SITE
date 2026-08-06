import { describe, expect, it } from "vitest";
import {
  validateBrandingPublishInput,
  validateDominioCreateInput,
  validateEmpresaStatusInput,
} from "./admin-action-guards";

describe("validateEmpresaStatusInput", () => {
  it("aceita status válidos e deriva ativo", () => {
    expect(validateEmpresaStatusInput("ativo")).toEqual({ ok: true, status: "ativo", ativo: true });
    expect(validateEmpresaStatusInput("em_treinamento")).toEqual({
      ok: true,
      status: "em_treinamento",
      ativo: false,
    });
  });

  it("rejeita status inválido", () => {
    expect(validateEmpresaStatusInput("hack").ok).toBe(false);
  });
});

describe("validateBrandingPublishInput", () => {
  it("exige nome e bloqueia publicação de empresa inativa", () => {
    expect(
      validateBrandingPublishInput({
        nomeSite: "",
        statusPublicacao: "RASCUNHO",
      }).ok,
    ).toBe(false);
    expect(
      validateBrandingPublishInput({
        nomeSite: "Empresa B",
        statusPublicacao: "PUBLICADO",
        empresaStatus: "em_treinamento",
        empresaAtivo: false,
      }).ok,
    ).toBe(false);
    expect(
      validateBrandingPublishInput({
        nomeSite: "Gauchinho",
        statusPublicacao: "PUBLICADO",
        empresaStatus: "ativo",
        empresaAtivo: true,
      }).ok,
    ).toBe(true);
  });
});

describe("validateDominioCreateInput", () => {
  it("normaliza e bloqueia localhost/IP/wildcard", () => {
    const ok = validateDominioCreateInput({
      tipo: "DOMINIO_CUSTOMIZADO",
      valorRaw: "HTTPS://WWW.Exemplo.com.br/path",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.valor).toBe("exemplo.com.br");

    expect(validateDominioCreateInput({ tipo: "DOMINIO_CUSTOMIZADO", valorRaw: "localhost" }).ok).toBe(
      false,
    );
    expect(validateDominioCreateInput({ tipo: "DOMINIO_CUSTOMIZADO", valorRaw: "127.0.0.1" }).ok).toBe(
      false,
    );
    expect(validateDominioCreateInput({ tipo: "DOMINIO_CUSTOMIZADO", valorRaw: "*.x.com" }).ok).toBe(
      false,
    );
  });
});
