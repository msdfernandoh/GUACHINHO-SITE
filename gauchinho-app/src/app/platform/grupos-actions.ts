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

export async function salvarCategoriasGrupoAction(formData: FormData) {
  if (!(await isPlatformSuperadmin())) throw new Error("Somente Platform Superadmin.");
  const grupoId = String(formData.get("grupo_id") ?? "").trim();
  const codigos = formData.getAll("categoria_codigo").map(String).filter(Boolean);
  if (!grupoId || codigos.length === 0) throw new Error("Selecione ao menos uma categoria de publicação.");
  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_configurar_categorias_grupo", {
    p_grupo_id: grupoId,
    p_codigos: codigos,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/platform/grupos");
  revalidatePath(`/platform/grupos/${grupoId}`);
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

    if (!administradoraId || !tipoId || !codigo) {
      return {
        status: "VALIDATION_ERROR",
        message: "Administradora, Tipo oficial e Código do Grupo são obrigatórios.",
      };
    }

    const prazoTotal = Number(formData.get("prazo_total")) || null;
    const taxaAdm = parseBRLNumber(formData.get("taxa_administrativa_percentual") as string);
    const fundoReserva = parseBRLNumber(formData.get("fundo_reserva_percentual") as string);
    const seguroPercentual = parseBRLNumber(formData.get("seguro_percentual") as string);
    const capacidadeTotal = Number(formData.get("capacidade_total")) || 0;
    const vagasDisponiveis = Number(formData.get("vagas_disponiveis")) || 0;
    const permiteLanceEmbutido = formData.get("permite_lance_embutido") === "on";
    const percentualLanceEmbutido = parseBRLNumber(formData.get("percentual_lance_embutido") as string);
    const dataPrimeiraAssembleia = String(formData.get("data_primeira_assembleia") ?? "").trim() || null;
    const status = String(formData.get("status") ?? "Disponível").trim();
    const ativo = formData.get("ativo") !== "false";
    const observacoes = String(formData.get("observacoes") ?? "").trim() || null;

    const db = await createClient();
    const { data: saved, error } = await db.rpc("rpc_platform_salvar_grupo", {
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
      p_permite_lance_embutido: permiteLanceEmbutido,
      p_percentual_lance_embutido: percentualLanceEmbutido,
      p_observacoes: observacoes,
      p_data_primeira_assembleia: dataPrimeiraAssembleia,
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
