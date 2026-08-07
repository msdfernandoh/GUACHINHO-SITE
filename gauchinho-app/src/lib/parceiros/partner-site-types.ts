/** Sources de resolução de site de parceiro (E6). Distintos dos sources de tenant Fase 2. */
export type PartnerSiteSource =
  | "parceiro_path"
  | "parceiro_subdomain"
  | "parceiro_domain";

/**
 * Contexto server-side completo.
 * Não serializar IDs sensíveis para o cliente sem filtro (`toPublicPartnerSiteProps`).
 */
export type PartnerSiteResolution = {
  source: PartnerSiteSource;
  empresa_id: string;
  empresa_slug: string;
  parceiro_site_id: string;
  organizacao_parceira_id: string;
  site_slug: string;
  status_publicacao: string;
  site_ativo: boolean;
  canal_principal: string;
  dominio_id: string | null;
  dominio_tipo: string | null;
  dominio_status: string | null;
  dominio_verificado: boolean;
  dominio_ssl_status: string | null;
  dominio_principal: boolean;
  canonical_host: string | null;
  canonical_redirect: boolean;
  requested_host: string;
  requested_path: string;
  /** Elegível a servir publicamente no futuro (E8) — E6 não publica. */
  public_eligible: boolean;
};

/** Props seguras para UI futura (sem IDs internos). */
export type PublicPartnerSiteProps = {
  source: PartnerSiteSource;
  empresa_slug: string;
  site_slug: string;
  status_publicacao: string;
  canal_principal: string;
  canonical_host: string | null;
  public_eligible: boolean;
};

export type PartnerResolveFailureReason =
  | "no_partner"
  | "slug_not_found"
  | "cross_tenant"
  | "site_inactive"
  | "site_arquivado"
  | "not_public_status"
  | "domain_removed"
  | "domain_suspended"
  | "org_mismatch"
  | "tenant_host_required"
  | "institutional_only"
  | "public_flag_off";

export type ResolvePartnerSiteResult =
  | { ok: true; partner: PartnerSiteResolution }
  | { ok: false; reason: PartnerResolveFailureReason; detail?: string };

/**
 * Ordem determinística documentada (E6):
 * A. normalizar Host
 * B. identificar se Host ∈ empresa_dominios
 * C. Host tenant + path /parceiro/[slug] → site por empresa_id+slug
 * D. Host ∈ parceiro_site_dominios → tenant=empresa_id do domínio + site
 * E. Host ∈ empresa_dominios → institucional (sem parceiro)
 * F. fallbacks Fase 2 (fora deste módulo)
 * G. host desconhecido → sem parceiro
 */
export const PARTNER_RESOLUTION_ORDER = [
  "A_normalize_host",
  "B_empresa_dominios_lookup",
  "C_parceiro_path",
  "D_parceiro_site_dominios",
  "E_institutional_tenant",
  "F_fase2_fallbacks",
  "G_unknown_host",
] as const;

/** Headers internos de parceiro — só proxy/server; sempre apagar se vierem do cliente. */
export const PARCEIRO_SITE_ID_HEADER = "x-parceiro-site-id";
export const PARCEIRO_SITE_SLUG_HEADER = "x-parceiro-site-slug";
export const PARCEIRO_SOURCE_HEADER = "x-parceiro-source";

export function toPublicPartnerSiteProps(
  r: PartnerSiteResolution
): PublicPartnerSiteProps {
  return {
    source: r.source,
    empresa_slug: r.empresa_slug,
    site_slug: r.site_slug,
    status_publicacao: r.status_publicacao,
    canal_principal: r.canal_principal,
    canonical_host: r.canonical_host,
    public_eligible: r.public_eligible,
  };
}
