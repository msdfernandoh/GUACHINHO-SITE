"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { requireTenantPermission } from "@/lib/tenant/context";
import { agruparContasPossivelmenteDuplicadas, type ContaParaChecagem, type DecisaoDuplicidade } from "@/lib/financeiro/contas-duplicadas";
import { excluirConta } from "./actions";

async function contexto() {
  const { empresaAtiva } = await requireErpRouteAccess("contas-pagar");
  const permissao = await requireTenantPermission("gerenciar_financeiro");
  if (permissao.empresaAtiva.id !== empresaAtiva.id) throw new Error("Empresa ativa divergente.");
  return { empresaId: empresaAtiva.id, usuarioId: permissao.usuario.id, session: await createClient() };
}

// Consulta sob demanda no servidor, em lotes: nunca depende da página corrente da lista normal.
async function analisar() {
  const ctx = await contexto();
  const contas: ContaParaChecagem[] = [];
  const decisoes: DecisaoDuplicidade[] = [];
  const lote = 500;
  for (let inicio = 0; ; inicio += lote) {
    const { data, error } = await ctx.session.from("financeiro_contas_pagar")
      .select("id,descricao,fornecedor,valor,competencia,vencimento,status,pago_em,pago_pessoalmente,observacao")
      .eq("empresa_id", ctx.empresaId).is("excluida_em", null).in("status", ["aberta", "paga"])
      .order("id").range(inicio, inicio + lote - 1);
    if (error) throw new Error(error.message);
    contas.push(...(data || []).map((c) => ({ ...c, valor: Number(c.valor) })));
    if ((data || []).length < lote) break;
    if (inicio >= 100000) throw new Error("Volume excede a análise desta tela. Nenhum resultado parcial foi apresentado.");
  }
  for (let inicio = 0; ; inicio += lote) {
    const { data, error } = await ctx.session.from("financeiro_contas_pagar_logs").select("conta_id,detalhes")
      .eq("empresa_id", ctx.empresaId).eq("acao", "ALTERACAO")
      .contains("detalhes", { tipo: "CONFERENCIA_DUPLICIDADE_MANTER" }).order("id").range(inicio, inicio + lote - 1);
    if (error) throw new Error(error.message);
    decisoes.push(...(data || []));
    if ((data || []).length < lote) break;
    if (inicio >= 100000) throw new Error("Histórico excede a análise desta tela; tente novamente após revisão técnica.");
  }
  return { ...ctx, grupos: agruparContasPossivelmenteDuplicadas(contas, decisoes), totalAnalisadas: contas.length };
}

export async function consultarContasDuplicadas(pagina = 1, incluirConferidas = false) {
  const { grupos, totalAnalisadas } = await analisar();
  const visiveis = incluirConferidas ? grupos : grupos.filter((g) => g.contas.some((c) => !c.mantida));
  const porPagina = 10;
  const paginaAtual = Math.min(Math.max(1, Math.floor(Number.isFinite(pagina) ? pagina : 1)), Math.max(1, Math.ceil(visiveis.length / porPagina)));
  return { grupos: visiveis.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina), pagina: paginaAtual,
    totalGrupos: visiveis.length, totalAnalisadas, paginas: Math.max(1, Math.ceil(visiveis.length / porPagina)) };
}

export async function decidirContaDuplicada(input: { contaId: string; revisao: string; decisao: "manter" | "excluir"; motivo: string }) {
  try {
    if (!["manter", "excluir"].includes(input.decisao)) throw new Error("Decisão inválida.");
    const resultado = await analisar();
    const grupo = resultado.grupos.find((g) => g.revisao === input.revisao && g.contas.some((c) => c.id === input.contaId));
    if (!grupo) throw new Error("As contas mudaram desde a análise. Atualize a lista antes de decidir.");
    const conta = grupo.contas.find((c) => c.id === input.contaId)!;
    if (input.decisao === "excluir") {
      if (input.motivo.trim().length < 3) throw new Error("Informe o motivo da exclusão (mínimo 3 caracteres).");
      return await excluirConta(conta.id, `Checagem de possível duplicidade: ${input.motivo.trim()}`);
    }
    if (conta.mantida) return { ok: true, message: "Esta conta já foi conferida e mantida." };
    const { data: autorizado, error: permissaoError } = await resultado.session.rpc("can_write_tenant_internal", { p_empresa_id: resultado.empresaId });
    if (permissaoError || !autorizado) throw new Error("Sem permissão de escrita no financeiro.");
    const { error } = await createAdminClient().from("financeiro_contas_pagar_logs").insert({
      empresa_id: resultado.empresaId, conta_id: conta.id, usuario_id: resultado.usuarioId, acao: "ALTERACAO",
      fornecedor: conta.fornecedor, descricao: conta.descricao, valor: conta.valor,
      motivo: "Possível duplicidade conferida: manter conta legítima.",
      detalhes: { tipo: "CONFERENCIA_DUPLICIDADE_MANTER", revisao: grupo.revisao, mes: grupo.mes, contas_ids: grupo.contas.map((c) => c.id) },
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/contas-pagar");
    return { ok: true, message: "Conta mantida e conferência registrada no histórico." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível registrar a decisão." };
  }
}
