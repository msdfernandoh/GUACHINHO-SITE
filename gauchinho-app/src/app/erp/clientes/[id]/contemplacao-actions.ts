"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
export type ContemplacaoState = { ok: boolean; message: string };
export async function marcarCotaContempladaAction(
  _state: ContemplacaoState,
  formData: FormData,
): Promise<ContemplacaoState> {
  try {
    const { empresaAtiva } = await requireErpRouteAccess("clientes");
    if (!empresaAtiva) throw new Error("Selecione uma empresa.");
    if (formData.get("confirmacao") !== "on")
      throw new Error("Confirme explicitamente a contemplação.");
    const clienteId = String(formData.get("cliente_id") ?? "");
    const cotaId = String(formData.get("cota_id") ?? "");
    const data = String(formData.get("data_contemplacao") ?? "");
    const tipo = String(formData.get("tipo_contemplacao") ?? "");
    const valor = Number(
      String(formData.get("valor_credito_contemplacao") ?? "")
        .replace(/\./g, "")
        .replace(",", "."),
    );
    const observacao = String(formData.get("observacao") ?? "").trim() || null;
    if (
      !cotaId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
      !Number.isFinite(valor) ||
      valor <= 0
    )
      throw new Error("Informe data e valor atual do crédito.");
    const supabase = await createClient();
    const { error } = await supabase.rpc("rpc_marcar_cota_contemplada", {
      p_empresa_id: empresaAtiva.id,
      p_cota_id: cotaId,
      p_data: data,
      p_tipo: tipo,
      p_valor_credito: valor,
      p_observacao: observacao,
      p_idempotency_key: `contemplacao:${cotaId}`,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/erp/clientes/${clienteId}`);
    revalidatePath("/erp/comissoes");
    return {
      ok: true,
      message:
        "Contemplação registrada. A comissão foi criada somente quando prevista na regra da venda.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a contemplação.",
    };
  }
}
