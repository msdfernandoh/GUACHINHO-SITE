import "server-only";

import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_ACTIONS_ADMINISTRADORAS } from "./constants";

export type AdministradorasAuditAction =
  (typeof AUDIT_ACTIONS_ADMINISTRADORAS)[keyof typeof AUDIT_ACTIONS_ADMINISTRADORAS];

/**
 * Prepara escritas futuras (E3/E4) em `audit_logs` existente.
 * Não cria sistema paralelo. Mutações ainda não são implementadas nesta E2.
 */
export async function writeAdministradorasAuditLog(input: {
  action: AdministradorasAuditAction | string;
  /** empresa_id do tenant afetado (concessão) ou null para eventos puramente globais */
  companyId?: string | null;
  details: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const usuario = await getUsuarioNegocio();

  const { error } = await supabase.from("audit_logs").insert({
    user_id: usuario?.id ?? null,
    company_id: input.companyId ?? null,
    action: input.action,
    details: {
      domain: "administradoras",
      ...input.details,
    },
    ip_address: input.ipAddress ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export { AUDIT_ACTIONS_ADMINISTRADORAS };
