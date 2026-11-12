"use server";

import { resolverQuantidadeCotasGrupo } from "@/lib/grupos-sorteio/calcular-palavra-chave";
import { refresh, revalidatePath } from "next/cache";
import { registrarStatusOperacionalCota } from "@/lib/erp/status-operacional-cota";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { listarGruposParaAssembleias } from "@/lib/erp/grupos-assembleias";
import { listGruposAutorizadosForEmpresa, assertEmpresaPodeAcessarGrupo } from "@/lib/grupos/catalogo-autorizado-service";
import { buscarPrimeiroPremioFederalPorData } from "@/lib/grupos-sorteio/buscar-resultado-federal";
import {
  calcularPedraPorLoteriaFederal,
  validarPrimeiroPremioFederal,
} from "@/lib/erp/assembleias";

import { indicadoresContemplacoes, identificarContemplacoesDaCarteira, resultadosVigentes, cotasUnicas, contempladasAtivas, type ResultadoAssembleia } from "@/lib/erp/contemplacoes";
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

  const gruposAutorizados = await listarGruposParaAssembleias(supabase, empresaId);
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
        const cotas = resolverQuantidadeCotasGrupo(g);
        if (cotas == null) throw new Error(`Cadastre a quantidade de cotas do grupo ${g.codigo_grupo}.`);
        const pedraCalculada = calcularPedraPorLoteriaFederal(primeiroPremio, cotas);
        return {
          empresa_id: empresaId,
          grupo_id: g.id,
          data_assembleia: dataAssembleia,
          numero_assembleia: numero,
          pedra_sorteada: pedraCalculada,
          observacao: `Loteria Federal (1º Prêmio ${primeiroPremio}) · ${g.codigo_grupo} (${cotas} cotas)${observacao ? ` · ${observacao}` : ""}`,
          criado_por_usuario_id: usuarioId,
        };
      });
      const { error } = await supabase.from("erp_assembleias_grupo").insert(rows);
      if (error) throw new Error(error.message);
    } else {
      const g = gruposAutorizados.find((x) => x.id === grupoId);
      if (!g) throw new Error("Grupo não autorizado para esta empresa.");
      const cotas = resolverQuantidadeCotasGrupo(g);
      if (cotas == null) throw new Error(`Cadastre a quantidade de cotas do grupo ${g.codigo_grupo}.`);
      const pedraCalculada = calcularPedraPorLoteriaFederal(primeiroPremio, cotas);
      const { error } = await supabase.from("erp_assembleias_grupo").insert({
        empresa_id: empresaId,
        grupo_id: grupoId,
        data_assembleia: dataAssembleia,
        numero_assembleia: numero,
        pedra_sorteada: pedraCalculada,
        observacao: `Loteria Federal (1º Prêmio ${primeiroPremio}) · ${g?.codigo_grupo ?? ""} (${cotas} cotas)${observacao ? ` · ${observacao}` : ""}`,
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
  refresh();
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

export async function fetchResumoGruposAssembleiaAction(grupoIds: string[]) {
  const { supabase, empresaId } = await requireAssembleias(false);
  const solicitados = new Set(grupoIds);
  const grupos = (await listarGruposParaAssembleias(supabase, empresaId)).filter((g) => solicitados.has(g.id));
  const resultados = await carregarResultados(supabase, grupos.map((g) => g.id));
  const porGrupo = new Map<string, ResultadoAssembleia[]>();
  for (const resultado of resultados) {
    const grupo = porGrupo.get(resultado.grupo_id) ?? [];
    grupo.push(resultado);
    porGrupo.set(resultado.grupo_id, grupo);
  }

  return Object.fromEntries(grupos.map((grupo) => {
    const dados = grupo as typeof grupo & {
      ultima_assembleia_numero?: number | null;
      dados_estatisticos?: { cotas_ativas?: number } | null;
      contemplacoes_resumo?: { versao?: number; sem_assembleias_realizadas?: boolean } | null;
    };
    const rows = porGrupo.get(grupo.id) ?? [];
    const ultima = Math.max(Number(dados.ultima_assembleia_numero) || 0, ...rows.map((row) => row.assembleia_numero));
    const ativas = dados.dados_estatisticos?.cotas_ativas;
    const semAssembleias = dados.contemplacoes_resumo?.versao === 2 && dados.contemplacoes_resumo.sem_assembleias_realizadas === true;
    const indicadores = indicadoresContemplacoes(rows, ultima, ativas == null ? null : Number(ativas), semAssembleias);
    return [grupo.id, {
      media3m: indicadores.media_lance_3m,
      contempladas: indicadores.cotas_entregues,
      aContemplar: indicadores.cotas_a_entregar,
      ultima: ultima > 0 || semAssembleias ? ultima : null,
      totalAssembleias: grupo.prazo_total,
    }] as const;
  }));
}

function linhasResultado(rows: ResultadoAssembleia[]) {
  return rows.flatMap(a => cotasUnicas(a.cotas).map((c, i) => ({
    ...c, id: a.id + ":" + i, grupo_id: a.grupo_id,
    assembleia_numero: a.assembleia_numero, assembleia_data: a.assembleia_data,
  })));
}

async function linhasResultadoComCarteira(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  resultados: ResultadoAssembleia[],
) {
  const linhas = linhasResultado(resultados);
  if (!linhas.length) return identificarContemplacoesDaCarteira(linhas, []);
  const grupoIds = [...new Set(linhas.map((linha) => linha.grupo_id))];
  const carteira: Parameters<typeof identificarContemplacoesDaCarteira>[1] = [];

  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("cotas_definitivas")
      .select("grupo_id,numero_cota,venda:vendas(cliente_id,cliente_nome,data_venda,cliente:clientes(nome))")
      .eq("empresa_id", empresaId).in("grupo_id", grupoIds)
      .neq("status", "cancelada").order("id").range(offset, offset + 499);
    if (error) throw new Error("Não foi possível cruzar os resultados com a carteira.");
    for (const cota of data ?? []) {
      const venda = Array.isArray(cota.venda) ? cota.venda[0] : cota.venda;
      const cliente = Array.isArray(venda?.cliente) ? venda.cliente[0] : venda?.cliente;
      const nome = cliente?.nome || venda?.cliente_nome;
      if (!cota.grupo_id || !cota.numero_cota || !venda?.cliente_id || !nome) continue;
      carteira.push({
        grupo_id: cota.grupo_id, numero_cota: cota.numero_cota, cliente_id: venda.cliente_id,
        cliente_nome: nome, data_venda: venda.data_venda,
      });
    }
    if ((data?.length ?? 0) < 500) break;
  }

  return identificarContemplacoesDaCarteira(linhas, carteira);
}

export async function fetchContemplacoesGrupoAction(grupoId: string) {
  const { supabase, empresaId } = await requireAssembleias(false);
  await assertEmpresaPodeAcessarGrupo(empresaId, grupoId);
  const { data: grupo, error } = await supabase.from("grupos_consorcio")
    .select("id, codigo_grupo, modalidade, administradora, ultima_assembleia_numero, ultima_assembleia_data, proxima_assembleia_numero, proxima_assembleia_data, contemplacoes_atualizado_em, dados_estatisticos, contemplacoes_resumo, data_primeira_assembleia, capacidade_total, quantidade_cotas_sorteio, prazo_total")
    .eq("id", grupoId).single();
  if (error) throw new Error(error.message);
  const resultados = await carregarResultados(supabase, [grupoId]);
  const ultima = Math.max(Number(grupo.ultima_assembleia_numero) || 0, ...resultados.map(a => a.assembleia_numero));
  const estatisticas = grupo.dados_estatisticos as { cotas_ativas?: number } | null;
  const ativas = estatisticas?.cotas_ativas;
  const resumo = grupo.contemplacoes_resumo as { versao?: number; sem_assembleias_realizadas?: boolean } | null;
  return {
    grupo: { ...grupo, total_cotas: resolverQuantidadeCotasGrupo(grupo), ultima_assembleia_numero: ultima, sem_assembleias_realizadas: resumo?.versao === 2 && resumo.sem_assembleias_realizadas === true, ...indicadoresContemplacoes(resultados, ultima, ativas == null ? null : Number(ativas), resumo?.versao === 2 && resumo.sem_assembleias_realizadas === true) },
    assembleias: resultados.map(({ cotas, ...a }) => ({ ...a, total_ativas: contempladasAtivas(cotas) })),
    contemplacoes: await linhasResultadoComCarteira(supabase, empresaId, resultados),
  };
}

export async function fetchContemplacoesMesAction(mesAno: string) {
  const { supabase, empresaId } = await requireAssembleias(false);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesAno)) throw new Error("Mês/ano inválido.");
  const grupos = await listGruposAutorizadosForEmpresa(empresaId);
  const resultados = await carregarResultados(supabase, grupos.map(g => g.id), mesAno);
  return {
    contemplacoes: (await linhasResultadoComCarteira(supabase, empresaId, resultados)).map(c => ({ ...c, grupo: grupos.find(g => g.id === c.grupo_id) })),
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

export async function marcarStatusCotaAssembleiaAction(
  assembleiaId: string,
  cotaId: string,
  status: "cancelada" | "contemplada",
  valorCredito?: number,
) {
  if (status !== "cancelada" && status !== "contemplada") throw new Error("Situação inválida.");
  const { supabase, empresaId, usuarioId } = await requireAssembleias(true);
  const { data: assembleia, error: erroAssembleia } = await supabase
    .from("erp_assembleias_grupo").select("grupo_id,data_assembleia")
    .eq("empresa_id", empresaId).eq("id", assembleiaId).maybeSingle();
  if (erroAssembleia) throw new Error(erroAssembleia.message);
  if (!assembleia) throw new Error("Assembleia não encontrada.");
  const concedidos = await listGruposAutorizadosForEmpresa(empresaId, { incluirInativos: true });
  if (!concedidos.some((grupo) => grupo.id === assembleia.grupo_id)) {
    throw new Error("Grupo não autorizado para a empresa.");
  }
  const { data: cota, error: erroCota } = await supabase
    .from("cotas_definitivas").select("id,status,contemplada")
    .eq("empresa_id", empresaId).eq("grupo_id", assembleia.grupo_id).eq("id", cotaId).maybeSingle();
  if (erroCota) throw new Error(erroCota.message);
  if (!cota) throw new Error("Cota não encontrada para este grupo.");
  if (cota.status === "cancelada" || cota.status === "contemplada" || cota.contemplada) {
    throw new Error("A cota já está cancelada ou contemplada.");
  }

  if (status === "contemplada") {
    if (valorCredito == null || !Number.isFinite(valorCredito) || valorCredito <= 0) {
      return { ok: false, mensagem: "Informe o valor atualizado do crédito." };
    }
    const { error } = await supabase.rpc("rpc_marcar_cota_contemplada", {
      p_empresa_id: empresaId,
      p_cota_id: cotaId,
      p_data: assembleia.data_assembleia,
      p_tipo: "SORTEIO",
      p_valor_credito: valorCredito,
      p_observacao: "Registrada em Assembleias e Pedras",
      p_idempotency_key: `contemplacao:${cotaId}`,
    });
    if (error) {
      console.error("Erro ao registrar contemplação da assembleia", error.code, error.message);
      return { ok: false, mensagem: "O ERP não conseguiu registrar a contemplação. Confira os dados da cota e tente novamente." };
    }
    revalidatePath("/erp/clientes");
    revalidatePath("/erp/comissoes");
  } else {
    await registrarStatusOperacionalCota({ empresaId, usuarioId, cotaId, status, tela: "Assembleias e Pedras", statusAnterior: cota.status });
  }
  revalidatePath("/erp/assembleias");
  revalidatePath("/erp/lances");
  revalidatePath("/erp/vendas");
  refresh();
  return { ok: true };
}