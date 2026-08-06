import { isOfficialGauchinhoHost, normalizeHost } from "./dominio";

/**
 * Source identificável para resolução Gauchinho em preview Vercel oficial.
 * Não confundir com emergency_gauchinho_fallback (hosts oficiais / infra 044).
 */
export const VERCEL_PREVIEW_TENANT_SOURCE = "vercel_preview_gauchinho" as const;

/** Prefixo do projeto Vercel `guachinho-site`. */
export const VERCEL_PREVIEW_PROJECT_PREFIX = "guachinho-site-";

/** Sufixo do team/scope observado nos hosts de deploy deste projeto. */
export const VERCEL_PREVIEW_TEAM_SUFFIX = "-hugo-8097s-projects.vercel.app";

/** Host de produção do projeto (não é preview). */
export const VERCEL_PRODUCTION_PROJECT_HOST = "guachinho-site.vercel.app";

export type VercelRuntimeEnv = {
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_TARGET_ENV?: string;
};

export function readVercelRuntimeEnv(
  env: NodeJS.ProcessEnv = process.env,
): VercelRuntimeEnv {
  return {
    VERCEL_ENV: env.VERCEL_ENV,
    VERCEL_URL: env.VERCEL_URL,
    VERCEL_BRANCH_URL: env.VERCEL_BRANCH_URL,
    VERCEL_PROJECT_PRODUCTION_URL: env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_TARGET_ENV: env.VERCEL_TARGET_ENV,
  };
}

function matchesProjectPreviewPattern(host: string): boolean {
  if (!host.endsWith(".vercel.app")) return false;
  if (host === VERCEL_PRODUCTION_PROJECT_HOST) return false;
  if (!host.startsWith(VERCEL_PREVIEW_PROJECT_PREFIX)) return false;
  if (!host.endsWith(VERCEL_PREVIEW_TEAM_SUFFIX)) return false;
  // deployment / git-branch / user alias: guachinho-site-<label>-hugo-8097s-projects.vercel.app
  return /^guachinho-site-[a-z0-9-]+-hugo-8097s-projects\.vercel\.app$/.test(host);
}

/**
 * Homologação segura: só resolve Gauchinho em preview oficial deste projeto.
 *
 * Requer VERCEL_ENV === "preview" e cruza o Host com VERCEL_URL / VERCEL_BRANCH_URL
 * quando disponíveis (não confia só no header Host).
 */
export function isVercelPreviewGauchinhoHost(
  hostHeader: string | null | undefined,
  runtime: VercelRuntimeEnv = readVercelRuntimeEnv(),
): boolean {
  if (runtime.VERCEL_ENV !== "preview") return false;
  if (runtime.VERCEL_TARGET_ENV === "production") return false;

  const host = normalizeHost(hostHeader);
  if (!host) return false;
  if (isOfficialGauchinhoHost(hostHeader)) return false;
  if (!matchesProjectPreviewPattern(host)) return false;

  const productionProjectHost = normalizeHost(runtime.VERCEL_PROJECT_PRODUCTION_URL);
  if (productionProjectHost) {
    // Domínio customizado ou host de produção do projeto nunca usam este fallback.
    if (host === productionProjectHost) return false;
    if (productionProjectHost === VERCEL_PRODUCTION_PROJECT_HOST && host === VERCEL_PRODUCTION_PROJECT_HOST) {
      return false;
    }
  }

  const allowedFromEnv = [runtime.VERCEL_URL, runtime.VERCEL_BRANCH_URL]
    .map((value) => normalizeHost(value))
    .filter((value): value is string => Boolean(value));

  if (allowedFromEnv.length > 0) {
    return allowedFromEnv.includes(host);
  }

  // Sem VERCEL_URL/BRANCH_URL (cenário atípico): ainda exige padrão estrito do projeto.
  return true;
}
