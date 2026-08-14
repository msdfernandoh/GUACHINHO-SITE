"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
export type BidState = { ok: boolean; message: string };
export async function salvarEstrategiaLanceAction(
  _previous: BidState,
  formData: FormData,
): Promise<BidState> {
  try {
    const { empresaAtiva } = await getCurrentTenantContext();
    if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");
    const numeric = (name: string) =>
      String(formData.get(name) ?? "").replace(",", ".");
    const dados = {
      lance_fixo_ativo: formData.get("lance_fixo_ativo") === "on",
      lance_fixo_percentual: numeric("lance_fixo_percentual"),
      lance_fixo_valor: numeric("lance_fixo_valor"),
      lance_fixo_inicio: String(formData.get("lance_fixo_inicio") ?? ""),
      lance_fixo_fim: String(formData.get("lance_fixo_fim") ?? ""),
      lance_livre_ativo: formData.get("lance_livre_ativo") === "on",
      lance_livre_valor: numeric("lance_livre_valor"),
      lance_livre_inicio: String(formData.get("lance_livre_inicio") ?? ""),
      lance_livre_fim: String(formData.get("lance_livre_fim") ?? ""),
      recurso_proprio_valor: numeric("recurso_proprio_valor"),
      lance_embutido_percentual: numeric("lance_embutido_percentual"),
      parcela_reduzida_ativa: formData.get("parcela_reduzida_ativa") === "on",
      observacoes: String(formData.get("observacoes") ?? ""),
      ativa: formData.get("ativa") !== "false",
    };
    const db = await createClient();
    const { error } = await db.rpc("rpc_salvar_estrategia_lance", {
      p_empresa_id: empresaAtiva.id,
      p_cota_id: String(formData.get("cota_id") ?? ""),
      p_dados: dados,
      p_motivo: String(formData.get("motivo") ?? "") || null,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/lances");
    return { ok: true, message: "Estratégia salva; histórico preservado." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Erro ao salvar estratégia.",
    };
  }
}
