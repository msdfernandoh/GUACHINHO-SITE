import {
  EMPRESA_ADMINISTRADORA_STATUS,
  ADMINISTRADORA_STATUS,
  GAUCHINHO_EMPRESA_ID,
} from "@/lib/administradoras/constants";
import { concessaoPermiteUso } from "@/lib/administradoras/rules";
import { GAUCHINHO_SLUG } from "@/lib/tenant/constants";

export const GRUPO_NOT_FOUND_MESSAGE = "Grupo não encontrado.";
export const COTA_NOT_FOUND_MESSAGE = "Cota não encontrada.";

export class GrupoNotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  constructor(message = GRUPO_NOT_FOUND_MESSAGE) {
    super(message);
    this.name = "GrupoNotFoundError";
  }
}

export class CotaNotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  constructor(message = COTA_NOT_FOUND_MESSAGE) {
    super(message);
    this.name = "CotaNotFoundError";
  }
}

export function throwGrupoNotFound(): never {
  throw new GrupoNotFoundError();
}

export function throwCotaNotFound(): never {
  throw new CotaNotFoundError();
}

export function isGrupoNotFoundError(err: unknown): err is GrupoNotFoundError {
  return (
    err instanceof GrupoNotFoundError ||
    (typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "NOT_FOUND" &&
      err instanceof Error &&
      err.message === GRUPO_NOT_FOUND_MESSAGE)
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isEmpresaUuid(valor: string | null | undefined): boolean {
  return typeof valor === "string" && UUID_RE.test(valor.trim());
}

/**
 * Normaliza empresa_id do tenant resolvido pelo proxy.
 * Aceita UUID real; mapeia synthetic/emergency Gauchinho → UUID canônico.
 * Nunca aceita empresa_id vindo do client como autoridade.
 */
export function resolveEmpresaIdForCatalog(tenant: {
  empresaId: string;
  slug: string;
}): string | null {
  const id = (tenant.empresaId ?? "").trim();
  const slug = (tenant.slug ?? "").trim().toLowerCase();
  if (!id || !slug) return null;

  if (isEmpresaUuid(id)) return id;

  // Headers synthetic/emergency do proxy (dev/fallback) — só por slug confiável.
  if (
    (id.startsWith("dev-") || id.startsWith("emergency-")) &&
    slug === GAUCHINHO_SLUG
  ) {
    return GAUCHINHO_EMPRESA_ID;
  }

  return null;
}

export type ConcessaoAuthRow = {
  administradora_id: string;
  status: string;
  administradora_status: string | null;
};

/** IDs de administradoras operáveis (global ATIVA + vínculo ATIVA). */
export function filterAdministradoraIdsAutorizadas(
  rows: ConcessaoAuthRow[],
): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (
      concessaoPermiteUso(
        row.administradora_status ?? ADMINISTRADORA_STATUS.INATIVA,
        row.status as "ATIVA" | "INATIVA" | "SUSPENSA",
      )
    ) {
      ids.add(row.administradora_id);
    }
  }
  return [...ids];
}

export function grupoElegivelCatalogo(grupo: {
  ativo?: boolean | null;
  status?: string | null;
  administradora_id?: string | null;
}): boolean {
  if (grupo.ativo === false) return false;
  if ((grupo.status ?? "") === "Inativo") return false;
  if (!grupo.administradora_id) return false;
  return true;
}

export function assertGrupoAutorizadoPorIds(
  grupo: {
    id: string;
    ativo?: boolean | null;
    status?: string | null;
    administradora_id?: string | null;
  } | null,
  administradoraIdsAutorizadas: ReadonlySet<string>,
): asserts grupo is NonNullable<typeof grupo> {
  if (!grupo) throwGrupoNotFound();
  if (!grupoElegivelCatalogo(grupo)) throwGrupoNotFound();
  if (!grupo.administradora_id || !administradoraIdsAutorizadas.has(grupo.administradora_id)) {
    throwGrupoNotFound();
  }
}

export function assertCotaDoGrupo(
  cota: { id: string; grupo_id: string; ativo?: boolean | null; status?: string | null } | null,
  grupoId: string,
): asserts cota is NonNullable<typeof cota> {
  if (!cota) throwCotaNotFound();
  if (cota.grupo_id !== grupoId) throwCotaNotFound();
  if (cota.ativo === false) throwCotaNotFound();
  if ((cota.status ?? "") === "Inativo" || (cota.status ?? "") === "Esgotado") {
    throwCotaNotFound();
  }
}

/** Status de vínculo que bloqueiam novo uso comercial. */
export const CONCESSAO_STATUS_BLOQUEADOS = [
  EMPRESA_ADMINISTRADORA_STATUS.INATIVA,
  EMPRESA_ADMINISTRADORA_STATUS.SUSPENSA,
] as const;

/** Extrai pares grupo/cota do payload de contratação ou simulação /grupos. */
export function parseSelecoesGrupoFromDadosSimulacao(
  dados: Record<string, unknown>,
): Array<{ grupoId: string; cotaId: string }> {
  const raw = Array.isArray(dados.selecoes) ? dados.selecoes : [];
  const out: Array<{ grupoId: string; cotaId: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const grupoObj = (o.grupo ?? {}) as Record<string, unknown>;
    const cotaObj = (o.cota ?? {}) as Record<string, unknown>;
    const grupoId = String(o.grupoId ?? grupoObj.id ?? "").trim();
    const cotaId = String(o.cotaId ?? cotaObj.id ?? "").trim();
    if (grupoId && cotaId) out.push({ grupoId, cotaId });
  }
  return out;
}
