import { describe, expect, it } from "vitest";
import { emptyBranding } from "./branding";
import { validateMenusForTemplate } from "./menus";
import {
  FASE3_PARCEIRO_AREA_ENABLED,
  FASE3_PARCEIRO_PUBLIC_SITE_ENABLED,
  FASE3_PARCEIRO_SITES_ADMIN_ENABLED,
  FASE3_PERMISSOES,
} from "./constants";
import { papelTemPermissao } from "./rules";
import {
  papelBloqueadoParaEditorSite,
  validateDominioLocalCreate,
  validateOrgElegivelParaSite,
  validateSiteCreateInput,
  VERCEL_INTEGRATION_ENABLED_IN_E4,
} from "./site-rules";

const baseBranding = { ...emptyBranding(), texto_hero: "Olá", cor_primaria: "#0A1628" };

describe("E4 — sites de parceiros", () => {
  it("flags public/area/sites admin desligadas por padrão", () => {
    expect(FASE3_PARCEIRO_SITES_ADMIN_ENABLED).toBe(false);
    expect(FASE3_PARCEIRO_PUBLIC_SITE_ENABLED).toBe(false);
    expect(FASE3_PARCEIRO_AREA_ENABLED).toBe(false);
  });

  it("admin cria site para org ativa", () => {
    const r = validateSiteCreateInput({
      empresaId: "e1",
      organizacaoId: "o1",
      organizacaoEmpresaId: "e1",
      organizacaoStatus: "ATIVA",
      nomeSite: "Site A",
      slug: "site-a",
      templateCodigo: "institucional_v1",
      canalPrincipal: "ROTA",
      statusPublicacao: "RASCUNHO",
      branding: baseBranding,
      menus: [{ codigo: "INICIO" }, { codigo: "CONTATO" }],
      existingActiveSites: [],
      existingSlugs: [],
    });
    expect(r.ok).toBe(true);
  });

  it("org suspensa não cria site", () => {
    const r = validateOrgElegivelParaSite({
      organizacaoEmpresaId: "e1",
      tenantEmpresaId: "e1",
      organizacaoStatus: "SUSPENSA",
    });
    expect(r.ok).toBe(false);
  });

  it("org de outro tenant rejeitada", () => {
    const r = validateSiteCreateInput({
      empresaId: "e1",
      organizacaoId: "o2",
      organizacaoEmpresaId: "e2",
      organizacaoStatus: "ATIVA",
      nomeSite: "X",
      slug: "x",
      templateCodigo: "institucional_v1",
      canalPrincipal: "ROTA",
      statusPublicacao: "RASCUNHO",
      branding: baseBranding,
      menus: [{ codigo: "INICIO" }],
      existingActiveSites: [],
      existingSlugs: [],
    });
    expect(r.ok).toBe(false);
  });

  it("segundo site ativo rejeitado", () => {
    const r = validateSiteCreateInput({
      empresaId: "e1",
      organizacaoId: "o1",
      organizacaoEmpresaId: "e1",
      organizacaoStatus: "ATIVA",
      nomeSite: "Site 2",
      slug: "site-2",
      templateCodigo: "institucional_v1",
      canalPrincipal: "ROTA",
      statusPublicacao: "RASCUNHO",
      branding: baseBranding,
      menus: [{ codigo: "INICIO" }],
      existingActiveSites: [{ id: "s1", organizacaoId: "o1" }],
      existingSlugs: [],
    });
    expect(r.ok).toBe(false);
  });

  it("slug duplicado no tenant rejeitado; mesmo slug em outro tenant ok", () => {
    const dup = validateSiteCreateInput({
      empresaId: "e1",
      organizacaoId: "o1",
      organizacaoEmpresaId: "e1",
      organizacaoStatus: "ATIVA",
      nomeSite: "A",
      slug: "igual",
      templateCodigo: "institucional_v1",
      canalPrincipal: "ROTA",
      statusPublicacao: "RASCUNHO",
      branding: baseBranding,
      menus: [{ codigo: "INICIO" }],
      existingActiveSites: [],
      existingSlugs: [{ id: "s9", empresaId: "e1", slug: "igual" }],
    });
    expect(dup.ok).toBe(false);

    const other = validateSiteCreateInput({
      empresaId: "e2",
      organizacaoId: "o2",
      organizacaoEmpresaId: "e2",
      organizacaoStatus: "ATIVA",
      nomeSite: "B",
      slug: "igual",
      templateCodigo: "institucional_v1",
      canalPrincipal: "ROTA",
      statusPublicacao: "RASCUNHO",
      branding: baseBranding,
      menus: [{ codigo: "INICIO" }],
      existingActiveSites: [],
      existingSlugs: [{ id: "s9", empresaId: "e1", slug: "igual" }],
    });
    expect(other.ok).toBe(true);
  });

  it("parceiro_comercial e imobiliaria não abrem editor", () => {
    expect(papelBloqueadoParaEditorSite("parceiro_comercial")).toBe(true);
    expect(papelBloqueadoParaEditorSite("parceiro_imobiliaria")).toBe(true);
    expect(papelTemPermissao("parceiro_comercial", FASE3_PERMISSOES.gerenciarSites)).toBe(false);
    expect(papelBloqueadoParaEditorSite("admin_empresa")).toBe(false);
  });

  it("gerenciar_sites_parceiros concedido a admin/super", () => {
    expect(papelTemPermissao("admin_empresa", FASE3_PERMISSOES.gerenciarSites)).toBe(true);
    expect(papelTemPermissao("super_admin", FASE3_PERMISSOES.gerenciarSites)).toBe(true);
  });

  it("menus fora da allowlist rejeitados", () => {
    const r = validateMenusForTemplate("institucional_v1", [
      { codigo: "INICIO" },
      { codigo: "/admin/usuarios" as never },
    ]);
    expect(r.ok).toBe(false);
  });

  it("domínio oficial e duplicado rejeitados; local nasce PENDENTE_DNS", () => {
    expect(
      validateDominioLocalCreate({
        valorRaw: "gauchinhoconsorcios.com.br",
        tipo: "DOMINIO_PROPRIO",
        principal: true,
        existingParceiroHosts: [],
        existingEmpresaHosts: ["gauchinhoconsorcios.com.br"],
        hasPrimaryAlready: false,
      }).ok
    ).toBe(false);

    expect(
      validateDominioLocalCreate({
        valorRaw: "x.com.br",
        tipo: "DOMINIO_PROPRIO",
        principal: true,
        existingParceiroHosts: ["x.com.br"],
        existingEmpresaHosts: [],
        hasPrimaryAlready: false,
      }).ok
    ).toBe(false);

    const ok = validateDominioLocalCreate({
      valorRaw: "https://WWW.ParceiroNovo.com.br/path",
      tipo: "DOMINIO_PROPRIO",
      principal: true,
      existingParceiroHosts: [],
      existingEmpresaHosts: [],
      hasPrimaryAlready: false,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.valor).toBe("parceironovo.com.br");
      expect(ok.status).toBe("PENDENTE_DNS");
      expect(ok.sslStatus).toBe("PENDING");
    }
  });

  it("nenhuma integração Vercel na E4", () => {
    expect(VERCEL_INTEGRATION_ENABLED_IN_E4).toBe(false);
  });

  it("Empresa B conceitualmente sem sites: org inativa/em treinamento bloqueada via status", () => {
    // Empresa B não tem orgs; se tivesse SUSPENSA/RASCUNHO, criação falha
    expect(
      validateOrgElegivelParaSite({
        organizacaoEmpresaId: "emp-b",
        tenantEmpresaId: "emp-b",
        organizacaoStatus: "RASCUNHO",
      }).ok
    ).toBe(false);
  });
});
