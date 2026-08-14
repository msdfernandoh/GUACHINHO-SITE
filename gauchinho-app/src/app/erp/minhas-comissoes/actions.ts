"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
export async function conferirPagamentoAction(formData: FormData) {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa não selecionada.");
  const id = String(formData.get("previsao_id") ?? "");
  const db = await createClient();
  const { error } = await db.rpc("rpc_conferir_pagamento_participante", {
    p_empresa_id: empresaAtiva.id,
    p_previsao_participante_id: id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/erp/minhas-comissoes");
}
