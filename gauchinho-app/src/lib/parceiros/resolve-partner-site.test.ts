import { describe, expect, it } from "vitest";
import {
  FASE3_PARCEIRO_PUBLIC_SITE_ENABLED,
  FASE3_VERCEL_DOMAINS_ENABLED,
} from "./constants";
import { buildPartnerCanonicalInfo } from "./partner-canonical";
import { PARTNER_RESOLUTION_ORDER } from "./partner-site-types";
import {
  extractParceiroPathSlug,
  mayServePartnerPublicSite,
  resolvePartnerSiteFromFacts,
  stripClientForcedTenantHints,
  type PartnerResolveFacts,
} from "./resolve-partner-site";

const GAUCHINHO = {
  id: "emp-gauchinho",
  slug: "gauchinho",
};
const EMPRESA_B = {
  id: "emp-b",
  slug: "empresa-b",
};

function baseFacts(overrides?: Partial<PartnerResolveFacts>): PartnerResolveFacts {
  const facts: PartnerResolveFacts = {
    empresas: [GAUCHINHO, EMPRESA_B],
    tenantHosts: [
      {
        host: "gauchinhoconsorcios.com.br",
        empresa_id: GAUCHINHO.id,
        empresa_slug: GAUCHINHO.slug,
      },
    ],
    sites: [
      {
        id: "site-a",
        empresa_id: GAUCHINHO.id,
        organizacao_parceira_id: "org-a",
        slug: "alfa",
        status_publicacao: "PUBLICADO",
        ativo: true,
        canal_principal: "ROTA",
        org_empresa_id: GAUCHINHO.id,
        org_status: "ATIVA",
      },
      {
        id: "site-b",
        empresa_id: EMPRESA_B.id,
        organizacao_parceira_id: "org-b",
        slug: "alfa",
        status_publicacao: "PUBLICADO",
        ativo: true,
        canal_principal: "ROTA",
        org_empresa_id: EMPRESA_B.id,
        org_status: "ATIVA",
      },
      {
        id: "site-draft",
        empresa_id: GAUCHINHO.id,
        organizacao_parceira_id: "org-a",
        slug: "rascunho",
        status_publicacao: "RASCUNHO",
        ativo: true,
        canal_principal: "ROTA",
        org_empresa_id: GAUCHINHO.id,
        org_status: "ATIVA",
      },
      {
        id: "site-arch",
        empresa_id: GAUCHINHO.id,
        organizacao_parceira_id: "org-a",
        slug: "velho",
        status_publicacao: "ARQUIVADO",
        ativo: false,
        canal_principal: "ROTA",
        org_empresa_id: GAUCHINHO.id,
        org_status: "ATIVA",
      },
    ],
    domains: [
      {
        id: "dom-sub",
        empresa_id: GAUCHINHO.id,
        parceiro_site_id: "site-a",
        valor: "alfa.gauchinhoconsorcios.com.br",
        tipo: "SUBDOMINIO_EMPRESA",
        principal: true,
        status: "ATIVO",
        verificado: true,
        ssl_status: "READY",
        canonical_redirect: true,
      },
      {
        id: "dom-apex",
        empresa_id: GAUCHINHO.id,
        parceiro_site_id: "site-a",
        valor: "parceiro-alfa.com.br",
        tipo: "DOMINIO_PROPRIO",
        principal: false,
        status: "ATIVO",
        verificado: true,
        ssl_status: "READY",
        canonical_redirect: true,
        principal_variant: "apex",
      },
      {
        id: "dom-alias",
        empresa_id: GAUCHINHO.id,
        parceiro_site_id: "site-a",
        valor: "alias-alfa.com.br",
        tipo: "ALIAS",
        principal: false,
        status: "ATIVO",
        verificado: true,
        ssl_status: "READY",
        canonical_redirect: true,
      },
      {
        id: "dom-susp",
        empresa_id: GAUCHINHO.id,
        parceiro_site_id: "site-a",
        valor: "suspenso-alfa.com.br",
        tipo: "DOMINIO_PROPRIO",
        principal: false,
        status: "SUSPENSO",
        verificado: true,
        ssl_status: "READY",
        canonical_redirect: true,
      },
      {
        id: "dom-rem",
        empresa_id: GAUCHINHO.id,
        parceiro_site_id: "site-a",
        valor: "removido-alfa.com.br",
        tipo: "DOMINIO_PROPRIO",
        principal: false,
        status: "REMOVIDO",
        verificado: false,
        ssl_status: "PENDING",
        canonical_redirect: true,
      },
      {
        id: "dom-b-sub",
        empresa_id: EMPRESA_B.id,
        parceiro_site_id: "site-b",
        valor: "alfa.empresa-b.test",
        tipo: "SUBDOMINIO_EMPRESA",
        principal: true,
        status: "ATIVO",
        verificado: true,
        ssl_status: "READY",
        canonical_redirect: true,
      },
    ],
  };
  return { ...facts, ...overrides };
}

describe("E6 — resolução runtime parceiro", () => {
  it("ordem documentada A–G", () => {
    expect(PARTNER_RESOLUTION_ORDER[0]).toBe("A_normalize_host");
    expect(PARTNER_RESOLUTION_ORDER).toContain("C_parceiro_path");
    expect(PARTNER_RESOLUTION_ORDER).toContain("D_parceiro_site_dominios");
  });

  it("flags públicas/Vercel desligadas", () => {
    expect(FASE3_PARCEIRO_PUBLIC_SITE_ENABLED).toBe(false);
    expect(FASE3_VERCEL_DOMAINS_ENABLED).toBe(false);
  });

  describe("ROTA", () => {
    it("host Gauchinho + /parceiro/slug válido → empresa/site corretos", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "www.gauchinhoconsorcios.com.br",
        pathname: "/parceiro/alfa",
        facts: baseFacts(),
        mode: "internal",
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.partner.source).toBe("parceiro_path");
        expect(r.partner.empresa_id).toBe(GAUCHINHO.id);
        expect(r.partner.parceiro_site_id).toBe("site-a");
        expect(r.partner.site_slug).toBe("alfa");
        expect(r.partner.public_eligible).toBe(false);
      }
    });

    it("slug inexistente → não resolve", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "gauchinhoconsorcios.com.br",
        pathname: "/parceiro/nao-existe",
        facts: baseFacts(),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("slug_not_found");
    });

    it("slug de Empresa B no host Gauchinho → não resolve", () => {
      // mesmo slug "alfa" existe em B, mas host é Gauchinho → só site-a
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "gauchinhoconsorcios.com.br",
        pathname: "/parceiro/alfa",
        facts: baseFacts(),
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.partner.empresa_id).toBe(GAUCHINHO.id);
        expect(r.partner.parceiro_site_id).not.toBe("site-b");
      }
    });

    it("site arquivado → não público / não resolve internal", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "gauchinhoconsorcios.com.br",
        pathname: "/parceiro/velho",
        facts: baseFacts(),
        mode: "internal",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(["site_arquivado", "site_inactive"]).toContain(r.reason);
    });
  });

  describe("SUBDOMÍNIO", () => {
    it("subdomínio cadastrado → resolve", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "alfa.gauchinhoconsorcios.com.br",
        pathname: "/",
        facts: baseFacts(),
        mode: "internal",
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.partner.source).toBe("parceiro_subdomain");
        expect(r.partner.dominio_id).toBe("dom-sub");
      }
    });

    it("subdomínio não cadastrado → não resolve como parceiro", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "nao-cadastrado.gauchinhoconsorcios.com.br",
        pathname: "/",
        facts: baseFacts(),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("no_partner");
    });

    it("label igual em tenant diferente → sem cross-tenant", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "alfa.empresa-b.test",
        pathname: "/",
        facts: baseFacts(),
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.partner.empresa_id).toBe(EMPRESA_B.id);
        expect(r.partner.parceiro_site_id).toBe("site-b");
      }
    });

    it("host normalizado (www strip) para domínio próprio", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "WWW.parceiro-alfa.com.br",
        pathname: "/",
        facts: baseFacts(),
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.partner.source).toBe("parceiro_domain");
    });
  });

  describe("DOMÍNIO PRÓPRIO", () => {
    it("apex resolve", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "parceiro-alfa.com.br",
        pathname: "/",
        facts: baseFacts(),
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.partner.dominio_id).toBe("dom-apex");
    });

    it("www resolve", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "www.parceiro-alfa.com.br",
        pathname: "/",
        facts: baseFacts(),
      });
      expect(r.ok).toBe(true);
    });

    it("alias resolve", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "alias-alfa.com.br",
        pathname: "/",
        facts: baseFacts(),
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.partner.dominio_tipo).toBe("ALIAS");
    });

    it("domínio suspenso não é elegível para público", () => {
      const pub = resolvePartnerSiteFromFacts({
        hostHeader: "suspenso-alfa.com.br",
        pathname: "/",
        facts: baseFacts(),
        mode: "public",
      });
      expect(pub.ok).toBe(false);

      const internal = resolvePartnerSiteFromFacts({
        hostHeader: "suspenso-alfa.com.br",
        pathname: "/",
        facts: baseFacts(),
        mode: "internal",
      });
      expect(internal.ok).toBe(true);
      if (internal.ok) expect(internal.partner.public_eligible).toBe(false);
    });

    it("domínio removido não resolve", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "removido-alfa.com.br",
        pathname: "/",
        facts: baseFacts(),
      });
      expect(r.ok).toBe(false);
    });

    it("domínio de outro tenant não cruza", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "alfa.empresa-b.test",
        pathname: "/",
        facts: baseFacts(),
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.partner.empresa_id).toBe(EMPRESA_B.id);
    });
  });

  describe("TENANT / institucional", () => {
    it("empresa_dominios no apex oficial → institutional_only (não parceiro)", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "gauchinhoconsorcios.com.br",
        pathname: "/",
        facts: baseFacts(),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("institutional_only");
    });

    it("não trata host de empresa_dominios como parceiro_site_dominio", () => {
      const facts = baseFacts({
        domains: [
          ...baseFacts().domains,
          {
            id: "evil",
            empresa_id: GAUCHINHO.id,
            parceiro_site_id: "site-a",
            valor: "gauchinhoconsorcios.com.br",
            tipo: "DOMINIO_PROPRIO",
            principal: false,
            status: "ATIVO",
            verificado: true,
            ssl_status: "READY",
            canonical_redirect: true,
          },
        ],
      });
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "gauchinhoconsorcios.com.br",
        pathname: "/",
        facts,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("institutional_only");
    });
  });

  describe("SEGURANÇA", () => {
    it("query empresa_id / parceiro_site_id não muda resolução", () => {
      const qs = new URLSearchParams({
        empresa_id: EMPRESA_B.id,
        parceiro_site_id: "site-b",
        tenant: "empresa-b",
      });
      const stripped = stripClientForcedTenantHints(qs);
      expect(stripped.get("empresa_id")).toBeNull();

      const r = resolvePartnerSiteFromFacts({
        hostHeader: "gauchinhoconsorcios.com.br",
        pathname: "/parceiro/alfa",
        searchParams: qs,
        facts: baseFacts(),
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.partner.empresa_id).toBe(GAUCHINHO.id);
    });

    it("extractParceiroPathSlug ignora path malicioso", () => {
      expect(extractParceiroPathSlug("/parceiro/alfa/../admin")).toBeNull();
      expect(extractParceiroPathSlug("/parceiro/alfa")).toBe("alfa");
    });
  });

  describe("FLAGS", () => {
    it("public site flag=false → mayServe sempre false", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "gauchinhoconsorcios.com.br",
        pathname: "/parceiro/alfa",
        facts: baseFacts(),
        mode: "internal",
      });
      expect(mayServePartnerPublicSite(r)).toBe(false);
      expect(FASE3_PARCEIRO_PUBLIC_SITE_ENABLED).toBe(false);
    });

    it("mode public com flag off → public_flag_off", () => {
      const r = resolvePartnerSiteFromFacts({
        hostHeader: "gauchinhoconsorcios.com.br",
        pathname: "/parceiro/alfa",
        facts: baseFacts(),
        mode: "public",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("public_flag_off");
    });
  });

  describe("CANÔNICO", () => {
    it("prepara URL canônica sem redirect", () => {
      const info = buildPartnerCanonicalInfo({
        site_slug: "alfa",
        canal_principal: "DOMINIO",
        dominio_valor: "parceiro-alfa.com.br",
        dominio_tipo: "DOMINIO_PROPRIO",
        principal_variant: "www",
      });
      expect(info.host_principal).toBe("www.parceiro-alfa.com.br");
      expect(info.alias_www).toBe("www.parceiro-alfa.com.br");
      expect(info.canonical_url).toBe("https://www.parceiro-alfa.com.br/");
    });
  });
});
