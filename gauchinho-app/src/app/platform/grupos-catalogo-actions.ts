"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";
import { parseBatchCotasInput, parseBRLNumber } from "@/lib/platform/grupos-prontidao";
import type { GroupActionState } from "./grupos-actions";

async function platformDb() {
  if (!(await isPlatformSuperadmin())) throw new Error("Somente Platform Superadmin.");
  return createClient();
}

const path = (grupoId: string) => `/platform/grupos/${grupoId}`;

export async function salvarModalidadesGrupoPlatformAction(
  grupoId: string,
  _previous: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  try {
    const db = await platformDb();
    const { data: grupo } = await db.from("grupos_consorcio").select("administradora_id").eq("id", grupoId).single();
    if (!grupo) throw new Error("Grupo não encontrado.");

    const { data: todasModalidades } = await db
      .from("administradora_modalidades_comissao")
      .select("id,nome,codigo,modo_reduzido_padrao,percentual_padrao,percentual_minimo,percentual_maximo")
      .eq("administradora_id", grupo.administradora_id)
      .eq("ativo", true);

    const modalidadesConfig = (todasModalidades ?? []).map((m) => {
      const ativo = formData.get(`mod_ativa_${m.id}`) === "on";
      const usarPadrao = formData.get(`mod_usar_padrao_${m.id}`) === "on";
      const modo = String(formData.get(`mod_modo_${m.id}`) ?? m.modo_reduzido_padrao ?? "fixo");
      const pctPadrao = parseBRLNumber(formData.get(`mod_pct_padrao_${m.id}`) as string);
      const pctMin = parseBRLNumber(formData.get(`mod_pct_min_${m.id}`) as string);
      const pctMax = parseBRLNumber(formData.get(`mod_pct_max_${m.id}`) as string);

      const isOverride = !usarPadrao && pctPadrao > 0 && (
        pctPadrao !== Number(m.percentual_padrao) ||
        modo !== (m.modo_reduzido_padrao || "fixo")
      );

      return {
        modalidade_id: m.id,
        ativo,
        configuracao: {
          modo_reduzido: isOverride ? modo : (m.modo_reduzido_padrao || "fixo"),
          percentual_padrao: isOverride ? pctPadrao : m.percentual_padrao,
          percentual_minimo: isOverride ? (pctMin || null) : m.percentual_minimo,
          percentual_maximo: isOverride ? (pctMax || null) : m.percentual_maximo,
          origem: isOverride ? "GRUPO_OVERRIDE" : "ADMINISTRADORA_PADRAO",
        },
      };
    });

    const { error } = await db.rpc("rpc_platform_configurar_modalidades_grupo", {
      p_grupo_id: grupoId,
      p_modalidades_config: modalidadesConfig,
    });

    if (error) throw new Error(error.message);

    revalidatePath(path(grupoId));
    revalidatePath("/platform/grupos");
    revalidatePath(`/platform/administradoras/${grupo.administradora_id}`);

    return {
      status: "SUCCESS",
      message: "Modalidades do Grupo atualizadas com sucesso.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar modalidades.";
    return { status: "SERVER_ERROR", message };
  }
}

export async function salvarCotasEmLoteAction(
  grupoId: string,
  _previous: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  try {
    const rawInput = String(formData.get("valores_credito_lote") ?? "").trim();
    const valores = parseBatchCotasInput(rawInput);

    if (valores.length === 0) {
      return {
        status: "VALIDATION_ERROR",
        message: "Nenhum valor de crédito válido informado. Insira valores separados por linha (ex: 100.000,00 ou 100000).",
      };
    }

    const db = await platformDb();
    const { data: resultado, error } = await db.rpc("rpc_platform_salvar_cotas_lote", {
      p_grupo_id: grupoId,
      p_valores_credito: valores,
    });

    if (error) throw new Error(error.message);

    const res = resultado as { inseridos?: number; atualizados?: number };
    revalidatePath(path(grupoId));
    revalidatePath("/platform/grupos");

    return {
      status: "SUCCESS",
      message: `${res.inseridos ?? 0} nova(s) cota(s) adicionada(s) e ${res.atualizados ?? 0} atualizada(s) com sucesso.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cadastrar cotas em lote.";
    return { status: "SERVER_ERROR", message };
  }
}

export async function salvarCotaModalidadeAction(
  grupoId: string,
  cotaId: string,
  modalidadeId: string,
  formData: FormData,
) {
  const db = await platformDb();
  const valorParcela = parseBRLNumber(formData.get("valor_parcela") as string);
  const modoOverride = String(formData.get("modo_override") ?? "HERDAR").toUpperCase();
  const habilitado = modoOverride !== "DESABILITADO" && formData.get("habilitado") !== "false";
  const percentualOverride = modoOverride === "PERSONALIZADO" ? parseBRLNumber(formData.get("percentual_override") as string) : null;
  const percentualMin = parseBRLNumber(formData.get("percentual_minimo") as string) || null;
  const percentualMax = parseBRLNumber(formData.get("percentual_maximo") as string) || null;

  const { error } = await db.rpc("rpc_platform_salvar_cota_modalidade_valor", {
    p_grupo_cota_id: cotaId,
    p_modalidade_id: modalidadeId,
    p_valor_parcela: valorParcela || null,
    p_habilitado: habilitado,
    p_modo_override: modoOverride,
    p_percentual_override: percentualOverride,
    p_percentual_minimo: percentualMin,
    p_percentual_maximo: percentualMax,
  });

  if (error) throw new Error(error.message);

  revalidatePath(path(grupoId));
  revalidatePath("/platform/grupos");
}

export async function salvarCotaModalidadeEmMassaAction(
  grupoId: string,
  cotaIds: string[],
  modalidadeId: string,
  modoOverride: "HERDAR" | "PERSONALIZADO" | "DESABILITADO",
  percentualOverride?: number | null,
  percentualMin?: number | null,
  percentualMax?: number | null,
) {
  const db = await platformDb();
  const habilitado = modoOverride !== "DESABILITADO";
  const pct = modoOverride === "PERSONALIZADO" ? percentualOverride : null;

  for (const cotaId of cotaIds) {
    const { error } = await db.rpc("rpc_platform_salvar_cota_modalidade_valor", {
      p_grupo_cota_id: cotaId,
      p_modalidade_id: modalidadeId,
      p_valor_parcela: null,
      p_habilitado: habilitado,
      p_modo_override: modoOverride,
      p_percentual_override: pct,
      p_percentual_minimo: percentualMin || null,
      p_percentual_maximo: percentualMax || null,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(path(grupoId));
  revalidatePath("/platform/grupos");
}

export async function excluirCotaProdutoAction(grupoId: string, cotaId: string) {
  const db = await platformDb();
  const { data: res, error } = await db.rpc("rpc_platform_excluir_cota_produto", {
    p_grupo_cota_id: cotaId,
  });

  if (error) throw new Error(error.message);

  revalidatePath(path(grupoId));
  return res as { acao: string; mensagem: string };
}

export const salvarModalidadesGrupoAction = salvarModalidadesGrupoPlatformAction;
export const salvarProdutoAction = salvarCotaModalidadeAction;
export const inativarProdutoAction = excluirCotaProdutoAction;

