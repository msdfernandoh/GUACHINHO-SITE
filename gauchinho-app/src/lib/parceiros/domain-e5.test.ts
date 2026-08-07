import { describe, expect, it } from "vitest";
import { emptyBranding } from "./branding";
import { FASE3_VERCEL_DOMAINS_ENABLED } from "./constants";
import {
  apexAndWww,
  evaluatePublicationGates,
  isHostBlockedByEmpresaDominios,
  mapVercelEvidenceToLocal,
  reconcileLocalVsVercel,
  validateDominioE5Create,
  validateSubdominioEmpresa,
} from "./domain-e5";

const branding = { ...emptyBranding(), texto_hero: "Hi", cor_primaria: "#0A1628" };

describe("E5 — domain rules", () => {
  it("flag vercel domains desligada por padrão", () => {
    expect(FASE3_VERCEL_DOMAINS_ENABLED).toBe(false);
  });

  it("deny-list empresa_dominios bloqueia apex e www", () => {
    expect(
      isHostBlockedByEmpresaDominios("gauchinhoconsorcios.com.br", [
        "gauchinhoconsorcios.com.br",
      ])
    ).toBe(true);
    expect(
      isHostBlockedByEmpresaDominios("www.gauchinhoconsorcios.com.br", [
        "gauchinhoconsorcios.com.br",
      ])
    ).toBe(true);
  });

  it("apex+www como conjunto controlado", () => {
    expect(apexAndWww("Parceiro.Exemplo.com.br")).toEqual({
      apex: "parceiro.exemplo.com.br",
      www: "www.parceiro.exemplo.com.br",
    });
  });

  it("domínio próprio com www no input define principal_variant www e persiste apex", () => {
    const r = validateDominioE5Create({
      valorRaw: "www.loja-parceiro.com.br",
      tipo: "DOMINIO_PROPRIO",
      principal: true,
      existingParceiroHosts: [],
      existingEmpresaHosts: ["gauchinhoconsorcios.com.br"],
      hasPrimaryAlready: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor).toBe("loja-parceiro.com.br");
      expect(r.principalVariant).toBe("www");
      expect(r.pair?.www).toBe("www.loja-parceiro.com.br");
      expect(r.status).toBe("PENDENTE_DNS");
    }
  });

  it("domínio oficial/tenant rejeitado", () => {
    const r = validateDominioE5Create({
      valorRaw: "gauchinhoconsorcios.com.br",
      tipo: "DOMINIO_PROPRIO",
      principal: true,
      existingParceiroHosts: [],
      existingEmpresaHosts: ["gauchinhoconsorcios.com.br"],
      hasPrimaryAlready: false,
    });
    expect(r.ok).toBe(false);
  });

  it("domínio duplicado rejeitado", () => {
    const r = validateDominioE5Create({
      valorRaw: "a.com.br",
      tipo: "DOMINIO_PROPRIO",
      principal: true,
      existingParceiroHosts: ["a.com.br"],
      existingEmpresaHosts: [],
      hasPrimaryAlready: false,
    });
    expect(r.ok).toBe(false);
  });

  it("principal único", () => {
    const r = validateDominioE5Create({
      valorRaw: "b.com.br",
      tipo: "DOMINIO_PROPRIO",
      principal: true,
      existingParceiroHosts: [],
      existingEmpresaHosts: [],
      hasPrimaryAlready: true,
    });
    expect(r.ok).toBe(false);
  });

  it("subdomínio com base não autorizada bloqueado", () => {
    const r = validateSubdominioEmpresa({
      slugOrHost: "parceirox",
      baseEmpresaHostsAtivos: ["outro.com.br"],
    });
    expect(r.ok).toBe(false);
  });

  it("label reservado bloqueado", () => {
    const r = validateSubdominioEmpresa({
      slugOrHost: "admin",
      baseEmpresaHostsAtivos: ["gauchinhoconsorcios.com.br"],
    });
    expect(r.ok).toBe(false);
  });

  it("subdomínio válido na base do tenant", () => {
    const r = validateSubdominioEmpresa({
      slugOrHost: "imobiliaria-alfa",
      baseEmpresaHostsAtivos: ["gauchinhoconsorcios.com.br"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toBe("imobiliaria-alfa.gauchinhoconsorcios.com.br");
  });

  it("publicação bloqueada sem DNS/SSL no canal DOMINIO", () => {
    const r = evaluatePublicationGates({
      organizacaoStatus: "ATIVA",
      siteAtivo: true,
      nomeSite: "S",
      branding,
      menus: [{ codigo: "INICIO", habilitado: true }],
      canalPrincipal: "DOMINIO",
      dominioPrincipal: {
        valor: "x.com.br",
        verificado: false,
        status: "PENDENTE_DNS",
        ssl_status: "PENDING",
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons.some((x) => /verificado/i.test(x))).toBe(true);
      expect(r.reasons.some((x) => /SSL/i.test(x))).toBe(true);
    }
  });

  it("publicação bloqueada sem SSL READY", () => {
    const r = evaluatePublicationGates({
      organizacaoStatus: "ATIVA",
      siteAtivo: true,
      nomeSite: "S",
      branding,
      menus: [{ codigo: "INICIO" }],
      canalPrincipal: "SUBDOMINIO",
      dominioPrincipal: {
        valor: "p.gauchinhoconsorcios.com.br",
        verificado: true,
        status: "ATIVO",
        ssl_status: "PENDING",
      },
    });
    expect(r.ok).toBe(false);
  });

  it("publicação liberada apenas com todos os gates", () => {
    const r = evaluatePublicationGates({
      organizacaoStatus: "ATIVA",
      siteAtivo: true,
      nomeSite: "S",
      branding,
      menus: [{ codigo: "INICIO" }],
      canalPrincipal: "DOMINIO",
      dominioPrincipal: {
        valor: "x.com.br",
        verificado: true,
        status: "ATIVO",
        ssl_status: "READY",
      },
    });
    expect(r.ok).toBe(true);
  });

  it("canal ROTA não exige domínio para gates", () => {
    const r = evaluatePublicationGates({
      organizacaoStatus: "ATIVA",
      siteAtivo: true,
      nomeSite: "S",
      branding,
      menus: [{ codigo: "INICIO" }],
      canalPrincipal: "ROTA",
      dominioPrincipal: null,
    });
    expect(r.ok).toBe(true);
  });

  it("nunca marca ATIVO sem verified", () => {
    expect(
      mapVercelEvidenceToLocal({ verified: false, configured: true }).status
    ).not.toBe("ATIVO");
    expect(
      mapVercelEvidenceToLocal({ verified: true, sslReady: true }).status
    ).toBe("ATIVO");
  });

  it("reconciliação detecta ausente na Vercel", () => {
    const r = reconcileLocalVsVercel({
      localValor: "x.com.br",
      tipo: "DOMINIO_PROPRIO",
      vercelApexPresent: false,
      vercelWwwPresent: false,
      localVerificado: false,
    });
    expect(r.divergencias.length).toBeGreaterThan(0);
    expect(r.vercel_apex).toBe("ausente");
  });
});
