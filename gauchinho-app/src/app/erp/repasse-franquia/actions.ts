"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
export type ReceiptState = { ok: boolean; message: string; receiptId?: string };
async function context() {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");
  const db = await createClient();
  const { data } = await db.rpc("can_write_tenant_internal", {
    p_empresa_id: empresaAtiva.id,
  });
  if (!data) throw new Error("Sem permissão financeira no tenant.");
  return { db, empresaId: empresaAtiva.id };
}
export async function registrarRecebimentoManualAction(
  _previous: ReceiptState,
  formData: FormData,
): Promise<ReceiptState> {
  try {
    const { db, empresaId } = await context();
    const { data, error } = await db.rpc("rpc_registrar_recebimento_manual", {
      p_empresa_id: empresaId,
      p_administradora_id: String(formData.get("administradora_id") ?? ""),
      p_competencia: String(formData.get("competencia") ?? ""),
      p_valor_total: Number(
        String(formData.get("valor_total") ?? "").replace(",", "."),
      ),
      p_data_recebimento: String(formData.get("data_recebimento") ?? ""),
      p_conta_entrada: String(formData.get("conta_entrada") ?? ""),
      p_idempotency_key: String(formData.get("idempotency_key") ?? ""),
      p_conta_bancaria_id:
        String(formData.get("conta_bancaria_id") ?? "") || null,
      p_numero_nota_fiscal:
        String(formData.get("numero_nota_fiscal") ?? "") || null,
      p_data_nota_fiscal:
        String(formData.get("data_nota_fiscal") ?? "") || null,
      p_descricao: String(formData.get("descricao") ?? "") || null,
      p_observacoes: String(formData.get("observacoes") ?? "") || null,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/repasse-franquia");
    const result = data as { recebimento?: { id?: string }; reused?: boolean };
    return {
      ok: true,
      message: result.reused
        ? "Recebimento já registrado; nenhuma entrada de Caixa foi duplicada."
        : "Recebimento real registrado. Agora classifique ou concilie o saldo.",
      receiptId: result.recebimento?.id,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Erro ao registrar recebimento.",
    };
  }
}
export async function conciliarRecebimentoManualAction(
  _previous: ReceiptState,
  formData: FormData,
): Promise<ReceiptState> {
  try {
    const { db, empresaId } = await context();
    let itens: unknown;
    let classificacoes: unknown;
    try {
      itens = JSON.parse(String(formData.get("itens") ?? "[]"));
      classificacoes = JSON.parse(
        String(formData.get("classificacoes") ?? "[]"),
      );
    } catch {
      throw new Error("Composição inválida.");
    }
    const id = String(formData.get("recebimento_id") ?? "");
    const { data, error } = await db.rpc("rpc_conciliar_recebimento_manual", {
      p_empresa_id: empresaId,
      p_recebimento_id: id,
      p_itens: itens,
      p_classificacoes: classificacoes,
      p_idempotency_key: String(formData.get("idempotency_key") ?? ""),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/repasse-franquia");
    const result = data as {
      status?: string;
      saldo?: number;
      reused?: boolean;
    };
    return {
      ok: true,
      message: result.reused
        ? "Conciliação já processada sem duplicidade."
        : `Conciliação salva: ${result.status}. Saldo R$ ${Number(result.saldo ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
      receiptId: id,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Erro ao conciliar recebimento.",
    };
  }
}
