import { FASE3_PARCEIRO_PUBLIC_SITE_ENABLED } from "./constants";
import { normalizeHost } from "./normalize";
import {
  buildPartnerCanonicalInfo,
} from "./partner-canonical";
import type {
  PartnerSiteResolution,
  PartnerSiteSource,
  ResolvePartnerSiteResult,
} from "./partner-site-types";

/** Fatos injetáveis — testes e loaders; sem I/O neste módulo. */
export type PartnerSiteFact = {
  id: string;
  empresa_id: string;
  organizacao_parceira_id: string;
  slug: string;
  status_publicacao: string;
  ativo: boolean;
  canal_principal: string;
  org_empresa_id: string;
  org_status: string;
};

export type PartnerDomainFact = {
  id: string;
  empresa_id: string;
  parceiro_site_id: string;
  valor: string;
  tipo: string;
  principal: boolean;
  status: string;
  verificado: boolean;
  ssl_status: string;
  canonical_redirect: boolean;
  principal_variant?: "apex" | "www";
};

export type TenantHostFact = {
  host: string;
  empresa_id: string;
  empresa_slug: string;
};

export type PartnerResolveFacts = {
  /** Hosts normalizados presentes em empresa_dominios (ativos). */
  tenantHosts: TenantHostFact[];
  /** Catálogo de empresas (id→slug) para domínio de parceiro sem host tenant. */
  empresas: Array<{ id: string; slug: string }>;
  sites: PartnerSiteFact[];
  domains: PartnerDomainFact[];
};

export type PartnerResolveMode = "internal" | "public" | "admin_preview";

const CLIENT_FORCED_QUERY_KEYS = [
  "empresa_id",
  "parceiro_site_id",
  "tenant",
  "tenant_id",
  "partner_site_id",
] as const;

/**
 * Extrai slug de /parceiro/[slug] (ignora query). Retorna null se não casar.
 */
export function extractParceiroPathSlug(pathname: string): string | null {
  const path = (pathname.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  const m = path.match(/^\/parceiro\/([a-z0-9]+(?:-[a-z0-9]+)*)$/i);
  if (!m?.[1]) return null;
  return m[1].toLowerCase();
}

/** Ignora tentativas do cliente de forçar tenant/site via query. */
export function stripClientForcedTenantHints(
  searchParams?: URLSearchParams | null
): URLSearchParams {
  const out = new URLSearchParams(searchParams?.toString() ?? "");
  for (const key of CLIENT_FORCED_QUERY_KEYS) {
    out.delete(key);
  }
  return out;
}

function findTenantHost(
  facts: PartnerResolveFacts,
  host: string
): TenantHostFact | null {
  return facts.tenantHosts.find((t) => normalizeHost(t.host) === host) ?? null;
}

function findSiteByEmpresaSlug(
  facts: PartnerResolveFacts,
  empresaId: string,
  slug: string
): PartnerSiteFact | null {
  return (
    facts.sites.find(
      (s) => s.empresa_id === empresaId && s.slug === slug.toLowerCase()
    ) ?? null
  );
}

function findSiteById(
  facts: PartnerResolveFacts,
  siteId: string
): PartnerSiteFact | null {
  return facts.sites.find((s) => s.id === siteId) ?? null;
}

/**
 * Match de domínio de parceiro por host normalizado (apex).
 * www já foi removido por normalizeHost — cobre apex e www.
 */
function findPartnerDomainsForHost(
  facts: PartnerResolveFacts,
  host: string
): PartnerDomainFact[] {
  return facts.domains.filter((d) => normalizeHost(d.valor) === host);
}

function siteBaseOk(
  site: PartnerSiteFact,
  empresaId: string
): ResolvePartnerSiteResult | null {
  if (site.empresa_id !== empresaId) {
    return { ok: false, reason: "cross_tenant", detail: "site.empresa_id diverge" };
  }
  if (site.org_empresa_id !== empresaId) {
    return { ok: false, reason: "org_mismatch", detail: "org de outro tenant" };
  }
  if (site.organizacao_parceira_id && site.org_empresa_id !== site.empresa_id) {
    return { ok: false, reason: "org_mismatch" };
  }
  if (!site.ativo) {
    return { ok: false, reason: "site_inactive" };
  }
  if (site.status_publicacao === "ARQUIVADO") {
    return { ok: false, reason: "site_arquivado" };
  }
  return null;
}

function isPublicStatus(status: string): boolean {
  return status === "PUBLICADO";
}

function computePublicEligible(input: {
  mode: PartnerResolveMode;
  site: PartnerSiteFact;
  domain: PartnerDomainFact | null;
  source: PartnerSiteSource;
}): boolean {
  if (!FASE3_PARCEIRO_PUBLIC_SITE_ENABLED) return false;
  if (input.mode === "admin_preview") return false;
  if (!input.site.ativo || !isPublicStatus(input.site.status_publicacao)) return false;
  if (input.site.org_status !== "ATIVA") return false;

  if (input.source === "parceiro_path") {
    return true;
  }

  const d = input.domain;
  if (!d) return false;
  if (d.status === "REMOVIDO" || d.status === "SUSPENSO") return false;
  if (d.status !== "ATIVO") return false;
  if (!d.verificado) return false;
  if (d.ssl_status !== "READY") return false;
  return true;
}

function buildResolution(input: {
  source: PartnerSiteSource;
  site: PartnerSiteFact;
  empresa_slug: string;
  domain: PartnerDomainFact | null;
  requested_host: string;
  requested_path: string;
  mode: PartnerResolveMode;
}): PartnerSiteResolution {
  const variant = input.domain?.principal_variant ?? "apex";
  const apex = input.domain ? normalizeHost(input.domain.valor) : null;
  const canonical = buildPartnerCanonicalInfo({
    site_slug: input.site.slug,
    canal_principal: input.site.canal_principal,
    dominio_valor: apex,
    dominio_tipo: input.domain?.tipo,
    principal_variant: variant,
    canonical_redirect: input.domain?.canonical_redirect,
  });

  const public_eligible = computePublicEligible({
    mode: input.mode,
    site: input.site,
    domain: input.domain,
    source: input.source,
  });

  return {
    source: input.source,
    empresa_id: input.site.empresa_id,
    empresa_slug: input.empresa_slug,
    parceiro_site_id: input.site.id,
    organizacao_parceira_id: input.site.organizacao_parceira_id,
    site_slug: input.site.slug,
    status_publicacao: input.site.status_publicacao,
    site_ativo: input.site.ativo,
    canal_principal: input.site.canal_principal,
    dominio_id: input.domain?.id ?? null,
    dominio_tipo: input.domain?.tipo ?? null,
    dominio_status: input.domain?.status ?? null,
    dominio_verificado: Boolean(input.domain?.verificado),
    dominio_ssl_status: input.domain?.ssl_status ?? null,
    dominio_principal: input.domain?.principal ?? false,
    canonical_host: canonical.host_principal,
    canonical_redirect: canonical.canonical_redirect,
    requested_host: input.requested_host,
    requested_path: input.requested_path,
    public_eligible,
  };
}

/**
 * Resolve site de parceiro (puro).
 *
 * Nunca promove organização a tenant: empresa_id vem só das relações persistidas.
 * Querystring/header do cliente não influenciam (hints forçados são ignorados).
 *
 * `mode`:
 * - internal: identifica parceiro mesmo em RASCUNHO (para E8/admin); public_eligible ainda respeita flag
 * - public: exige elegibilidade pública futura; com flag off → public_flag_off se achar site
 * - admin_preview: permite RASCUNHO; public_eligible sempre false
 */
export function resolvePartnerSiteFromFacts(input: {
  hostHeader: string | null;
  pathname: string;
  searchParams?: URLSearchParams | null;
  facts: PartnerResolveFacts;
  mode?: PartnerResolveMode;
  /** Slug da empresa quando tenant veio de fallback/preview (sem row em facts.tenantHosts). */
  resolvedTenant?: { empresa_id: string; empresa_slug: string } | null;
}): ResolvePartnerSiteResult {
  const mode = input.mode ?? "internal";
  // A — normalizar
  const host = normalizeHost(input.hostHeader);
  const path = input.pathname.split("?")[0] || "/";
  // Segurança: descartar hints forçados (não usados na lógica)
  stripClientForcedTenantHints(input.searchParams);

  // B — host em empresa_dominios?
  const tenantFromDomain = host ? findTenantHost(input.facts, host) : null;
  const tenant =
    tenantFromDomain ??
    (input.resolvedTenant
      ? {
          host,
          empresa_id: input.resolvedTenant.empresa_id,
          empresa_slug: input.resolvedTenant.empresa_slug,
        }
      : null);

  // C — rota /parceiro/[slug] no host do tenant
  const pathSlug = extractParceiroPathSlug(path);
  if (pathSlug) {
    if (!tenant) {
      return { ok: false, reason: "tenant_host_required" };
    }
    const site = findSiteByEmpresaSlug(input.facts, tenant.empresa_id, pathSlug);
    if (!site) {
      return { ok: false, reason: "slug_not_found" };
    }
    const baseErr = siteBaseOk(site, tenant.empresa_id);
    if (baseErr) return baseErr;

    if (mode === "public") {
      if (!FASE3_PARCEIRO_PUBLIC_SITE_ENABLED) {
        return { ok: false, reason: "public_flag_off" };
      }
      if (!isPublicStatus(site.status_publicacao)) {
        return { ok: false, reason: "not_public_status" };
      }
    } else if (mode === "internal" && site.status_publicacao === "ARQUIVADO") {
      return { ok: false, reason: "site_arquivado" };
    }

    // Domínio principal do site (se houver) — usado para canonical E8; path não exige domínio.
    const principalDomain =
      input.facts.domains.find(
        (d) =>
          d.parceiro_site_id === site.id &&
          d.principal &&
          d.status !== "REMOVIDO"
      ) ?? null;

    return {
      ok: true,
      partner: buildResolution({
        source: "parceiro_path",
        site,
        empresa_slug: tenant.empresa_slug,
        domain: principalDomain,
        requested_host: host || (input.hostHeader ?? ""),
        requested_path: path,
        mode,
      }),
    };
  }

  // D — host em parceiro_site_dominios
  // Domínios de tenant (empresa_dominios) NUNCA são tratados como parceiro aqui.
  if (host && !tenantFromDomain) {
    const matches = findPartnerDomainsForHost(input.facts, host).filter(
      (d) => d.status !== "REMOVIDO"
    );
    if (matches.length > 0) {
      // Preferir principal; senão o primeiro
      const domain =
        matches.find((d) => d.principal) ?? matches[0]!;
      if (domain.status === "SUSPENSO" && mode === "public") {
        return { ok: false, reason: "domain_suspended" };
      }

      const site = findSiteById(input.facts, domain.parceiro_site_id);
      if (!site) {
        return { ok: false, reason: "slug_not_found", detail: "site do domínio ausente" };
      }
      if (domain.empresa_id !== site.empresa_id) {
        return { ok: false, reason: "cross_tenant", detail: "domínio×site" };
      }
      const baseErr = siteBaseOk(site, domain.empresa_id);
      if (baseErr) return baseErr;

      const empSlug =
        input.facts.empresas.find((e) => e.id === domain.empresa_id)?.slug ??
        input.facts.tenantHosts.find((t) => t.empresa_id === domain.empresa_id)
          ?.empresa_slug ??
        (input.resolvedTenant?.empresa_id === domain.empresa_id
          ? input.resolvedTenant.empresa_slug
          : "");

      if (!empSlug) {
        return {
          ok: false,
          reason: "cross_tenant",
          detail: "empresa_slug desconhecido para domínio de parceiro",
        };
      }

      if (mode === "public") {
        if (!FASE3_PARCEIRO_PUBLIC_SITE_ENABLED) {
          return { ok: false, reason: "public_flag_off" };
        }
        if (domain.status === "SUSPENSO") {
          return { ok: false, reason: "domain_suspended" };
        }
        if (!isPublicStatus(site.status_publicacao)) {
          return { ok: false, reason: "not_public_status" };
        }
      }

      const source: PartnerSiteSource =
        domain.tipo === "SUBDOMINIO_EMPRESA"
          ? "parceiro_subdomain"
          : "parceiro_domain";

      return {
        ok: true,
        partner: buildResolution({
          source,
          site,
          empresa_slug: empSlug,
          domain,
          requested_host: host,
          requested_path: path,
          mode,
        }),
      };
    }
  }

  // E — host institucional: sem parceiro
  if (tenantFromDomain) {
    return { ok: false, reason: "institutional_only" };
  }

  // G — desconhecido neste módulo (Fase 2 cuida do tenant/fallback)
  return { ok: false, reason: "no_partner" };
}

/**
 * Gate E8: com flag false, nunca autoriza servir site público de parceiro,
 * mesmo que a resolução interna tenha sucesso.
 */
export function mayServePartnerPublicSite(
  result: ResolvePartnerSiteResult
): boolean {
  if (!FASE3_PARCEIRO_PUBLIC_SITE_ENABLED) return false;
  return result.ok && result.partner.public_eligible;
}
