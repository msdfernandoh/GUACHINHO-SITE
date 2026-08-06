import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { FASE3_PERMISSOES } from "./constants";

export async function requireGerenciarParticipantes(empresaId: string): Promise<void> {
  if (await isPlatformSuperadmin()) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_company_permission", {
    p_empresa_id: empresaId,
    p_permission_code: FASE3_PERMISSOES.gerenciarParticipantes,
  });
  if (error || !data) {
    throw new Error("Sem permissão para gerenciar participantes.");
  }
}

export async function requireGerenciarOrganizacoes(empresaId: string): Promise<void> {
  if (await isPlatformSuperadmin()) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_company_permission", {
    p_empresa_id: empresaId,
    p_permission_code: FASE3_PERMISSOES.gerenciarOrganizacoes,
  });
  if (error || !data) {
    throw new Error("Sem permissão para gerenciar organizações parceiras.");
  }
}

export async function requireGerenciarSitesParceiros(empresaId: string): Promise<void> {
  if (await isPlatformSuperadmin()) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_company_permission", {
    p_empresa_id: empresaId,
    p_permission_code: FASE3_PERMISSOES.gerenciarSites,
  });
  if (error || !data) {
    throw new Error("Sem permissão para gerenciar sites de parceiros.");
  }
}

/** Parceiro comercial nunca deve passar neste guard. */
export async function assertNaoPodeEditarSiteComoParceiro(papelCodigo: string): Promise<void> {
  if (papelCodigo === "parceiro_comercial") {
    throw new Error("Parceiro comercial não pode editar site, domínio, DNS ou branding.");
  }
}
