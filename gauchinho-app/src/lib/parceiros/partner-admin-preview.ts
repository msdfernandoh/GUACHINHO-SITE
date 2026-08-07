import type { PartnerDomainFact, PartnerResolveFacts, PartnerSiteFact } from "./resolve-partner-site";
import { resolvePartnerSiteFromFacts } from "./resolve-partner-site";
import type { ResolvePartnerSiteResult } from "./partner-site-types";

/**
 * Preview autenticado (admin): monta facts a partir do site atual e simula
 * os 3 canais. Nunca publica; public_eligible permanece false com flag off.
 */
export function buildAdminPreviewFacts(input: {
  empresaId: string;
  empresaSlug: string;
  tenantOfficialHost: string;
  site: {
    id: string;
    empresa_id: string;
    organizacao_parceira_id: string;
    slug: string;
    status_publicacao: string;
    ativo: boolean;
    canal_principal: string;
  };
  orgEmpresaId: string;
  orgStatus: string;
  dominios: Array<{
    id: string;
    empresa_id: string;
    parceiro_site_id: string;
    valor: string;
    tipo: string;
    principal: boolean;
    status: string;
    verificado: boolean;
    ssl_status: string;
    canonical_redirect?: boolean;
  }>;
}): PartnerResolveFacts {
  const siteFact: PartnerSiteFact = {
    id: input.site.id,
    empresa_id: input.site.empresa_id,
    organizacao_parceira_id: input.site.organizacao_parceira_id,
    slug: input.site.slug,
    status_publicacao: input.site.status_publicacao,
    ativo: input.site.ativo,
    canal_principal: input.site.canal_principal,
    org_empresa_id: input.orgEmpresaId,
    org_status: input.orgStatus,
  };

  const domains: PartnerDomainFact[] = input.dominios.map((d) => ({
    id: d.id,
    empresa_id: d.empresa_id,
    parceiro_site_id: d.parceiro_site_id,
    valor: d.valor,
    tipo: d.tipo,
    principal: d.principal,
    status: d.status,
    verificado: d.verificado,
    ssl_status: d.ssl_status,
    canonical_redirect: d.canonical_redirect !== false,
  }));

  return {
    empresas: [{ id: input.empresaId, slug: input.empresaSlug }],
    tenantHosts: [
      {
        host: input.tenantOfficialHost,
        empresa_id: input.empresaId,
        empresa_slug: input.empresaSlug,
      },
    ],
    sites: [siteFact],
    domains,
  };
}

export function previewPartnerChannels(input: {
  facts: PartnerResolveFacts;
  siteSlug: string;
  tenantHost: string;
}): {
  path: ResolvePartnerSiteResult;
  subdomain: ResolvePartnerSiteResult | null;
  customDomain: ResolvePartnerSiteResult | null;
} {
  const path = resolvePartnerSiteFromFacts({
    hostHeader: input.tenantHost,
    pathname: `/parceiro/${input.siteSlug}`,
    facts: input.facts,
    mode: "admin_preview",
  });

  const sub = input.facts.domains.find((d) => d.tipo === "SUBDOMINIO_EMPRESA");
  const custom = input.facts.domains.find(
    (d) => d.tipo === "DOMINIO_PROPRIO" || d.tipo === "ALIAS"
  );

  return {
    path,
    subdomain: sub
      ? resolvePartnerSiteFromFacts({
          hostHeader: sub.valor,
          pathname: "/",
          facts: input.facts,
          mode: "admin_preview",
        })
      : null,
    customDomain: custom
      ? resolvePartnerSiteFromFacts({
          hostHeader: custom.valor,
          pathname: "/",
          facts: input.facts,
          mode: "admin_preview",
        })
      : null,
  };
}
