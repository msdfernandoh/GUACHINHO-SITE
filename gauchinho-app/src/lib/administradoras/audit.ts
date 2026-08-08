import "server-only";

import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_ACTIONS_ADMINISTRADORAS } from "./constants";

export type AdministradorasAuditAction =
  (typeof AUDIT_ACTIONS_ADMINISTRADORAS)[keyof typeof AUDIT_ACTIONS_ADMINISTRADORAS];

/**
 * Escreve em `audit_logs` existente.
 * Com `privileged: true` (somente após assert Superadmin), usa service role
 * para não falhar silenciosamente se RLS de audit_logs bloquear o papel.
 */
export async function writeAdministradorasAuditLog(input: {
  action: AdministradorasAuditAction | string;
  companyId?: string | null;
  details: Record<string, unknown>;
  ipAddress?: string | null;
  privileged?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const usuario = await getUsuarioNegocio();
  const payload = {
    user_id: usuario?.id ?? null,
    company_id: input.companyId ?? null,
    action: input.action,
    details: {
      domain: "administradoras",
      ...input.details,
    },
    ip_address: input.ipAddress ?? null,
  };

  if (input.privileged) {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert(payload);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("audit_logs").insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export { AUDIT_ACTIONS_ADMINISTRADORAS };
