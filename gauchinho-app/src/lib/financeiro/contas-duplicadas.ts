import { createHash } from "node:crypto";

export type ContaParaChecagem = {
  id: string; descricao: string; fornecedor: string | null; valor: number;
  competencia: string | null; vencimento: string; status: string;
  pago_em: string | null; pago_pessoalmente: boolean; observacao: string | null;
};
export type GrupoContasDuplicadas = {
  fornecedor: string; mes: string; valor: number; revisao: string;
  contas: Array<ContaParaChecagem & { mantida: boolean }>;
  motivos: string[];
};
export type DecisaoDuplicidade = { conta_id: string; detalhes: unknown };
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
export function mesOcorrenciaConta(conta: ContaParaChecagem): string {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(conta.competencia || "")) return conta.competencia!;
  return conta.vencimento.slice(0, 7);
}
export function agruparContasPossivelmenteDuplicadas(contas: ContaParaChecagem[], decisoes: DecisaoDuplicidade[] = []): GrupoContasDuplicadas[] {
  const validas = contas.filter((c) => ["aberta", "paga"].includes(c.status) && c.fornecedor?.trim() && Number.isFinite(c.valor));
  const pais = validas.map((_, i) => i);
  const raiz = (i: number): number => pais[i] === i ? i : (pais[i] = raiz(pais[i]));
  const ligacoes: Array<{ a: number; motivo: string }> = [];
  const genericas = new Set(["salario", "salarios", "pagamento", "servico", "servicos", "prestador", "produto", "produtos", "limpeza", "manutencao", "parcela", "compra", "empresa", "maria", "escritorio", "administrativo", "financeiro", "material"]);
  const palavras = (valor: string) => normalizar(valor).split(/[^a-z0-9]+/).map((t) => t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t);
  const termos = (c: ContaParaChecagem) => palavras(c.descricao).filter((t) => t.length >= 5 && !genericas.has(t));
  const texto = (c: ContaParaChecagem) => new Set(palavras(`${c.descricao} ${c.fornecedor || ""}`));
  const porValor = new Map<number, number[]>();
  for (let a = 0; a < validas.length; a++) {
    const atual = validas[a];
    const centavos = Math.round(atual.valor * 100);
    for (const b of porValor.get(centavos) || []) {
      const outra = validas[b];
      const mesmaCompetencia = mesOcorrenciaConta(atual) === mesOcorrenciaConta(outra);
      const mesmoPagamento = atual.status === "paga" && outra.status === "paga" && Boolean(atual.pago_em && outra.pago_em) && atual.pago_em!.slice(0, 7) === outra.pago_em!.slice(0, 7);
      if (!mesmaCompetencia && !mesmoPagamento) continue;
      const fornecedorIgual = normalizar(atual.fornecedor!) === normalizar(outra.fornecedor!);
      const descricaoIgual = normalizar(atual.descricao) === normalizar(outra.descricao);
      const identidade = termos(atual).some((t) => texto(outra).has(t)) || termos(outra).some((t) => texto(atual).has(t));
      if (!(fornecedorIgual && mesmaCompetencia) && !descricaoIgual && !identidade) continue;
      pais[raiz(a)] = raiz(b);
      ligacoes.push({ a, motivo: `${fornecedorIgual ? "Mesmo fornecedor" : descricaoIgual ? "Mesma descrição, fornecedores diferentes" : "Nome/serviço em comum na descrição e no fornecedor"}; mesmo valor; ${mesmoPagamento ? "mesmo mês de pagamento" : "mesmo mês de ocorrência"}${!mesmaCompetencia ? "; competências diferentes: conferir" : ""}.` });
    }
    porValor.set(centavos, [...(porValor.get(centavos) || []), a]);
  }
  const grupos = new Map<number, ContaParaChecagem[]>();
  validas.forEach((c, i) => { const r = raiz(i); grupos.set(r, [...(grupos.get(r) || []), c]); });
  const mantidas = new Set(decisoes.flatMap((d) => {
    if (!d.detalhes || typeof d.detalhes !== "object") return [];
    const detalhe = d.detalhes as Record<string, unknown>;
    return detalhe.tipo === "CONFERENCIA_DUPLICIDADE_MANTER" && typeof detalhe.revisao === "string" ? [`${d.conta_id}:${detalhe.revisao}`] : [];
  }));
  return Array.from(grupos.entries()).filter(([, itens]) => itens.length > 1).map(([r, itens]) => {
    const ordenados = [...itens].sort((a, b) => a.id.localeCompare(b.id));
    const revisao = createHash("sha256").update(JSON.stringify(ordenados)).digest("hex");
    return { fornecedor: [...new Set(ordenados.map((c) => c.fornecedor!))].join(" / "), valor: ordenados[0].valor,
      mes: ordenados.every((c) => c.status === "paga" && c.pago_em?.slice(0, 7) === ordenados[0].pago_em?.slice(0, 7)) ? ordenados[0].pago_em!.slice(0, 7) : mesOcorrenciaConta(ordenados[0]), revisao,
      motivos: [...new Set(ligacoes.filter((l) => raiz(l.a) === r).map((l) => l.motivo))],
      contas: ordenados.map((conta) => ({ ...conta, mantida: mantidas.has(`${conta.id}:${revisao}`) })) };
  }).sort((a, b) => b.mes.localeCompare(a.mes) || a.fornecedor.localeCompare(b.fornecedor, "pt-BR") || a.valor - b.valor);
}
