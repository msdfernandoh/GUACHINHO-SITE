import type { SupabaseClient } from "@supabase/supabase-js";
import { agruparContasPossivelmenteDuplicadas, type ContaParaChecagem, type DecisaoDuplicidade } from "./contas-duplicadas";

export async function carregarDuplicidadesEmpresa(db: SupabaseClient, empresaId: string) {
  const contas: ContaParaChecagem[] = [];
  const decisoes: DecisaoDuplicidade[] = [];
  const lote = 500;
  for (let inicio = 0; ; inicio += lote) {
    const { data, error } = await db.from("financeiro_contas_pagar")
      .select("id,descricao,fornecedor,valor,competencia,vencimento,status,pago_em,pago_pessoalmente,observacao")
      .eq("empresa_id", empresaId).is("excluida_em", null).in("status", ["aberta", "paga"])
      .order("id").range(inicio, inicio + lote - 1);
    if (error) throw new Error(error.message);
    contas.push(...(data || []).map((c) => ({ ...c, valor: Number(c.valor) })));
    if ((data || []).length < lote) break;
    if (inicio >= 100000) throw new Error("Volume excede a análise desta tela. Nenhum resultado parcial foi apresentado.");
  }
  for (let inicio = 0; ; inicio += lote) {
    const { data, error } = await db.from("financeiro_contas_pagar_logs").select("conta_id,detalhes")
      .eq("empresa_id", empresaId).eq("acao", "ALTERACAO")
      .contains("detalhes", { tipo: "CONFERENCIA_DUPLICIDADE_MANTER" }).order("id").range(inicio, inicio + lote - 1);
    if (error) throw new Error(error.message);
    decisoes.push(...(data || []));
    if ((data || []).length < lote) break;
    if (inicio >= 100000) throw new Error("Histórico excede a análise desta tela; tente novamente após revisão técnica.");
  }
  return { grupos: agruparContasPossivelmenteDuplicadas(contas, decisoes), totalAnalisadas: contas.length };
}
