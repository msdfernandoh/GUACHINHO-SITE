"use server";

import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { obterHojeCuiaba } from "@/lib/erp/conta-corrente-periodos";
import { chaveRecusa } from "@/lib/erp/contemplacoes";
import { calcularExtratoCota, proximidadesCota, type CotaExtrato } from "@/lib/erp/extrato-cliente";
import type { ResultadoAssembleia } from "@/lib/erp/contemplacoes";

export async function carregarExtratoCliente(clienteId: string, historico = "12", mesReferencia = "") {
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) throw new Error("Cliente inválido.");
  const { empresaAtiva } = await requireErpRouteAccess("extrato-clientes");
  const db = await createClient();
  const hoje = obterHojeCuiaba();
  historico = ["mes", "todos"].includes(historico) ? historico : "12";
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesReferencia) ? mesReferencia : hoje.slice(0, 7);
  const cliente = await db.from("clientes").select("id,nome,telefone").eq("empresa_id", empresaAtiva.id).eq("id", clienteId).single();
  if (cliente.error) throw new Error("Cliente indisponível nesta empresa.");
  const cotas: CotaExtrato[] = [];
  for (let offset = 0; ; offset += 500) {
    const res = await db.from("cotas_definitivas").select("*,venda:vendas!inner(cliente_id,data_venda)")
      .eq("empresa_id", empresaAtiva.id).eq("venda.empresa_id", empresaAtiva.id).eq("venda.cliente_id", clienteId)
      .neq("status", "cancelada").neq("venda.status", "cancelada").order("id").range(offset, offset + 499);
    if (res.error) throw new Error(res.error.message);
    cotas.push(...res.data as unknown as CotaExtrato[]);
    if (res.data.length < 500) break;
  }
  const ids = [...new Set(cotas.map((c) => c.grupo_id).filter((id): id is string => Boolean(id)))];
  const grupos = ids.length ? await db.from("grupos_consorcio").select("id,capacidade_total").in("id", ids) : { data: [], error: null };
  if (grupos.error) throw new Error(grupos.error.message);
  const limite = new Date(hoje + "T12:00:00Z");
  limite.setUTCMonth(limite.getUTCMonth() - 11, 1);
  const inicio12 = historico === "mes" ? hoje.slice(0, 7) + "-01" : limite.toISOString().slice(0, 10);
  const resultados: ResultadoAssembleia[] = [];
  if (ids.length) {
    for (let offset = 0; ; offset += 500) {
      let query = db.from("grupo_assembleias_resultados").select("id,grupo_id,assembleia_numero,assembleia_data,criado_em,cotas")
        .in("grupo_id", ids).lte("assembleia_data", hoje).order("id").range(offset, offset + 499);
      if (historico !== "todos") query = query.gte("assembleia_data", inicio12);
      const res = await query;
      if (res.error) throw new Error("Não foi possível consultar as assembleias.");
      resultados.push(...res.data as ResultadoAssembleia[]);
      if (res.data.length < 500) break;
    }
  }
  const recusasRes = ids.length ? await db.from("cota_contemplacao_recusas").select("grupo_id,numero_cota,assembleia_data").eq("empresa_id", empresaAtiva.id).in("grupo_id", ids) : { data: [] };
  const recusas = new Set((recusasRes.data ?? []).map((r) => chaveRecusa(r.grupo_id, r.numero_cota, r.assembleia_data)));
  return {
    cliente: cliente.data, hoje, mes, historico,
    cotas: cotas.map((cota) => {
      const calculo = calcularExtratoCota(cota, hoje, mes);
      const inicio = historico === "todos" ? calculo.adesao : [calculo.adesao, inicio12].filter(Boolean).sort().at(-1)!;
      return { id: cota.id, grupo: cota.numero_grupo, cota: cota.numero_cota, contemplada: cota.contemplada,
        ...calculo,
        assembleias: proximidadesCota(cota, resultados, grupos.data?.find((g) => g.id === cota.grupo_id)?.capacidade_total ?? null, inicio || hoje, hoje, recusas),
      };
    }),
  };
}

export async function registrarEnvioExtrato(clienteId: string, mes: string) {
  const { empresaAtiva } = await requireErpRouteAccess("extrato-clientes");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || !/^[0-9a-f-]{36}$/i.test(clienteId)) throw new Error("Cliente ou competência inválidos.");
  const db = await createClient();
  const { error } = await db.from("extratos_clientes_envios").upsert({
    empresa_id: empresaAtiva.id, cliente_id: clienteId, competencia: mes + "-01",
  }, { onConflict: "empresa_id,cliente_id,competencia", ignoreDuplicates: true });
  if (error) throw new Error("Não foi possível registrar o envio.");
}

/** Dados mínimos para montar a mensagem de WhatsApp direto da lista. */
export async function resumoMensagemExtrato(clienteId: string, mes: string) {
  const d = await carregarExtratoCliente(clienteId, "12", mes);
  return { cliente: { nome: d.cliente.nome }, historico: d.historico, telefone: d.cliente.telefone ?? null, cotas: d.cotas.map((c) => ({ atual: c.atual, valorizacao: c.valorizacao })) };
}
