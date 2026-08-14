"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { parseBrazilianNumber } from "@/lib/utils/format";

export type CaixaActionResult = { ok: boolean; message: string };

export async function registrarMovimentoManual(formData: FormData): Promise<CaixaActionResult> {
  try {
    const { empresaAtiva, usuario } = await getCurrentTenantContext();
    if (!empresaAtiva || !usuario) return { ok: false, message: "Empresa ou usuário não identificado." };
    const tipo = String(formData.get("tipo") ?? "");
    const valor = parseBrazilianNumber(String(formData.get("valor") ?? ""));
    const data = String(formData.get("data") ?? "");
    const descricao = String(formData.get("descricao") ?? "").trim();
    if (!['entrada', 'saida'].includes(tipo) || valor <= 0 || !data || !descricao) {
      return { ok: false, message: "Preencha tipo, valor, data e descrição corretamente." };
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("rpc_registrar_ajuste_caixa", {
      p_empresa_id: empresaAtiva.id,
      p_tipo_movimento: tipo,
      p_valor: valor,
      p_data_movimento: data,
      p_descricao: descricao,
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/financeiro");
    revalidatePath("/erp/financeiro");
    return { ok: true, message: `${tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada no caixa.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível registrar a movimentação." };
  }
}
