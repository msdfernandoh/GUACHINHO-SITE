import { describe, expect, it } from "vitest";
import {
  canAccessContratacaoDocumentos,
  MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO,
} from "@/lib/auth/permissions";

describe("canAccessContratacaoDocumentos", () => {
  it("permite master, srd e visualizador", () => {
    expect(canAccessContratacaoDocumentos("master")).toBe(true);
    expect(canAccessContratacaoDocumentos("srd")).toBe(true);
    expect(canAccessContratacaoDocumentos("visualizador")).toBe(true);
  });

  it("nega imobiliária e perfil ausente", () => {
    expect(canAccessContratacaoDocumentos("imobiliaria")).toBe(false);
    expect(canAccessContratacaoDocumentos(null)).toBe(false);
  });

  it("expõe mensagem padrão de negação", () => {
    expect(MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO).toContain("permissão");
  });
});
