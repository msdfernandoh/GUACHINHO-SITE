import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPartnerPublicViewModel,
  resolvePublicMenus,
  resolveWhatsappCta,
  sanitizePublicText,
} from "./public-site-data";
import {
  computeCanonicalRedirect,
  evaluatePublicServeGate,
  robotsForPartnerStatus,
} from "./public-site-gates";
import {
  resolvePartnerSiteFromFacts,
  type PartnerResolveFacts,
} from "./resolve-partner-site";
import type { PartnerSiteResolution } from "./partner-site-types";

const GAUCHINHO = { id: "emp-g", slug: "gauchinho" };

function facts(over?: Partial<PartnerResolveFacts>): PartnerResolveFacts {
  const base: PartnerResolveFacts = {
    empresas: [GAUCHINHO],
    tenantHosts: [
      {
        host: "gauchinhoconsorcios.com.br",
        empresa_id: GAUCHINHO.id,
        empresa_slug: GAUCHINHO.slug,
      },
    ],
    sites: [
      {
        id: "s1",
        empresa_id: GAUCHINHO.id,
        organizacao_parceira_id: "o1",
        slug: "alfa",
        status_publicacao: "PUBLICADO",
        ativo: true,
        canal_principal: "ROTA",
        org_empresa_id: GAUCHINHO.id,
        org_status: "ATIVA",
      },
      {
        id: "s-draft",
        empresa_id: GAUCHINHO.id,
        organizacao_parceira_id: "o1",
        slug: "rascunho",
        status_publicacao: "RASCUNHO",
        ativo: true,
        canal_principal: "ROTA",
        org_empresa_id: GAUCHINHO.id,
        org_status: "ATIVA",
      },
      {
        id: "s-wait",
        empresa_id: GAUCHINHO.id,
        organizacao_parceira_id: "o1",
        slug: "aguardando",
        status_publicacao: "AGUARDANDO_APROVACAO",
        ativo: true,
        canal_principal: "ROTA",
        org_empresa_id: GAUCHINHO.id,
        org_status: "ATIVA",
      },
      {
        id: "s-susp",
        empresa_id: GAUCHINHO.id,
        organizacao_parceira_id: "o1",
        slug: "suspenso",
        status_publicacao: "SUSPENSO",
        ativo: true,
        canal_principal: "ROTA",
        org_empresa_id: GAUCHINHO.id,
        org_status: "ATIVA",
      },
      {
        id: "s-arch",
        empresa_id: GAUCHINHO.id,
        organizacao_parceira_id: "o1",
        slug: "arquivo",
        status_publicacao: "ARQUIVADO",
        ativo: false,
        canal_principal: "ROTA",
        org_empresa_id: GAUCHINHO.id,
        org_status: "ATIVA",
      },
      {
        id: "s-off",
        empresa_id: GAUCHINHO.id,
        organizacao_parceira_id: "o1",
        slug: "inativo",
        status_publicacao: "PUBLICADO",
        ativo: false,
        canal_principal: "ROTA",
        org_empresa_id: GAUCHINHO.id,
        org_status: "ATIVA",
      },
      {
        id: "s-org-off",
        empresa_id: GAUCHINHO.id,
        organizacao_parceira_id: "o-off",
        slug: "orgoff",
        status_publicacao: "PUBLICADO",
        ativo: true,
        canal_principal: "ROTA",
        org_empresa_id: GAUCHINHO.id,
        org_status: "SUSPENSA",
      },
    ],
    domains: [
      {
        id: "d1",
        empresa_id: GAUCHINHO.id,
        parceiro_site_id: "s1",
        valor: "parceiro-alfa.com.br",
        tipo: "DOMINIO_PROPRIO",
        principal: true,
        status: "ATIVO",
        verificado: true,
        ssl_status: "READY",
        canonical_redirect: true,
        principal_variant: "apex",
      },
      {
        id: "d-sub",
        empresa_id: GAUCHINHO.id,
        parceiro_site_id: "s1",
        valor: "alfa.gauchinhoconsorcios.com.br",
        tipo: "SUBDOMINIO_EMPRESA",
        principal: false,
        status: "ATIVO",
        verificado: true,
        ssl_status: "READY",
        canonical_redirect: true,
      },
      {
        id: "d-pending",
        empresa_id: GAUCHINHO.id,
        parceiro_site_id: "s1",
        valor: "pendente-alfa.com.br",
        tipo: "ALIAS",
        principal: false,
        status: "PENDENTE_DNS",
        verificado: false,
        ssl_status: "PENDING",
        canonical_redirect: true,
      },
      {
        id: "d-nossl",
        empresa_id: GAUCHINHO.id,
        parceiro_site_id: "s1",
        valor: "nossl-alfa.com.br",
        tipo: "ALIAS",
        principal: false,
        status: "ATIVO",
        verificado: true,
        ssl_status: "PENDING",
        canonical_redirect: true,
      },
    ],
  };
  return { ...base, ...over };
}

function asPartner(r: ReturnType<typeof resolvePartnerSiteFromFacts>): PartnerSiteResolution {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.partner;
}

describe("E8 — site público parceiros", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("flag pública false → não serve site", async () => {
    const { FASE3_PARCEIRO_PUBLIC_SITE_ENABLED } = await import("./constants");
    expect(FASE3_PARCEIRO_PUBLIC_SITE_ENABLED).toBe(false);

    const r = resolvePartnerSiteFromFacts({
      hostHeader: "gauchinhoconsorcios.com.br",
      pathname: "/parceiro/alfa",
      facts: facts(),
      mode: "public",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("public_flag_off");

    const gate = evaluatePublicServeGate({ resolution: r });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toBe("flag_off");
  });

  it("com flag true: PUBLICADO por rota elegível; outros status não", async () => {
    vi.resetModules();
    vi.stubEnv("FASE3_PARCEIRO_PUBLIC_SITE_ENABLED", "true");
    const resolve = (await import("./resolve-partner-site")).resolvePartnerSiteFromFacts;
    const gates = await import("./public-site-gates");

    const pub = resolve({
      hostHeader: "gauchinhoconsorcios.com.br",
      pathname: "/parceiro/alfa",
      facts: facts(),
      mode: "public",
    });
    expect(pub.ok).toBe(true);
    if (pub.ok) {
      expect(pub.partner.public_eligible).toBe(true);
      expect(gates.evaluatePublicServeGate({ resolution: pub, orgStatus: "ATIVA" }).ok).toBe(
        true
      );
    }

    for (const slug of ["rascunho", "aguardando", "suspenso", "arquivo", "inativo"]) {
      const r = resolve({
        hostHeader: "gauchinhoconsorcios.com.br",
        pathname: `/parceiro/${slug}`,
        facts: facts(),
        mode: "public",
      });
      expect(r.ok).toBe(false);
    }

    const orgOff = resolve({
      hostHeader: "gauchinhoconsorcios.com.br",
      pathname: "/parceiro/orgoff",
      facts: facts(),
      mode: "public",
    });
    // resolve pode ok com public_eligible false se org SUSPENSA — gate bloqueia
    if (orgOff.ok) {
      const g = gates.evaluatePublicServeGate({
        resolution: orgOff,
        orgStatus: "SUSPENSA",
      });
      expect(g.ok).toBe(false);
    }
  });

  it("domínio não verificado / sem SSL não serve; ATIVO+READY serve", async () => {
    vi.resetModules();
    vi.stubEnv("FASE3_PARCEIRO_PUBLIC_SITE_ENABLED", "true");
    const { resolvePartnerSiteFromFacts: resolve } = await import("./resolve-partner-site");
    const { evaluatePublicServeGate: gate } = await import("./public-site-gates");

    const pending = resolve({
      hostHeader: "pendente-alfa.com.br",
      pathname: "/",
      facts: facts(),
      mode: "public",
    });
    expect(pending.ok).toBe(true);
    if (pending.ok) {
      expect(pending.partner.public_eligible).toBe(false);
      expect(gate({ resolution: pending, orgStatus: "ATIVA" }).ok).toBe(false);
    }

    const nossl = resolve({
      hostHeader: "nossl-alfa.com.br",
      pathname: "/",
      facts: facts(),
      mode: "public",
    });
    expect(nossl.ok).toBe(true);
    if (nossl.ok) expect(nossl.partner.public_eligible).toBe(false);

    const ok = resolve({
      hostHeader: "parceiro-alfa.com.br",
      pathname: "/",
      facts: facts(),
      mode: "public",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.partner.public_eligible).toBe(true);
      expect(gate({ resolution: ok, orgStatus: "ATIVA" }).ok).toBe(true);
    }

    const www = resolve({
      hostHeader: "www.parceiro-alfa.com.br",
      pathname: "/",
      facts: facts(),
      mode: "public",
    });
    expect(www.ok).toBe(true);

    const sub = resolve({
      hostHeader: "alfa.gauchinhoconsorcios.com.br",
      pathname: "/",
      facts: facts(),
      mode: "public",
    });
    expect(sub.ok).toBe(true);
    if (sub.ok) expect(sub.partner.source).toBe("parceiro_subdomain");
  });

  it("canonical redirect www → apex e rota → domínio", async () => {
    vi.resetModules();
    vi.stubEnv("FASE3_PARCEIRO_PUBLIC_SITE_ENABLED", "true");
    const { resolvePartnerSiteFromFacts: resolve } = await import("./resolve-partner-site");
    const { computeCanonicalRedirect: canon } = await import("./public-site-gates");

    const www = resolve({
      hostHeader: "www.parceiro-alfa.com.br",
      pathname: "/",
      facts: facts(),
      mode: "public",
    });
    const p = asPartner(www);
    // force canonical host apex
    const partner = { ...p, canonical_host: "parceiro-alfa.com.br", public_eligible: true };
    const r1 = canon({
      requestedHost: "www.parceiro-alfa.com.br",
      requestedPath: "/",
      partner,
    });
    expect(r1.redirect).toBe(true);
    if (r1.redirect) {
      expect(r1.status).toBe(308);
      expect(r1.location).toBe("https://parceiro-alfa.com.br/");
    }

    const path = resolve({
      hostHeader: "gauchinhoconsorcios.com.br",
      pathname: "/parceiro/alfa",
      facts: facts(),
      mode: "public",
    });
    const pp = asPartner(path);
    const r2 = canon({
      requestedHost: "gauchinhoconsorcios.com.br",
      requestedPath: "/parceiro/alfa",
      partner: {
        ...pp,
        canonical_host: "parceiro-alfa.com.br",
        public_eligible: true,
        dominio_status: "ATIVO",
        dominio_verificado: true,
        dominio_ssl_status: "READY",
        dominio_id: "d1",
        canonical_redirect: true,
      },
    });
    expect(r2.redirect).toBe(true);
  });

  it("SEO robots: PUBLICADO indexável; preview/rascunho noindex", async () => {
    vi.resetModules();
    vi.stubEnv("FASE3_PARCEIRO_PUBLIC_SITE_ENABLED", "true");
    const { robotsForPartnerStatus: robots } = await import("./public-site-gates");
    expect(robots("PUBLICADO", false).index).toBe(true);
    expect(robots("RASCUNHO", false).index).toBe(false);
    expect(robots("PUBLICADO", true).index).toBe(false);
  });

  it("menus allowlist: só seções implementadas; HTML sanitizado", () => {
    const menus = resolvePublicMenus({
      templateCodigo: "institucional_v1",
      menus: [
        { codigo: "INICIO" },
        { codigo: "SIMULADOR" },
        { codigo: "CONTATO" },
        { codigo: "/admin" as never },
      ],
    });
    expect(menus.map((m) => m.codigo)).toEqual(["INICIO", "CONTATO"]);
    expect(sanitizePublicText("<script>x</script>Olá")).toBe("xOlá");
  });

  it("CTA WhatsApp respeita modo e hierarquia", () => {
    const proprio = resolveWhatsappCta({
      modo: "PROPRIO",
      siteWhatsapp: "65999999999",
      siteBrandingWhatsapp: null,
      orgWhatsapp: "65888888888",
      empresaWhatsapp: "65777777777",
    });
    expect(proprio.digits).toBe("65999999999");
    expect(proprio.link).toContain("wa.me/65999999999");

    const empresa = resolveWhatsappCta({
      modo: "EMPRESA",
      siteWhatsapp: "65999999999",
      siteBrandingWhatsapp: null,
      orgWhatsapp: "65888888888",
      empresaWhatsapp: "65777777777",
    });
    expect(empresa.digits).toBe("65777777777");
  });

  it("view model: fallback site → org → empresa", () => {
    const vm = buildPartnerPublicViewModel({
      site: {
        id: "s1",
        empresa_id: GAUCHINHO.id,
        organizacao_parceira_id: "o1",
        slug: "alfa",
        nome_site: "Site Alfa",
        descricao: "Desc",
        template_codigo: "institucional_v1",
        status_publicacao: "PUBLICADO",
        canal_principal: "ROTA",
        whatsapp_modo: "EMPRESA",
        whatsapp: null,
        branding: { cor_primaria: "#112233" },
        menus: [{ codigo: "INICIO" }, { codigo: "CONTATO" }],
        seo: { titulo: "SEO Alfa" },
      },
      org: {
        id: "o1",
        nome_fantasia: "Org Alfa",
        logo_url: "https://cdn.example/org.png",
        telefone: "6533333333",
        whatsapp: "6533333333",
        email: "org@example.com",
        instagram: "@org",
      },
      empresa: {
        id: GAUCHINHO.id,
        slug: "gauchinho",
        nome: "Gauchinho Consórcios",
        logo_url: "https://cdn.example/emp.png",
        telefone: "6511111111",
        whatsapp: "6511111111",
        email: "empresa@example.com",
      },
    });
    expect(vm.logo_url).toBe("https://cdn.example/org.png");
    expect(vm.contato.telefone).toBe("6533333333");
    expect(vm.seo_titulo).toBe("SEO Alfa");
    expect(vm.tenant_identificacao).toMatch(/Gauchinho/);
    expect(vm.whatsapp_cta).toBe("6511111111");
  });

  it("cross-tenant e query maliciosa não alteram resolução", async () => {
    vi.resetModules();
    vi.stubEnv("FASE3_PARCEIRO_PUBLIC_SITE_ENABLED", "true");
    const { resolvePartnerSiteFromFacts: resolve } = await import("./resolve-partner-site");
    const r = resolve({
      hostHeader: "gauchinhoconsorcios.com.br",
      pathname: "/parceiro/alfa",
      searchParams: new URLSearchParams({
        empresa_id: "outra",
        parceiro_site_id: "hack",
        tenant: "empresa-b",
      }),
      facts: facts(),
      mode: "public",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.partner.empresa_id).toBe(GAUCHINHO.id);
  });

  it("Vercel flag permanece false — sem integração nesta rodada", async () => {
    const { FASE3_VERCEL_DOMAINS_ENABLED } = await import("./constants");
    expect(FASE3_VERCEL_DOMAINS_ENABLED).toBe(false);
  });
});
