"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";
import { parseBRLNumber } from "@/lib/platform/grupos-prontidao";

export type GroupActionState = {
  status: "IDLE" | "SUCCESS" | "VALIDATION_ERROR" | "CONFLICT" | "SERVER_ERROR";
  message: string;
};

export async function decidirGovernancaGrupoAction(formData: FormData) {
  if (!(await isPlatformSuperadmin()))
    throw new Error("Somente Platform Superadmin.");
  const grupoId = String(formData.get("grupo_id") ?? "");
  const decisao = String(formData.get("decisao") ?? "");
  const observacao = String(formData.get("observacao") ?? "") || null;
  const db = await createClient();
  const { error } = await db.rpc("rpc_decidir_governanca_grupo", {
    p_grupo_id: grupoId,
    p_decisao: decisao,
    p_observacao: observacao,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/platform/grupos");
  revalidatePath(`/platform/grupos/${grupoId}`);
}

export async function salvarCategoriasGrupoAction(
  _previous: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  try {
    if (!(await isPlatformSuperadmin())) return { status: "SERVER_ERROR", message: "Somente Platform Superadmin." };
    const grupoId = String(formData.get("grupo_id") ?? "").trim();
    const codigos = formData.getAll("categoria_codigo").map(String).filter(Boolean);
    if (!grupoId || codigos.length === 0) return { status: "VALIDATION_ERROR", message: "Selecione ao menos uma categoria de publicação." };
    const db = await createClient();
    const { error } = await db.rpc("rpc_platform_configurar_categorias_grupo", {
      p_grupo_id: grupoId,
      p_codigos: codigos,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/platform/grupos");
    revalidatePath(`/platform/grupos/${grupoId}`);
    revalidatePath("/admin/grupos");
    revalidatePath("/erp/grupos");
    return { status: "SUCCESS", message: "Categorias de publicação salvas com sucesso." };
  } catch (error) {
    return { status: "SERVER_ERROR", message: error instanceof Error ? error.message : "Falha ao salvar categorias." };
  }
}

export async function salvarLancesEmbutidosGrupoAction(
  _previous: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  try {
    if (!(await isPlatformSuperadmin())) return { status: "SERVER_ERROR", message: "Somente Platform Superadmin." };
    const grupoId = String(formData.get("grupo_id") ?? "").trim();
    const raw = String(formData.get("lances_json") ?? "[]");
    if (!grupoId) return { status: "VALIDATION_ERROR", message: "Grupo não identificado." };
    let lances: unknown;
    try {
      lances = JSON.parse(raw);
    } catch {
      return { status: "VALIDATION_ERROR", message: "Revise os tipos de lance informados." };
    }
    if (!Array.isArray(lances)) return { status: "VALIDATION_ERROR", message: "A lista de lances é inválida." };
    const db = await createClient();
    const { error } = await db.rpc("rpc_platform_salvar_lances_embutidos_grupo", {
      p_grupo_id: grupoId,
      p_lances: lances,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/platform/grupos/${grupoId}`);
    revalidatePath(`/admin/grupos/${grupoId}`);
    revalidatePath(`/erp/grupos/${grupoId}`);
    revalidatePath("/grupos");
    return { status: "SUCCESS", message: lances.length ? `${lances.length} tipo(s) de lance salvo(s) e publicado(s) no site.` : "Lances embutidos desativados para este grupo." };
  } catch (error) {
    return { status: "SERVER_ERROR", message: error instanceof Error ? error.message : "Falha ao salvar lances." };
  }
}

export async function decidirSolicitacaoGrupoAction(formData: FormData) {
  if (!(await isPlatformSuperadmin())) throw new Error("Somente Platform Superadmin.");
  const solicitacaoId = String(formData.get("solicitacao_id") ?? "").trim();
  const decisao = String(formData.get("decisao") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_decidir_solicitacao_grupo", {
    p_solicitacao_id: solicitacaoId,
    p_decisao: decisao,
    p_observacao: observacao,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/platform/grupos");
  revalidatePath("/platform/grupos/solicitacoes");
}

export async function salvarGrupoPlatformAction(
  _previous: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  try {
    if (!(await isPlatformSuperadmin()))
      return {
        status: "SERVER_ERROR",
        message: "Somente Platform Superadmin.",
      };

    const id = String(formData.get("id") ?? "").trim() || null;
    const administradoraId = String(formData.get("administradora_id") ?? "").trim();
    const tipoId = String(formData.get("tipo_administradora_id") ?? "").trim();
    const codigo = String(formData.get("codigo_grupo") ?? "").trim();
    const dataPrimeiraAssembleia = String(formData.get("data_primeira_assembleia") ?? "").trim() || null;

    if (!administradoraId || !tipoId || !codigo || (!id && !dataPrimeiraAssembleia)) {
      return {
        status: "VALIDATION_ERROR",
        message: "Administradora, tipo oficial, código e data da primeira assembleia são obrigatórios.",
      };
    }

    const prazoTotal = Number(formData.get("prazo_total")) || null;
    const taxaAdm = parseBRLNumber(formData.get("taxa_administrativa_percentual") as string);
    const fundoReserva = parseBRLNumber(formData.get("fundo_reserva_percentual") as string);
    const seguroPercentual = parseBRLNumber(formData.get("seguro_percentual") as string);
    const capacidadeTotal = Number(formData.get("capacidade_total")) || 0;
    const vagasDisponiveis = Number(formData.get("vagas_disponiveis")) || 0;
    const percentualParcelaReduzidaRaw = String(formData.get("percentual_parcela_reduzida") ?? "").trim();
    const percentualParcelaReduzida = percentualParcelaReduzidaRaw
      ? parseBRLNumber(percentualParcelaReduzidaRaw)
      : null;
    const regraIntegralizacao = percentualParcelaReduzida != null
      ? String(formData.get("regra_integralizacao_parcela_reduzida") ?? "CONTEMPLACAO")
      : null;
    const assembleiaLimite = regraIntegralizacao === "ASSEMBLEIA"
      ? Number(formData.get("assembleia_limite_parcela_reduzida")) || null
      : null;
    let lances: unknown = null;
    if (formData.has("lances_json")) {
      try {
        lances = JSON.parse(String(formData.get("lances_json") ?? "[]"));
      } catch {
        return { status: "VALIDATION_ERROR", message: "Revise as modalidades de lance informadas." };
      }
      if (!Array.isArray(lances)) return { status: "VALIDATION_ERROR", message: "A lista de modalidades de lance é inválida." };
    }
    const status = String(formData.get("status") ?? "Disponível").trim();
    const ativo = formData.get("ativo") !== "false";
    const observacoes = String(formData.get("observacoes") ?? "").trim() || null;

    const db = await createClient();
    const { data: saved, error } = await db.rpc("rpc_platform_salvar_grupo_comercial", {
      p_id: id,
      p_administradora_id: administradoraId,
      p_tipo_administradora_id: tipoId,
      p_codigo_grupo: codigo,
      p_status: status,
      p_ativo: ativo,
      p_prazo_total: prazoTotal,
      p_taxa_administrativa: taxaAdm,
      p_fundo_reserva: fundoReserva,
      p_seguro_percentual: seguroPercentual,
      p_capacidade_total: capacidadeTotal,
      p_vagas_disponiveis: vagasDisponiveis,
      p_observacoes: observacoes,
      p_data_primeira_assembleia: dataPrimeiraAssembleia,
      p_percentual_parcela_reduzida: percentualParcelaReduzida,
      p_regra_integralizacao: regraIntegralizacao,
      p_assembleia_limite: assembleiaLimite,
      p_lances: lances,
    });

    if (error) throw new Error(error.message);

    const savedId = (saved as { id?: string })?.id || id;
    revalidatePath("/platform/grupos");
    revalidatePath("/platform/administradoras");
    if (savedId) {
      revalidatePath(`/platform/grupos/${savedId}`);
      revalidatePath(`/platform/administradoras/${administradoraId}`);
    }

    return {
      status: "SUCCESS",
      message: id
        ? "Dados do Grupo atualizados com sucesso."
        : "Novo Grupo Global cadastrado com sucesso.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar Grupo.";
    return {
      status: /duplicate|unique|existe/i.test(message) ? "CONFLICT" : "SERVER_ERROR",
      message,
    };
  }
}

export type ReajusteCreditoPlatformInput = { id: string; valor_credito: number };

export async function reajustarCreditosGrupoPlatformAction(
  grupoId: string,
  marcoMeses: number,
  percentualReferencia: number,
  creditos: ReajusteCreditoPlatformInput[],
  observacao?: string,
): Promise<{ ok: true; atualizados: number } | { ok: false; error: string }> {
  try {
    if (!(await isPlatformSuperadmin())) {
      return { ok: false, error: "Somente Platform Superadmin pode reajustar créditos globais." };
    }
    if (!grupoId || marcoMeses < 12 || marcoMeses % 12 !== 0) {
      return { ok: false, error: "Marco anual de reajuste inválido." };
    }
    if (!creditos.length || creditos.some((item) => !item.id || !Number.isFinite(item.valor_credito) || item.valor_credito <= 0)) {
      return { ok: false, error: "Revise os valores de crédito antes de confirmar." };
    }

    const db = await createClient();
    const { data, error } = await db.rpc("rpc_platform_reajustar_creditos_grupo", {
      p_grupo_id: grupoId,
      p_marco_meses: marcoMeses,
      p_percentual_referencia: Number.isFinite(percentualReferencia) ? percentualReferencia : null,
      p_creditos: creditos,
      p_observacao: observacao?.trim() || null,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/platform/grupos");
    revalidatePath(`/platform/grupos/${grupoId}`);
    revalidatePath("/admin/grupos");
    revalidatePath("/erp/grupos");
    revalidatePath("/grupos");
    return {
      ok: true,
      atualizados: Number((data as { creditos_atualizados?: number } | null)?.creditos_atualizados ?? creditos.length),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao reajustar créditos." };
  }
}

export async function salvarEstatisticasGrupoAction(
  _previous: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  try {
    const grupoId = String(formData.get("grupo_id") ?? "").trim();
    const empresaId = String(formData.get("empresa_id") ?? "").trim() || null;
    const fonte = String(formData.get("fonte") ?? "GLOBAL").toUpperCase();

    if (!grupoId) {
      return { status: "VALIDATION_ERROR", message: "Grupo não identificado." };
    }

    let caracteristicasContemplacao = [];
    const caracteristicasRaw = String(formData.get("caracteristicas_contemplacao_json") ?? "").trim();
    if (caracteristicasRaw) {
      try {
        caracteristicasContemplacao = JSON.parse(caracteristicasRaw);
      } catch {
        caracteristicasContemplacao = [];
      }
    }

    const lanceLivreMin = parseBRLNumber(formData.get("lance_livre_minimo") as string);
    const lanceLivreMedio = parseBRLNumber(formData.get("lance_livre_medio") as string);
    const lanceLivreMax = parseBRLNumber(formData.get("lance_livre_maximo") as string);
    const dataReferencia = String(formData.get("data_referencia") ?? "").trim() || null;
    const contempladosMesAnterior = Number(formData.get("contemplados_mes_anterior_qtd")) || null;
    const limiteLanceEmbutido = parseBRLNumber(formData.get("limite_lance_embutido_percentual") as string);
    const lanceEmbutidoPermitido = formData.get("lance_embutido_permitido") === "on";
    const lanceFidelidadePermitido = formData.get("lance_fidelidade_permitido") === "on";
    const origemInfo = String(formData.get("origem_informacao") ?? "").trim() || null;
    const responsavel = String(formData.get("responsavel_nome") ?? "").trim() || null;
    const observacao = String(formData.get("observacao") ?? "").trim() || null;
    const vagasDisponiveis = Number(formData.get("vagas_disponiveis")) || 0;
    const usarDadosGlobais = formData.get("usar_dados_globais") !== "false";

    const dadosEstatisticos = {
      caracteristicas_contemplacao: caracteristicasContemplacao,
      lance_livre_minimo: lanceLivreMin,
      lance_livre_medio: lanceLivreMedio,
      lance_livre_maximo: lanceLivreMax,
      data_referencia: dataReferencia,
      contemplados_mes_anterior_qtd: contempladosMesAnterior,
      limite_lance_embutido_percentual: limiteLanceEmbutido,
      lance_embutido_permitido: lanceEmbutidoPermitido,
      lance_fidelidade_permitido: lanceFidelidadePermitido,
      origem_informacao: origemInfo,
      responsavel_nome: responsavel,
      observacao,
    };

    const db = await createClient();
    const { error } = await db.rpc("rpc_platform_salvar_estatisticas_grupo", {
      p_grupo_id: grupoId,
      p_empresa_id: empresaId,
      p_fonte: fonte,
      p_dados_estatisticos: dadosEstatisticos,
      p_vagas_disponiveis: vagasDisponiveis,
      p_usar_dados_globais: usarDadosGlobais,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/platform/grupos");
    revalidatePath(`/platform/grupos/${grupoId}`);

    return {
      status: "SUCCESS",
      message: "Dados estatísticos e lances informativos atualizados com sucesso.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar estatísticas.";
    return { status: "SERVER_ERROR", message };
  }
}

export const salvarGrupoGlobalAction = salvarGrupoPlatformAction;
