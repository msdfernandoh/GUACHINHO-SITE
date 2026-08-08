import {
  ADMINISTRADORA_STATUS,
  EMPRESA_ADMINISTRADORA_STATUS,
  FASE4_PERMISSOES,
} from "./constants";
import type {
  Administradora,
  AdministradoraAutorizada,
  AdministradoraStatus,
  EmpresaAdministradora,
  EmpresaAdministradoraStatus,
} from "./types";

/** Ambos ATIVA: único estado que autoriza operação nova. */
export function concessaoPermiteUso(
  administradoraStatus: AdministradoraStatus | string | null | undefined,
  vinculoStatus: EmpresaAdministradoraStatus | string | null | undefined,
): boolean {
  return (
    administradoraStatus === ADMINISTRADORA_STATUS.ATIVA &&
    vinculoStatus === EMPRESA_ADMINISTRADORA_STATUS.ATIVA
  );
}

export function normalizeAdministradoraSlug(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const normalized = valor
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : null;
}

export function toAdministradoraAutorizada(
  admin: Pick<
    Administradora,
    "id" | "nome" | "nome_fantasia" | "slug" | "logo_url" | "site_url" | "status"
  >,
  concessao: Pick<EmpresaAdministradora, "id" | "empresa_id" | "status">,
): AdministradoraAutorizada {
  return {
    id: admin.id,
    nome: admin.nome,
    nome_fantasia: admin.nome_fantasia,
    slug: admin.slug,
    logo_url: admin.logo_url,
    site_url: admin.site_url,
    status: admin.status,
    concessao: {
      id: concessao.id,
      empresa_id: concessao.empresa_id,
      status: concessao.status,
    },
  };
}

/**
 * Filtra concessões para uma empresa: só ATIVA+ATIVA.
 * Ignora vínculos de outras empresas (defesa em profundidade).
 */
export function filterAdministradorasAutorizadasForEmpresa(
  empresaId: string,
  rows: Array<{
    administradora: Pick<
      Administradora,
      "id" | "nome" | "nome_fantasia" | "slug" | "logo_url" | "site_url" | "status"
    > | null;
    concessao: Pick<EmpresaAdministradora, "id" | "empresa_id" | "status" | "administradora_id">;
  }>,
): AdministradoraAutorizada[] {
  const out: AdministradoraAutorizada[] = [];
  for (const row of rows) {
    if (!row.administradora) continue;
    if (row.concessao.empresa_id !== empresaId) continue;
    if (!concessaoPermiteUso(row.administradora.status, row.concessao.status)) continue;
    out.push(toAdministradoraAutorizada(row.administradora, row.concessao));
  }
  return out;
}

export function resolveAutorizadaById(
  empresaId: string,
  administradoraId: string,
  rows: Array<{
    administradora: Pick<
      Administradora,
      "id" | "nome" | "nome_fantasia" | "slug" | "logo_url" | "site_url" | "status"
    > | null;
    concessao: Pick<EmpresaAdministradora, "id" | "empresa_id" | "status" | "administradora_id">;
  }>,
): AdministradoraAutorizada | null {
  const match = rows.find(
    (r) =>
      r.administradora?.id === administradoraId &&
      r.concessao.empresa_id === empresaId &&
      r.concessao.administradora_id === administradoraId,
  );
  if (!match?.administradora) return null;
  if (!concessaoPermiteUso(match.administradora.status, match.concessao.status)) return null;
  return toAdministradoraAutorizada(match.administradora, match.concessao);
}

export function resolveAutorizadaBySlug(
  empresaId: string,
  slug: string,
  rows: Array<{
    administradora: Pick<
      Administradora,
      "id" | "nome" | "nome_fantasia" | "slug" | "logo_url" | "site_url" | "status"
    > | null;
    concessao: Pick<EmpresaAdministradora, "id" | "empresa_id" | "status" | "administradora_id">;
  }>,
): AdministradoraAutorizada | null {
  const normalized = normalizeAdministradoraSlug(slug);
  if (!normalized) return null;
  const match = rows.find(
    (r) =>
      r.concessao.empresa_id === empresaId &&
      r.administradora != null &&
      normalizeAdministradoraSlug(r.administradora.slug) === normalized,
  );
  if (!match?.administradora) return null;
  if (!concessaoPermiteUso(match.administradora.status, match.concessao.status)) return null;
  return toAdministradoraAutorizada(match.administradora, match.concessao);
}

/** Matriz estática: só super_admin recebe permissões Fase 4 (espelha seed 047). */
export function papelTemPermissaoFase4(
  papelCodigo: string,
  permissao: string,
): boolean {
  if (papelCodigo !== "super_admin") return false;
  return (
    permissao === FASE4_PERMISSOES.gerenciarCatalogoAdministradoras ||
    permissao === FASE4_PERMISSOES.gerenciarAdministradorasEmpresa
  );
}

export function papelPodeListarCatalogoGlobal(papelCodigo: string): boolean {
  return papelCodigo === "super_admin";
}
