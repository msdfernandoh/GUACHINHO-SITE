"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import type { GroupActionState } from "@/app/platform/grupos-actions";

export async function salvarGrupoLocalAction(
  _previous: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  try {
    const { empresaAtiva } = await getCurrentTenantContext();
    const empresaId = empresaAtiva?.id;
    if (!empresaId)
      return {
        status: "SERVER_ERROR",
        message: "Empresa ativa não encontrada.",
      };
    const id = String(formData.get("id") ?? "") || null;
    const administradoraId = String(formData.get("administradora_id") ?? "");
    const tipoId = String(formData.get("tipo_administradora_id") ?? "");
    const modalidadeId = String(formData.get("modalidade_comissao_id") ?? "");
    const codigo = String(formData.get("codigo_grupo") ?? "").trim();
    if (!administradoraId || !tipoId || !modalidadeId || !codigo)
      return {
        status: "VALIDATION_ERROR",
        message: "Administradora, número, Tipo e Modalidade são obrigatórios.",
      };
    const db = await createClient();
    const { data: canWrite } = await db.rpc("can_write_tenant_internal", {
      p_empresa_id: empresaId,
    });
    if (!canWrite)
      return {
        status: "SERVER_ERROR",
        message: "Sem permissão para editar Grupos desta empresa.",
      };
    const [grant, admin, tipo, modalidade] = await Promise.all([
      db
        .from("empresa_administradoras")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("administradora_id", administradoraId)
        .eq("status", "ATIVA")
        .maybeSingle(),
      db
        .from("administradoras")
        .select("nome")
        .eq("id", administradoraId)
        .maybeSingle(),
      db
        .from("administradora_tipos")
        .select("nome")
        .eq("id", tipoId)
        .eq("administradora_id", administradoraId)
        .eq("ativo", true)
        .maybeSingle(),
      db
        .from("administradora_modalidades_comissao")
        .select("nome")
        .eq("id", modalidadeId)
        .eq("administradora_id", administradoraId)
        .eq("ativo", true)
        .maybeSingle(),
    ]);
    if (!grant.data || !admin.data || !tipo.data || !modalidade.data)
      return {
        status: "VALIDATION_ERROR",
        message:
          "Selecione itens ativos do catálogo oficial concedido à empresa.",
      };
    const payload = {
      codigo_grupo: codigo,
      administradora_id: administradoraId,
      administradora: admin.data.nome,
      modalidade: tipo.data.nome,
      tipo_administradora_id: tipoId,
      modalidade_comissao_id: modalidadeId,
      status: String(formData.get("status") ?? "Disponível"),
      ativo: formData.get("ativo") !== "false",
      prazo_total: Number(formData.get("prazo_total")) || null,
      taxa_administrativa_percentual:
        Number(
          String(formData.get("taxa_administrativa_percentual") ?? "").replace(
            ",",
            ".",
          ),
        ) || null,
      permite_lance_embutido: formData.get("permite_lance_embutido") === "on",
      percentual_lance_embutido:
        Number(
          String(formData.get("percentual_lance_embutido") ?? "").replace(
            ",",
            ".",
          ),
        ) || null,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (id) {
      const result = await db
        .from("grupos_consorcio")
        .update(payload)
        .eq("id", id)
        .eq("origem_governanca", "LOCAL")
        .eq("empresa_origem_id", empresaId);
      error = result.error;
    } else {
      const result = await db.from("grupos_consorcio").insert({
        ...payload,
        origem_governanca: "LOCAL",
        status_governanca: "PENDENTE_PLATFORM",
        empresa_origem_id: empresaId,
      });
      error = result.error;
    }
    if (error) throw new Error(error.message);
    revalidatePath("/erp/grupos");
    if (id) revalidatePath(`/erp/grupos/${id}`);
    return {
      status: "SUCCESS",
      message: id
        ? "Grupo local atualizado."
        : "Grupo local criado e enviado à fila da Platform.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao salvar Grupo.";
    return {
      status: /duplicate|unique|existe/i.test(message)
        ? "CONFLICT"
        : "SERVER_ERROR",
      message,
    };
  }
}
