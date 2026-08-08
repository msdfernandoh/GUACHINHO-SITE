import "server-only";

import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";
import { getUserCompanies } from "@/lib/tenant/context";
import { FASE4_PERMISSOES } from "./constants";

async function requireCompanyPermission(empresaId: string, code: string, message: string) {
  if (await isPlatformSuperadmin()) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_company_permission", {
    p_empresa_id: empresaId,
    p_permission_code: code,
  });
  if (error || !data) {
    throw new Error(message);
  }
}

/** Catálogo GLOBAL — somente PLATFORM_SUPERADMIN. */
export async function requireGerenciarCatalogoAdministradoras(): Promise<void> {
  if (!(await isPlatformSuperadmin())) {
    throw new Error("Sem permissão para gerenciar o catálogo global de administradoras.");
  }
}

/** Concessões empresa × administradora — somente PLATFORM_SUPERADMIN. */
export async function requireGerenciarAdministradorasEmpresa(): Promise<void> {
  if (!(await isPlatformSuperadmin())) {
    throw new Error("Sem permissão para gerenciar concessões de administradoras.");
  }
}

/**
 * Capability explícita (RPC) — seed 047 só dá a super_admin.
 * Útil quando o caller já está no contexto de uma empresa.
 */
export async function requirePermissaoCatalogoAdministradoras(empresaId: string): Promise<void> {
  await requireCompanyPermission(
    empresaId,
    FASE4_PERMISSOES.gerenciarCatalogoAdministradoras,
    "Sem permissão para gerenciar o catálogo global de administradoras.",
  );
}

export async function requirePermissaoAdministradorasEmpresa(empresaId: string): Promise<void> {
  await requireCompanyPermission(
    empresaId,
    FASE4_PERMISSOES.gerenciarAdministradorasEmpresa,
    "Sem permissão para gerenciar concessões de administradoras.",
  );
}

/**
 * Valida que o caller pode consultar concessões da empresa informada.
 * Superadmin: qualquer empresa. Demais: vínculo ativo na sessão (nunca confiar só no ID do cliente).
 */
export async function assertCallerCanAccessEmpresa(empresaId: string): Promise<void> {
  if (!empresaId || typeof empresaId !== "string") {
    throw new Error("Empresa inválida.");
  }
  if (await isPlatformSuperadmin()) return;

  const usuario = await getUsuarioNegocio();
  if (!usuario) {
    throw new Error("Não autenticado.");
  }

  const vinculos = await getUserCompanies(usuario.id);
  const ok = vinculos.some((v) => v.empresa_id === empresaId && v.ativo);
  if (!ok) {
    throw new Error("Sem acesso à empresa informada.");
  }
}

export async function hasGerenciarCatalogoAdministradoras(): Promise<boolean> {
  return isPlatformSuperadmin();
}

export async function hasGerenciarAdministradorasEmpresa(): Promise<boolean> {
  return isPlatformSuperadmin();
}
