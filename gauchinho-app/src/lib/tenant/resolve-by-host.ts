import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEV_TENANT_QUERY_PARAM,
  EMPRESA_B_SLUG,
  GAUCHINHO_SLUG,
} from "./constants";
import {
  devSlugFromHost,
  isDevelopmentNodeEnv,
  isOfficialGauchinhoHost,
  normalizeHost,
} from "./dominio";
import {
  getCachedTenantResolution,
  setCachedTenantResolution,
  type CachedTenantEntry,
  type CachedTenantHit,
} from "./tenant-host-cache";
import {
  isVercelPreviewGauchinhoHost,
  VERCEL_PREVIEW_TENANT_SOURCE,
} from "./vercel-preview-tenant";

export type ResolvedTenantRef = {
  empresaId: string;
  slug: string;
  source: CachedTenantHit["source"];
};

export type ResolveTenantResult =
  | { ok: true; tenant: ResolvedTenantRef }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "infra_unavailable_non_official"
        | "missing_service_key"
        | "inactive_or_unpublished";
      technicalError?: string;
    };

type EmpresaRow = {
  id: string;
  slug: string;
  status: string;
  ativo: boolean;
};

type BrandingRow = {
  status_publicacao: string;
};

function createReader(supabaseUrl: string, serviceKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isMissingRelationError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("empresa_dominios") ||
    m.includes("empresa_branding") ||
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find the table")
  );
}

function isPublishableInProduction(empresa: EmpresaRow, branding: BrandingRow | null): boolean {
  if (empresa.status !== "ativo" || !empresa.ativo) return false;
  if (!branding || branding.status_publicacao !== "PUBLICADO") return false;
  return true;
}

function allowsDevDraft(empresa: EmpresaRow): boolean {
  // Em development, Empresa B (ou qualquer tenant) pode resolver mesmo inativa / rascunho
  // quando o override explícito de desenvolvimento for usado.
  return isDevelopmentNodeEnv();
}

async function loadBranding(
  reader: SupabaseClient,
  empresaId: string,
): Promise<{ branding: BrandingRow | null; infraMissing: boolean; errorMessage?: string }> {
  const { data, error } = await reader
    .from("empresa_branding")
    .select("status_publicacao")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error.message)) {
      return { branding: null, infraMissing: true, errorMessage: error.message };
    }
    return { branding: null, infraMissing: false, errorMessage: error.message };
  }
  return { branding: (data as BrandingRow | null) ?? null, infraMissing: false };
}

async function resolveByDomainValor(
  reader: SupabaseClient,
  valor: string,
): Promise<
  | { kind: "hit"; empresa: EmpresaRow; dominioVerificado: boolean; dominioAtivo: boolean }
  | { kind: "miss" }
  | { kind: "infra_missing"; message: string }
  | { kind: "transient_error"; message: string }
> {
  const { data, error } = await reader
    .from("empresa_dominios")
    .select(
      "ativo, verificado, empresa:empresas!inner(id, slug, status, ativo)",
    )
    .eq("valor", valor)
    .eq("ativo", true)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error.message)) {
      return { kind: "infra_missing", message: error.message };
    }
    return { kind: "transient_error", message: error.message };
  }
  if (!data?.empresa) return { kind: "miss" };

  const empresa = data.empresa as unknown as EmpresaRow;
  return {
    kind: "hit",
    empresa,
    dominioVerificado: Boolean((data as { verificado?: boolean }).verificado),
    dominioAtivo: Boolean((data as { ativo?: boolean }).ativo),
  };
}

async function resolveEmpresaBySlug(
  reader: SupabaseClient,
  slug: string,
): Promise<
  | { kind: "hit"; empresa: EmpresaRow }
  | { kind: "miss" }
  | { kind: "infra_missing"; message: string }
  | { kind: "transient_error"; message: string }
> {
  const { data, error } = await reader
    .from("empresas")
    .select("id, slug, status, ativo")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error.message)) {
      return { kind: "infra_missing", message: error.message };
    }
    return { kind: "transient_error", message: error.message };
  }
  if (!data) return { kind: "miss" };
  return { kind: "hit", empresa: data as EmpresaRow };
}

function emergencyGauchinhoFallback(rawHost: string): ResolveTenantResult | null {
  if (!isOfficialGauchinhoHost(rawHost)) return null;
  /**
   * TODO(fase-2-pos-044): Remover este fallback emergencial após a Migration 044
   * estar aplicada e homologada em produção. Mantido apenas para evitar 404 no
   * domínio oficial da Gauchinho durante a janela código-antes-da-044.
   * Escopo estrito: somente gauchinhoconsorcios.com.br e www.
   */
  return {
    ok: true,
    tenant: {
      empresaId: "emergency-gauchinho-fallback",
      slug: GAUCHINHO_SLUG,
      source: "emergency_gauchinho_fallback",
    },
  };
}

async function resolveVercelPreviewGauchinho(
  reader: SupabaseClient | null,
  rawHost: string,
  cacheKey: string,
): Promise<ResolveTenantResult | null> {
  if (!isVercelPreviewGauchinhoHost(rawHost)) return null;

  let empresaId = "vercel-preview-gauchinho";
  if (reader) {
    const slugResult = await resolveEmpresaBySlug(reader, GAUCHINHO_SLUG);
    if (slugResult.kind === "hit") {
      empresaId = slugResult.empresa.id;
    }
  }

  const hit: CachedTenantEntry = {
    kind: "hit",
    empresaId,
    slug: GAUCHINHO_SLUG,
    source: VERCEL_PREVIEW_TENANT_SOURCE,
  };
  if (cacheKey) {
    setCachedTenantResolution(cacheKey, hit);
  }
  return {
    ok: true,
    tenant: {
      empresaId,
      slug: GAUCHINHO_SLUG,
      source: VERCEL_PREVIEW_TENANT_SOURCE,
    },
  };
}

const recentLogs = new Map<string, number>();
const LOG_COOLDOWN_MS = 60_000;

function logTechnical(message: string, detail?: string): void {
  // Sem segredos: não logar service key, tokens ou payloads.
  const key = `${message}|${(detail ?? "").slice(0, 80)}`;
  const now = Date.now();
  const last = recentLogs.get(key) ?? 0;
  if (now - last < LOG_COOLDOWN_MS) return;
  recentLogs.set(key, now);
  console.error(`[tenant-resolve] ${message}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
}

/**
 * Resolve tenant por host com prioridade:
 * 1. host normalizado em empresa_dominios
 * 2. www já tratado na normalização
 * 3. subdomínio cadastrado (mesmo match por valor)
 * 4. override exclusivo de development
 * 5. fallback temporário só para hosts oficiais da Gauchinho se infra 044 ausente
 * 6. site não configurado
 *
 * Credenciais: lidas neste módulo a partir de process.env (não receber a service
 * role como argumento do proxy). Em testes, supabaseUrl/serviceKey podem ser
 * injetados explicitamente.
 *
 * Nota Edge: este módulo NÃO usa `import "server-only"` nem `admin.ts` porque o
 * proxy/middleware do Next.js roda em Edge e não pode importar server-only.
 * O client de leitura é criado localmente e a chave nunca é reenviada em headers.
 */
export async function resolveTenantForRequest(input: {
  hostHeader: string | null;
  searchParams?: URLSearchParams;
  /** Somente para testes / injeção explícita. */
  supabaseUrl?: string;
  /** Somente para testes / injeção explícita. */
  serviceKey?: string;
}): Promise<ResolveTenantResult> {
  const rawHost = input.hostHeader;
  const normalized = normalizeHost(rawHost);
  const cacheKey = normalized || (rawHost ?? "").toLowerCase();
  const supabaseUrl = input.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = input.serviceKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (cacheKey) {
    const cached = getCachedTenantResolution(cacheKey);
    if (cached) {
      if (cached.kind === "hit") {
        return {
          ok: true,
          tenant: {
            empresaId: cached.empresaId,
            slug: cached.slug,
            source: cached.source,
          },
        };
      }
      if (cached.reason === "infra_unavailable") {
        const emergency = emergencyGauchinhoFallback(rawHost ?? "");
        if (emergency) return emergency;
      }
      // Miss em cache: hosts reais param aqui; preview Vercel oficial reavalia.
      if (!isVercelPreviewGauchinhoHost(rawHost)) {
        return { ok: false, reason: "not_configured" };
      }
    }
  }

  if (!supabaseUrl || !serviceKey) {
    const emergency = emergencyGauchinhoFallback(rawHost ?? "");
    if (emergency) {
      logTechnical("credenciais de leitura ausentes; fallback temporário Gauchinho para host oficial");
      return emergency;
    }
    const previewWithoutKey = await resolveVercelPreviewGauchinho(null, rawHost ?? "", cacheKey);
    if (previewWithoutKey) return previewWithoutKey;
    return { ok: false, reason: "missing_service_key" };
  }

  const reader = createReader(supabaseUrl, serviceKey);
  const isDev = isDevelopmentNodeEnv();

  // --- 1–3) Domínio cadastrado ---
  if (normalized) {
    const domainResult = await resolveByDomainValor(reader, normalized);

    if (domainResult.kind === "infra_missing") {
      logTechnical("infra Migration 044 indisponível", domainResult.message);
      const emergency = emergencyGauchinhoFallback(rawHost ?? "");
      if (emergency) {
        setCachedTenantResolution(cacheKey, {
          kind: "miss",
          reason: "infra_unavailable",
        }, { errorTransient: true });
        return emergency;
      }
      // Em development, continua para overrides (*.localhost / ?__tenant=)
      // mesmo com infra ausente — não falha fechado ainda.
      if (!isDev) {
        setCachedTenantResolution(cacheKey, { kind: "miss", reason: "infra_unavailable" }, {
          errorTransient: true,
        });
        return {
          ok: false,
          reason: "infra_unavailable_non_official",
          technicalError: domainResult.message,
        };
      }
    } else if (domainResult.kind === "transient_error") {
      logTechnical("erro transitório ao consultar empresa_dominios", domainResult.message);
      const emergency = emergencyGauchinhoFallback(rawHost ?? "");
      if (emergency) return emergency;
      if (!isDev) {
        setCachedTenantResolution(cacheKey, { kind: "miss", reason: "not_found" }, {
          errorTransient: true,
        });
        return { ok: false, reason: "not_configured", technicalError: domainResult.message };
      }
    } else if (domainResult.kind === "hit") {
      const { empresa, dominioVerificado, dominioAtivo } = domainResult;

      // Empresa B nunca resolve por domínio real em produção (e não deveria ter domínio).
      if (empresa.slug === EMPRESA_B_SLUG && !isDev) {
        setCachedTenantResolution(cacheKey, { kind: "miss", reason: "inactive" });
        return { ok: false, reason: "inactive_or_unpublished" };
      }

      if (!dominioAtivo || !dominioVerificado) {
        if (!(isDev && allowsDevDraft(empresa))) {
          setCachedTenantResolution(cacheKey, { kind: "miss", reason: "unpublished" });
          return { ok: false, reason: "inactive_or_unpublished" };
        }
      }

      const brandingResult = await loadBranding(reader, empresa.id);
      if (brandingResult.infraMissing) {
        logTechnical("empresa_branding indisponível", brandingResult.errorMessage);
        const emergency = emergencyGauchinhoFallback(rawHost ?? "");
        if (emergency) return emergency;
        if (!isDev) {
          return { ok: false, reason: "infra_unavailable_non_official" };
        }
      } else {
        const publishable = isPublishableInProduction(empresa, brandingResult.branding);
        if (!publishable && !(isDev && allowsDevDraft(empresa))) {
          setCachedTenantResolution(cacheKey, { kind: "miss", reason: "unpublished" });
          return { ok: false, reason: "inactive_or_unpublished" };
        }

        const hit: CachedTenantEntry = {
          kind: "hit",
          empresaId: empresa.id,
          slug: empresa.slug,
          source: "domain",
        };
        setCachedTenantResolution(cacheKey, hit);
        return {
          ok: true,
          tenant: { empresaId: empresa.id, slug: empresa.slug, source: "domain" },
        };
      }
    }
  }

  // --- 4) Overrides exclusivos de development ---
  if (isDev) {
    const queryTenant = input.searchParams?.get(DEV_TENANT_QUERY_PARAM) ?? null;
    const envTenant = process.env.DEV_TENANT_SLUG ?? null;
    const hostSlug = normalized ? devSlugFromHost(normalized) : null;
    const devSlug = queryTenant || hostSlug || envTenant || null;

    if (devSlug) {
      const slugResult = await resolveEmpresaBySlug(reader, devSlug);
      if (slugResult.kind === "hit") {
        const hit: CachedTenantEntry = {
          kind: "hit",
          empresaId: slugResult.empresa.id,
          slug: slugResult.empresa.slug,
          source: "dev_override",
        };
        setCachedTenantResolution(cacheKey || devSlug, hit);
        return {
          ok: true,
          tenant: {
            empresaId: slugResult.empresa.id,
            slug: slugResult.empresa.slug,
            source: "dev_override",
          },
        };
      }
      if (slugResult.kind === "infra_missing") {
        // Sem 044: em dev, sintetiza Empresa B / Gauchinho só para preview local.
        if (devSlug === GAUCHINHO_SLUG) {
          return {
            ok: true,
            tenant: {
              empresaId: "dev-gauchinho-synthetic",
              slug: GAUCHINHO_SLUG,
              source: "dev_override",
            },
          };
        }
        if (devSlug === EMPRESA_B_SLUG) {
          return {
            ok: true,
            tenant: {
              empresaId: "dev-empresa-b-synthetic",
              slug: EMPRESA_B_SLUG,
              source: "dev_override",
            },
          };
        }
      }
    }
  }

  // --- 5) Preview Vercel oficial deste projeto → Gauchinho (homologação) ---
  // Não usa query/headers de tenant; só VERCEL_ENV=preview + host cruzado com
  // VERCEL_URL/VERCEL_BRANCH_URL (ver vercel-preview-tenant.ts).
  const preview = await resolveVercelPreviewGauchinho(reader, rawHost ?? "", cacheKey);
  if (preview) return preview;

  // --- 6) Sem domínio cadastrado e sem override de development ---
  // Fallback temporário Gauchinho NÃO se aplica em miss limpo (tabela existe,
  // linha ausente). Ele só ocorre acima quando a infra 044 está indisponível
  // ou há erro transitório — e apenas para hosts oficiais.
  if (cacheKey) {
    setCachedTenantResolution(cacheKey, { kind: "miss", reason: "not_found" });
  }
  return { ok: false, reason: "not_configured" };
}
