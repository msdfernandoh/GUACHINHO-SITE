import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Usa a mesma autorização da RPC de alteração, inclusive para Superadmin. */
export async function getContasPagarPermissoes(empresaId: string) {
  const session = await createClient();
  const [master, estorno] = await Promise.all([
    session.rpc("is_financeiro_tenant_master", { p_empresa_id: empresaId }),
    session.rpc("pode_estornar_conta_pagar", { p_empresa_id: empresaId }),
  ]);
  if (master.error || estorno.error) {
    throw new Error("Não foi possível verificar as permissões de Contas a Pagar.");
  }
  return {
    master: master.data === true,
    podeEstornar: master.data === true || estorno.data === true,
  };
}
