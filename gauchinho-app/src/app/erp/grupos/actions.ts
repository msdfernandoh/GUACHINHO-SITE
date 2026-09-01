"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import type { GroupActionState } from "@/app/platform/grupos-actions";
import { parseBatchCotasInput } from "@/lib/platform/grupos-prontidao";
import { uploadTabelaGrupo } from "@/lib/grupos/grupo-tabela.server";
import { grupoCreateIdempotencyKey, normalizeGrupoCodigo } from "@/lib/grupos/grupo-local-create";

function parsePercentuaisReduzidos(formData: FormData): number[] {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("percentuais_parcela_reduzida_json") ?? "[]"));
  } catch {
    throw new Error("Revise as opções fixas da parcela reduzida.");
  }
  if (!Array.isArray(raw)) throw new Error("A lista de parcelas reduzidas é inválida.");
  const valores = [...new Set(raw.map((item) => Number(String(item).replace(",", "."))))];
  if (valores.some((valor) => !Number.isFinite(valor) || valor <= 0 || valor >= 100)) {
    throw new Error("Cada parcela reduzida deve possuir percentual maior que 0 e menor que 100.");
  }
  return valores;
}

function parseCreditos(formData: FormData): number[] {
  const json = formData.get("creditos_json");
  if (json != null) {
    try {
      const valores = JSON.parse(String(json));
      if (!Array.isArray(valores)) throw new Error();
      return parseBatchCotasInput(valores.map(String).join("\n"));
    } catch {
      throw new Error("Revise os créditos informados.");
    }
  }
  return parseBatchCotasInput(String(formData.get("creditos") ?? ""));
}

function parseReajusteAnual(formData: FormData) {
  const tipo = String(formData.get("tipo_reajuste_anual") ?? "").trim().toUpperCase();
  const percentual = Number(String(formData.get("reajuste_anual_percentual") ?? "").replace(",", "."));
  const indice = String(formData.get("reajuste_anual_indice") ?? "").trim();
  if (!(["FIXO", "VARIAVEL"] as string[]).includes(tipo)) throw new Error("Informe se o reajuste anual é fixo ou variável.");
  if (tipo === "FIXO" && (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100)) throw new Error("Informe o percentual anual fixo entre 0 e 100.");
  if (tipo === "VARIAVEL" && !indice) throw new Error("Informe o nome do índice ou alíquota do reajuste variável.");
  return { tipo, percentual: tipo === "FIXO" ? percentual : null, indice: tipo === "VARIAVEL" ? indice : null };
}

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
    const codigo = normalizeGrupoCodigo(String(formData.get("codigo_grupo") ?? ""));
    const dataPrimeiraAssembleia = String(formData.get("data_primeira_assembleia") ?? "").trim();
    if (!administradoraId || !tipoId || !codigo || (!id && !dataPrimeiraAssembleia))
      return {
        status: "VALIDATION_ERROR",
        message: "Administradora, número, tipo e data da primeira assembleia são obrigatórios.",
      };
    const db = await createClient();
    const reajusteAnual = parseReajusteAnual(formData);
    const percentuaisReduzidos = formData.get("modalidade_reduzida_habilitada") === "on"
      ? parsePercentuaisReduzidos(formData)
      : [];
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
    if (!id) {
      const { data: existente, error: existingError } = await db.from("grupos_consorcio")
        .select("id,codigo_grupo,origem_governanca,empresa_origem_id")
        .eq("administradora_id", administradoraId)
        .ilike("codigo_grupo", codigo)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (existente) return {
        status: "CONFLICT",
        message: `O grupo ${existente.codigo_grupo} já foi cadastrado. Abra o cadastro existente para continuar, sem criar outra cópia.`,
        redirectTo: `/erp/grupos/${existente.id}`,
      };
    }
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
      fundo_reserva_percentual:
        Number(String(formData.get("fundo_reserva_percentual") ?? "0").replace(",", ".")) || 0,
      seguro_habilitado: true,
      seguro_percentual:
        Number(String(formData.get("seguro_percentual") ?? "0,0004").replace(",", ".")) || 0.0004,
      data_primeira_assembleia: dataPrimeiraAssembleia || null,
      percentual_parcela_reduzida:
        percentuaisReduzidos[0] ?? null,
      percentuais_parcela_reduzida: percentuaisReduzidos.length ? percentuaisReduzidos : null,
      regra_integralizacao_parcela_reduzida:
        formData.get("modalidade_reduzida_habilitada") === "on"
          ? String(formData.get("regra_integralizacao_parcela_reduzida") ?? "CONTEMPLACAO")
          : null,
      assembleia_limite_parcela_reduzida:
        formData.get("regra_integralizacao_parcela_reduzida") === "ASSEMBLEIA"
          ? Number(formData.get("assembleia_limite_parcela_reduzida")) || null
          : null,
      observacoes: String(formData.get("observacoes") ?? "").trim() || null,
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
    const creditos = parseCreditos(formData);
    const { data: submitted, error } = await db.rpc("rpc_submeter_alteracao_grupo_franquia", {
      p_empresa_id: empresaId,
      p_grupo_id: id,
      p_administradora_id: administradoraId,
      p_tipo_administradora_id: tipoId,
      p_codigo_grupo: codigo,
      p_payload: { ...payload, lances, ...(creditos.length ? { creditos } : {}) },
      p_chave_idempotencia: grupoCreateIdempotencyKey({ empresaId, administradoraId, tipoId, codigo }),
    });
    if (error) throw new Error(error.message);
    const resultadoSubmissao = submitted as { id?: string; grupo_id?: string } | null;
    const grupoSalvoId = String(resultadoSubmissao?.grupo_id ?? id ?? "");
    if (grupoSalvoId) {
      const { error: reajusteError } = await db.rpc("rpc_salvar_reajuste_anual_grupo", {
        p_grupo_id: grupoSalvoId,
        p_tipo: reajusteAnual.tipo,
        p_percentual: reajusteAnual.percentual,
        p_indice: reajusteAnual.indice,
        p_empresa_id: empresaId,
        p_solicitacao_id: resultadoSubmissao?.id ?? null,
      });
      if (reajusteError) throw new Error(reajusteError.message);
      const { data: grupoSalvo } = await db
        .from("grupos_consorcio")
        .select("origem_governanca,empresa_origem_id")
        .eq("id", grupoSalvoId)
        .maybeSingle();
      if (grupoSalvo?.origem_governanca === "LOCAL" && grupoSalvo.empresa_origem_id === empresaId) {
        for (const credito of creditos) {
          const { error: creditoError } = await db.rpc("rpc_salvar_credito_grupo", {
            p_grupo_id: grupoSalvoId,
            p_grupo_cota_id: null,
            p_valor_credito: credito,
          });
          if (creditoError) throw new Error(creditoError.message);
        }
      }
      const { error: percentuaisError } = await db.rpc("rpc_salvar_percentuais_parcela_reduzida_grupo", {
        p_grupo_id: grupoSalvoId,
        p_percentuais: percentuaisReduzidos.length ? percentuaisReduzidos : null,
      });
      if (percentuaisError) throw new Error(percentuaisError.message);
      const tabelaArquivo = formData.get("tabela_arquivo");
      if (tabelaArquivo instanceof File && tabelaArquivo.size > 0) {
        await uploadTabelaGrupo(grupoSalvoId, "ERP", tabelaArquivo);
      }
    }
    revalidatePath("/erp/grupos");
    if (grupoSalvoId) revalidatePath(`/erp/grupos/${grupoSalvoId}`);
    revalidatePath("/grupos");
    return {
      status: "SUCCESS",
      message: id
        ? "Alteração aplicada somente nesta franquia e enviada para análise da Platform."
        : "Grupo criado localmente no ERP e enviado para homologação. A aprovação o publica para todas as franquias sem trocar seu cadastro.",
      redirectTo: formData.get("acao_pos_salvar") === "VOLTAR"
        ? `/erp/grupos?criado=${encodeURIComponent(grupoSalvoId)}`
        : `/erp/grupos/${grupoSalvoId}`,
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

export async function salvarCreditoGrupoLocalAction(formData: FormData) {
  await requireErpRouteAccess("grupos");
  const grupoId = String(formData.get("grupo_id") ?? "");
  const cotaId = String(formData.get("cota_id") ?? "") || null;
  const valor = parseBatchCotasInput(String(formData.get("valor_credito") ?? ""))[0];
  if (!grupoId || !valor) throw new Error("Informe um crédito válido.");
  const db = await createClient();
  const { error } = await db.rpc("rpc_salvar_credito_grupo", {
    p_grupo_id: grupoId,
    p_grupo_cota_id: cotaId,
    p_valor_credito: valor,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/erp/grupos/${grupoId}`);
  revalidatePath("/erp/grupos");
  revalidatePath("/grupos");
}

export async function excluirCreditoGrupoLocalAction(formData: FormData) {
  await requireErpRouteAccess("grupos");
  const grupoId = String(formData.get("grupo_id") ?? "");
  const cotaId = String(formData.get("cota_id") ?? "");
  if (!grupoId || !cotaId) throw new Error("Crédito não identificado.");
  const db = await createClient();
  const { error } = await db.rpc("rpc_excluir_credito_grupo", { p_grupo_cota_id: cotaId });
  if (error) throw new Error(error.message);
  revalidatePath(`/erp/grupos/${grupoId}`);
  revalidatePath("/erp/grupos");
  revalidatePath("/grupos");
}
