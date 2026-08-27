"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import type { GroupActionState } from "@/app/platform/grupos-actions";
import { randomUUID } from "node:crypto";
import { parseBatchCotasInput } from "@/lib/platform/grupos-prontidao";

export async function salvarGrupoLocalAction(
  _previous: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  try {
    const { empresaAtiva } = await requireErpRouteAccess("grupos");
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
    if (id) {
      const { error: configError } = await db.rpc("rpc_configurar_grupo_franquia", {
        p_empresa_id: empresaId,
        p_grupo_id: id,
        p_visivel: true,
        p_destaque: false,
        p_ordem: null,
        p_titulo_comercial: "",
        p_descricao_comercial: "",
        p_integral: formData.get("modalidade_integral_habilitada") === "on",
        p_reduzida: formData.get("modalidade_reduzida_habilitada") === "on",
        p_personalizada: formData.get("modalidade_personalizada_habilitada") === "on",
        p_status_vagas: String(formData.get("status_vagas_local") ?? "HERDAR"),
      });
      if (configError) throw new Error(configError.message);
    }
    const creditos = parseBatchCotasInput(String(formData.get("creditos") ?? ""));
    const { error } = await db.rpc("rpc_submeter_alteracao_grupo_franquia", {
      p_empresa_id: empresaId,
      p_grupo_id: id,
      p_administradora_id: administradoraId,
      p_tipo_administradora_id: tipoId,
      p_codigo_grupo: codigo,
      p_payload: { ...payload, ...(creditos.length ? { creditos } : {}) },
      p_chave_idempotencia: randomUUID(),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/grupos");
    if (id) revalidatePath(`/erp/grupos/${id}`);
    return {
      status: "SUCCESS",
      message: id
        ? "Alteração aplicada somente nesta franquia e enviada para análise da Platform."
        : "Novo grupo enviado para homologação. Ele não será publicado antes da aprovação.",
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
