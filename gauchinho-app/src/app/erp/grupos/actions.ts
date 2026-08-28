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
    const codigo = String(formData.get("codigo_grupo") ?? "").trim();
    const dataPrimeiraAssembleia = String(formData.get("data_primeira_assembleia") ?? "").trim();
    if (!administradoraId || !tipoId || !codigo || (!id && !dataPrimeiraAssembleia))
      return {
        status: "VALIDATION_ERROR",
        message: "Administradora, número, tipo e data da primeira assembleia são obrigatórios.",
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
    const [grant, admin, tipo] = await Promise.all([
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
    ]);
    if (!grant.data || !admin.data || !tipo.data)
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
      data_primeira_assembleia: dataPrimeiraAssembleia || null,
      percentual_parcela_reduzida:
        formData.get("modalidade_reduzida_habilitada") === "on"
          ? Number(String(formData.get("percentual_parcela_reduzida") ?? "").replace(",", ".")) || null
          : null,
      regra_integralizacao_parcela_reduzida:
        formData.get("modalidade_reduzida_habilitada") === "on"
          ? String(formData.get("regra_integralizacao_parcela_reduzida") ?? "CONTEMPLACAO")
          : null,
      assembleia_limite_parcela_reduzida:
        formData.get("regra_integralizacao_parcela_reduzida") === "ASSEMBLEIA"
          ? Number(formData.get("assembleia_limite_parcela_reduzida")) || null
          : null,
      updated_at: new Date().toISOString(),
    };
    let lances: unknown = [];
    try {
      lances = JSON.parse(String(formData.get("lances_json") ?? "[]"));
    } catch {
      return { status: "VALIDATION_ERROR", message: "Revise as modalidades de lance informadas." };
    }
    if (!Array.isArray(lances)) {
      return { status: "VALIDATION_ERROR", message: "A lista de modalidades de lance é inválida." };
    }
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
    const { data: submitted, error } = await db.rpc("rpc_submeter_alteracao_grupo_franquia", {
      p_empresa_id: empresaId,
      p_grupo_id: id,
      p_administradora_id: administradoraId,
      p_tipo_administradora_id: tipoId,
      p_codigo_grupo: codigo,
      p_payload: { ...payload, lances, ...(creditos.length ? { creditos } : {}) },
      p_chave_idempotencia: randomUUID(),
    });
    if (error) throw new Error(error.message);
    const grupoSalvoId = String((submitted as { grupo_id?: string } | null)?.grupo_id ?? id ?? "");
    revalidatePath("/erp/grupos");
    if (grupoSalvoId) revalidatePath(`/erp/grupos/${grupoSalvoId}`);
    return {
      status: "SUCCESS",
      message: id
        ? "Alteração aplicada somente nesta franquia e enviada para análise da Platform."
        : "Grupo criado localmente no ERP e enviado para homologação. A aprovação o publica para todas as franquias sem trocar seu cadastro.",
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
