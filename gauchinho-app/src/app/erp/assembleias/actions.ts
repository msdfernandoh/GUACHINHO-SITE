"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { listGruposAutorizadosForEmpresa, assertEmpresaPodeAcessarGrupo } from "@/lib/grupos/catalogo-autorizado-service";
import { buscarPrimeiroPremioFederalPorData } from "@/lib/grupos-sorteio/buscar-resultado-federal";
import {
  calcularPedraPorLoteriaFederal,
  validarPrimeiroPremioFederal,
} from "@/lib/erp/assembleias";

import { indicadoresContemplacoes, resultadosVigentes, cotasUnicas, contempladasAtivas, type ResultadoAssembleia } from "@/lib/erp/contemplacoes";
import { classificarSimulacoes, percentualAtrasoValido } from "@/lib/erp/simulacao-contemplacao";

async function requireAssembleias(write = false) {
  const { usuario, empresaAtiva } = await requireErpRouteAccess("assembleias");
  const supabase = await createClient();
  if (write) {
    const { data, error } = await supabase.rpc("can_write_tenant_internal", { p_empresa_id: empresaAtiva.id });
    if (error || data !== true) throw new Error("Sem permissão para alterar assembleias.");
  }
  return { supabase, empresaId: empresaAtiva.id, usuarioId: usuario.id };
}

export async function buscarResultadoFederalAction(dataSorteio: string) {
  await requireAssembleias(false);
  const limpa = String(dataSorteio ?? "").trim();
  if (!limpa) throw new Error("Informe a data do sorteio.");
  return await buscarPrimeiroPremioFederalPorData(limpa);
}

export async function createAssembleiaAction(formData: FormData) {
  const { supabase, empresaId, usuarioId } = await requireAssembleias(true);
  const grupoId = String(formData.get("grupo_id") ?? "").trim();
  const dataAssembleia = String(formData.get("data_assembleia") ?? "").trim();
  const numeroRaw = String(formData.get("numero_assembleia") ?? "").trim();
  const primeiroPremio = String(formData.get("primeiro_premio_federal") ?? "").trim();
  const modo = String(formData.get("modo") ?? "").trim() || (primeiroPremio ? "FEDERAL" : "MANUAL");

  if (!grupoId || !/^\d{4}-\d{2}-\d{2}$/.test(dataAssembleia)) throw new Error("Grupo e data são obrigatórios.");
  const numero = numeroRaw ? Number(numeroRaw) : null;
  if (numero != null && (!Number.isSafeInteger(numero) || numero <= 0)) throw new Error("Número da assembleia inválido.");
  const observacao = String(formData.get("observacao") ?? "").trim() || null;

  const gruposAutorizados = await listGruposAutorizadosForEmpresa(empresaId);
  if (!gruposAutorizados || gruposAutorizados.length === 0) {
    throw new Error("Nenhum grupo autorizado disponível para este tenant.");
  }

  const isTodos = grupoId === "TODOS" || grupoId === "TODOS_GRUPOS";

  if (modo === "FEDERAL" || primeiroPremio) {
    if (!validarPrimeiroPremioFederal(primeiroPremio)) {
      throw new Error("O 1º Prêmio da Loteria Federal deve conter exatamente 5 dígitos numéricos.");
    }

    if (isTodos) {
      const rows = gruposAutorizados.map((g) => {
        const cotas =
          g.quantidade_cotas_sorteio && Number(g.quantidade_cotas_sorteio) > 0
            ? Number(g.quantidade_cotas_sorteio)
            : g.modalidade?.toLowerCase().includes("imov")
            ? 999
            : 2000;
        const pedraCalculada = calcularPedraPorLoteriaFederal(primeiroPremio, cotas);
        return {
          empresa_id: empresaId,
          grupo_id: g.id,
          data_assembleia: dataAssembleia,
          numero_assembleia: numero,
          pedra_sorteada: pedraCalculada,
          observacao:
            observacao ||
            `Loteria Federal (1º Prêmio ${primeiroPremio}) · ${g.codigo_grupo} (${cotas} cotas)`,
          criado_por_usuario_id: usuarioId,
        };
      });
      const { error } = await supabase.from("erp_assembleias_grupo").insert(rows);
      if (error) throw new Error(error.message);
    } else {
      const g = gruposAutorizados.find((x) => x.id === grupoId);
      const cotas =
        g?.quantidade_cotas_sorteio && Number(g.quantidade_cotas_sorteio) > 0
          ? Number(g.quantidade_cotas_sorteio)
          : g?.modalidade?.toLowerCase().includes("imov")
          ? 999
          : 2000;
      const pedraCalculada = calcularPedraPorLoteriaFederal(primeiroPremio, cotas);
      const { error } = await supabase.from("erp_assembleias_grupo").insert({
        empresa_id: empresaId,
        grupo_id: grupoId,
        data_assembleia: dataAssembleia,
        numero_assembleia: numero,
        pedra_sorteada: pedraCalculada,
        observacao:
          observacao ||
          `Loteria Federal (1º Prêmio ${primeiroPremio}) · ${g?.codigo_grupo ?? ""} (${cotas} cotas)`,
        criado_por_usuario_id: usuarioId,
      });
      if (error) throw new Error(error.message);
    }
  } else {
    // Modo Manual direto com pedra_sorteada fixa
    const pedra = Number(formData.get("pedra_sorteada"));
    if (!Number.isSafeInteger(pedra) || pedra < 0) throw new Error("Pedra sorteada inválida.");

    if (isTodos) {
      const rows = gruposAutorizados.map((g) => ({
        empresa_id: empresaId,
        grupo_id: g.id,
        data_assembleia: dataAssembleia,
        numero_assembleia: numero,
        pedra_sorteada: pedra,
        observacao,
        criado_por_usuario_id: usuarioId,
      }));
      const { error } = await supabase.from("erp_assembleias_grupo").insert(rows);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("erp_assembleias_grupo").insert({
        empresa_id: empresaId,
        grupo_id: grupoId,
        data_assembleia: dataAssembleia,
        numero_assembleia: numero,
        pedra_sorteada: pedra,
        observacao,
        criado_por_usuario_id: usuarioId,
      });
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath("/erp/assembleias");
}

export async function toggleAtencaoAssembleiaAction(formData: FormData) {
  const { supabase, empresaId, usuarioId } = await requireAssembleias(true);
  const assembleiaId = String(formData.get("assembleia_id") ?? "");
  const cotaId = String(formData.get("cota_id") ?? "");
  const marcada = String(formData.get("marcada") ?? "") === "true";
  if (!assembleiaId || !cotaId) throw new Error("Assembleia e cota são obrigatórias.");
  if (marcada) {
    const { error } = await supabase.from("erp_assembleia_atencoes").delete().eq("empresa_id", empresaId).eq("assembleia_id", assembleiaId).eq("cota_definitiva_id", cotaId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("erp_assembleia_atencoes").insert({ empresa_id: empresaId, assembleia_id: assembleiaId, cota_definitiva_id: cotaId, marcado_por_usuario_id: usuarioId });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/erp/assembleias");
}


async function carregarResultados(supabase: Awaited<ReturnType<typeof createClient>>, grupoIds: string[], mesAno?: string) {
  const rows: ResultadoAssembleia[] = [];
  if (!grupoIds.length) return rows;
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from("grupo_assembleias_resultados")
      .select("id, grupo_id, assembleia_numero, assembleia_data, criado_em, cotas")
      .in("grupo_id", grupoIds).order("id").range(offset, offset + 499);
    if (mesAno) {
      const [ano, mes] = mesAno.split("-").map(Number);
      const fim = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
      query = query.gte("assembleia_data", mesAno + "-01").lt("assembleia_data", fim);
    }
    const { data, error } = await query;
    if (error) throw new Error("Resultados verificados indisponíveis. A importação corrigida precisa estar instalada. " + error.message);
    rows.push(...(data ?? []) as ResultadoAssembleia[]);
    if ((data ?? []).length < 500) break;
  }
  return resultadosVigentes(rows);
}

function linhasResultado(rows: ResultadoAssembleia[]) {
  return rows.flatMap(a => cotasUnicas(a.cotas).map((c, i) => ({
    ...c, id: a.id + ":" + i, grupo_id: a.grupo_id,
    assembleia_numero: a.assembleia_numero, assembleia_data: a.assembleia_data,
  })));
}

export async function fetchContemplacoesGrupoAction(grupoId: string) {
  const { supabase, empresaId } = await requireAssembleias(false);
  await assertEmpresaPodeAcessarGrupo(empresaId, grupoId);
  const { data: grupo, error } = await supabase.from("grupos_consorcio")
    .select("id, codigo_grupo, modalidade, administradora, ultima_assembleia_numero, ultima_assembleia_data, proxima_assembleia_numero, proxima_assembleia_data, contemplacoes_atualizado_em, dados_estatisticos, contemplacoes_resumo, data_primeira_assembleia")
    .eq("id", grupoId).single();
  if (error) throw new Error(error.message);
  const resultados = await carregarResultados(supabase, [grupoId]);
  const ultima = Math.max(Number(grupo.ultima_assembleia_numero) || 0, ...resultados.map(a => a.assembleia_numero));
  const estatisticas = grupo.dados_estatisticos as { cotas_ativas?: number } | null;
  const ativas = estatisticas?.cotas_ativas;
  const resumo = grupo.contemplacoes_resumo as { versao?: number; sem_assembleias_realizadas?: boolean } | null;
  return {
    grupo: { ...grupo, sem_assembleias_realizadas: resumo?.versao === 2 && resumo.sem_assembleias_realizadas === true, ...indicadoresContemplacoes(resultados, ultima, ativas == null ? null : Number(ativas), resumo?.versao === 2 && resumo.sem_assembleias_realizadas === true) },
    assembleias: resultados.map(({ cotas, ...a }) => ({ ...a, total_ativas: contempladasAtivas(cotas) })),
    contemplacoes: linhasResultado(resultados),
  };
}

export async function fetchContemplacoesMesAction(mesAno: string) {
  const { supabase, empresaId } = await requireAssembleias(false);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesAno)) throw new Error("Mês/ano inválido.");
  const grupos = await listGruposAutorizadosForEmpresa(empresaId);
  const resultados = await carregarResultados(supabase, grupos.map(g => g.id), mesAno);
  return {
    contemplacoes: linhasResultado(resultados).map(c => ({ ...c, grupo: grupos.find(g => g.id === c.grupo_id) })),
    grupos_sem_resultado: grupos.filter(g => {
      if (resultados.some(a => a.grupo_id === g.id)) return false;
      const dados = g as typeof g & {
        contemplacoes_resumo?: { versao?: number; sem_assembleias_realizadas?: boolean } | null;
        data_primeira_assembleia?: string | null;
      };
      // Zero confirmado antes da primeira assembleia não é uma falha de coleta.
      return !(dados.contemplacoes_resumo?.versao === 2
        && dados.contemplacoes_resumo.sem_assembleias_realizadas === true
        && dados.data_primeira_assembleia
        && dados.data_primeira_assembleia.slice(0, 7) > mesAno);
    }).map(g => g.codigo_grupo),
  };
}

export async function fetchRankingContemplacaoAction(percentualAtraso = 30) {
  const { supabase, empresaId } = await requireAssembleias(false);
  if (!percentualAtrasoValido(percentualAtraso)) throw new Error("Percentual de atraso inválido.");
  const grupos = await listGruposAutorizadosForEmpresa(empresaId);
  const resultados = await carregarResultados(supabase, grupos.map(g => g.id));
  const ranking = classificarSimulacoes(grupos.map(g => {
    const dados = g as typeof g & { ultima_assembleia_numero?: number | null; dados_estatisticos?: { cotas_ativas?: number } | null };
    const rows = resultados.filter(a => a.grupo_id === g.id);
    const ultima = Math.max(Number(dados.ultima_assembleia_numero) || 0, ...rows.map(a => a.assembleia_numero));
    const ativas = dados.dados_estatisticos?.cotas_ativas;
    const indicadores = indicadoresContemplacoes(rows, ultima, ativas == null ? null : Number(ativas));
    return { id: g.id, codigo: g.codigo_grupo, ultimaAssembleia: ultima,
      assembleias: rows.map(a => ({ numero: a.assembleia_numero, cotas: a.cotas })),
      historicoCompleto: indicadores.historico_completo, cotasAEntregar: indicadores.cotas_a_entregar };
  }), percentualAtraso);
  return { ranking, percentualAtraso, gruposSemEstimativa: grupos.length - ranking.length };
}
