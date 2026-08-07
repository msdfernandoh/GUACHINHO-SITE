import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { FASE3_PERMISSOES } from "./constants";

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

export async function requireGerenciarParticipantes(empresaId: string): Promise<void> {
  await requireCompanyPermission(
    empresaId,
    FASE3_PERMISSOES.gerenciarParticipantes,
    "Sem permissão para gerenciar participantes."
  );
}

export async function requireGerenciarOrganizacoes(empresaId: string): Promise<void> {
  await requireCompanyPermission(
    empresaId,
    FASE3_PERMISSOES.gerenciarOrganizacoes,
    "Sem permissão para gerenciar organizações parceiras."
  );
}

export async function requireGerenciarSitesParceiros(empresaId: string): Promise<void> {
  await requireCompanyPermission(
    empresaId,
    FASE3_PERMISSOES.gerenciarSites,
    "Sem permissão para gerenciar sites de parceiros."
  );
}

export async function requireAcessarAreaParceiro(empresaId: string): Promise<void> {
  await requireCompanyPermission(
    empresaId,
    FASE3_PERMISSOES.acessarAreaParceiro,
    "Sem permissão para acessar a área do parceiro."
  );
}

export async function requirePermissaoAreaParceiro(
  empresaId: string,
  code: string,
  message = "Sem permissão na área do parceiro."
): Promise<void> {
  await requireCompanyPermission(empresaId, code, message);
}

export async function hasPermissaoAreaParceiro(empresaId: string, code: string): Promise<boolean> {
  if (await isPlatformSuperadmin()) return true;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_company_permission", {
    p_empresa_id: empresaId,
    p_permission_code: code,
  });
  return Boolean(!error && data);
}

/** Parceiro comercial nunca deve passar neste guard. */
export async function assertNaoPodeEditarSiteComoParceiro(papelCodigo: string): Promise<void> {
  if (papelCodigo === "parceiro_comercial") {
    throw new Error("Parceiro comercial não pode editar site, domínio, DNS ou branding.");
  }
}
