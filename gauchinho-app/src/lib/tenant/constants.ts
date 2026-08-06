/** Headers internos de tenant — definidos apenas pelo proxy (nunca confiar no cliente). */
export const TENANT_EMPRESA_ID_HEADER = "x-tenant-empresa-id";
export const TENANT_SLUG_HEADER = "x-tenant-slug";

/** Slug canônico da empresa 1 (tenant legado operacional). */
export const GAUCHINHO_SLUG = "gauchinho";

/** Slug do tenant fictício de demonstração (Fase 2). */
export const EMPRESA_B_SLUG = "empresa-b";

/**
 * Hosts oficiais da Gauchinho elegíveis ao fallback temporário de transição
 * (somente quando a infra da Migration 044 ainda não está disponível).
 * Removível após homologação da 044.
 */
export const GAUCHINHO_OFFICIAL_HOSTS = [
  "gauchinhoconsorcios.com.br",
  "www.gauchinhoconsorcios.com.br",
] as const;

/** Query string de override — só funciona com NODE_ENV === "development". */
export const DEV_TENANT_QUERY_PARAM = "__tenant";

/** Tamanho máximo do host persistido (FQDN prático). */
export const MAX_DOMAIN_LENGTH = 253;
