import "server-only";

import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { assertCallerCanAccessEmpresa, requireGerenciarCatalogoAdministradoras } from "./authorization";
import { throwAdministradoraNotFound } from "./errors";
import {
  concessaoPermiteUso,
  filterAdministradorasAutorizadasForEmpresa,
  normalizeAdministradoraSlug,
  toAdministradoraAutorizada,
} from "./rules";
import {
  fetchAdministradorasGlobais,
  fetchConcessaoEmpresaAdministradora,
  fetchConcessoesComAdministradoraByEmpresa,
} from "./repository";
import type { Administradora, AdministradoraAutorizada } from "./types";

export type AdministradorasServiceDeps = {
  isPlatformSuperadmin: () => Promise<boolean>;
  requireGerenciarCatalogoAdministradoras: () => Promise<void>;
  assertCallerCanAccessEmpresa: (empresaId: string) => Promise<void>;
  fetchAdministradorasGlobais: () => Promise<Administradora[]>;
  fetchConcessoesComAdministradoraByEmpresa: typeof fetchConcessoesComAdministradoraByEmpresa;
  fetchConcessaoEmpresaAdministradora: typeof fetchConcessaoEmpresaAdministradora;
};

const defaultDeps: AdministradorasServiceDeps = {
  isPlatformSuperadmin,
  requireGerenciarCatalogoAdministradoras,
  assertCallerCanAccessEmpresa,
  fetchAdministradorasGlobais,
  fetchConcessoesComAdministradoraByEmpresa,
  fetchConcessaoEmpresaAdministradora,
};

/**
 * Catálogo GLOBAL — somente PLATFORM_SUPERADMIN.
 * admin_empresa / consultor / parceiro: negado.
 */
export async function listAdministradorasGlobaisForSuperadmin(
  deps: AdministradorasServiceDeps = defaultDeps,
): Promise<Administradora[]> {
  await deps.requireGerenciarCatalogoAdministradoras();
  return deps.fetchAdministradorasGlobais();
}

/**
 * Administradoras autorizadas da EMPRESA/FRANQUEADA.
 * Exige: global ATIVA + vínculo ATIVA + empresa_id da sessão validada.
 */
export async function listAdministradorasAutorizadasForEmpresa(
  empresaId: string,
  deps: AdministradorasServiceDeps = defaultDeps,
): Promise<AdministradoraAutorizada[]> {
  await deps.assertCallerCanAccessEmpresa(empresaId);
  const rows = await deps.fetchConcessoesComAdministradoraByEmpresa(empresaId);
  return filterAdministradorasAutorizadasForEmpresa(empresaId, rows);
}

export async function getAdministradoraAutorizadaById(
  empresaId: string,
  administradoraId: string,
  deps: AdministradorasServiceDeps = defaultDeps,
): Promise<AdministradoraAutorizada> {
  await deps.assertCallerCanAccessEmpresa(empresaId);
  const { concessao, administradora } = await deps.fetchConcessaoEmpresaAdministradora(
    empresaId,
    administradoraId,
  );
  if (!concessao || !administradora) {
    throwAdministradoraNotFound();
  }
  if (!concessaoPermiteUso(administradora.status, concessao.status)) {
    throwAdministradoraNotFound();
  }
  if (concessao.empresa_id !== empresaId || administradora.id !== administradoraId) {
    throwAdministradoraNotFound();
  }
  return toAdministradoraAutorizada(administradora, concessao);
}

export async function getAdministradoraAutorizadaBySlug(
  empresaId: string,
  slug: string,
  deps: AdministradorasServiceDeps = defaultDeps,
): Promise<AdministradoraAutorizada> {
  await deps.assertCallerCanAccessEmpresa(empresaId);
  const normalized = normalizeAdministradoraSlug(slug);
  if (!normalized) {
    throwAdministradoraNotFound();
  }

  const rows = await deps.fetchConcessoesComAdministradoraByEmpresa(empresaId);
  const match = rows.find(
    (r) =>
      r.concessao.empresa_id === empresaId &&
      r.administradora != null &&
      normalizeAdministradoraSlug(r.administradora.slug) === normalized,
  );

  if (!match?.administradora) {
    throwAdministradoraNotFound();
  }
  if (!concessaoPermiteUso(match.administradora.status, match.concessao.status)) {
    throwAdministradoraNotFound();
  }
  return toAdministradoraAutorizada(match.administradora, match.concessao);
}

export async function assertEmpresaPodeUsarAdministradora(
  empresaId: string,
  administradoraId: string,
  deps: AdministradorasServiceDeps = defaultDeps,
): Promise<AdministradoraAutorizada> {
  return getAdministradoraAutorizadaById(empresaId, administradoraId, deps);
}

/**
 * Verifica status GLOBAL da administradora (sem contexto de empresa).
 * Somente Superadmin — não é API de tenant.
 */
export async function assertAdministradoraGlobalAtiva(
  administradoraId: string,
  deps: AdministradorasServiceDeps = defaultDeps,
): Promise<Administradora> {
  await deps.requireGerenciarCatalogoAdministradoras();
  const all = await deps.fetchAdministradorasGlobais();
  const found = all.find((a) => a.id === administradoraId);
  if (!found || found.status !== "ATIVA") {
    throwAdministradoraNotFound();
  }
  return found;
}
