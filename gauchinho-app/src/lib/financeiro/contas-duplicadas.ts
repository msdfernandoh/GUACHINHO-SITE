import { createHash } from "node:crypto";

export type ContaParaChecagem = {
  id: string; descricao: string; fornecedor: string | null; valor: number;
  competencia: string | null; vencimento: string; status: string;
  pago_em: string | null; pago_pessoalmente: boolean; observacao: string | null;
};
export type GrupoContasDuplicadas = {
  fornecedor: string; mes: string; valor: number; revisao: string;
  contas: Array<ContaParaChecagem & { mantida: boolean }>;
};
export type DecisaoDuplicidade = { conta_id: string; detalhes: unknown };
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
export function mesOcorrenciaConta(conta: ContaParaChecagem): string {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(conta.competencia || "")) return conta.competencia!;
  return conta.vencimento.slice(0, 7);
}
export function agruparContasPossivelmenteDuplicadas(contas: ContaParaChecagem[], decisoes: DecisaoDuplicidade[] = []): GrupoContasDuplicadas[] {
  const grupos = new Map<string, ContaParaChecagem[]>();
  for (const conta of contas) {
    if (!["aberta", "paga"].includes(conta.status) || !conta.fornecedor?.trim() || !Number.isFinite(conta.valor)) continue;
    const chave = JSON.stringify([normalizar(conta.fornecedor), Math.round(conta.valor * 100), mesOcorrenciaConta(conta)]);
    const itens = grupos.get(chave) || [];
    itens.push(conta); grupos.set(chave, itens);
  }
  const mantidas = new Set(decisoes.flatMap((d) => {
    if (!d.detalhes || typeof d.detalhes !== "object") return [];
    const detalhe = d.detalhes as Record<string, unknown>;
    return detalhe.tipo === "CONFERENCIA_DUPLICIDADE_MANTER" && typeof detalhe.revisao === "string" ? [`${d.conta_id}:${detalhe.revisao}`] : [];
  }));
  return Array.from(grupos.values()).filter((itens) => itens.length > 1).map((itens) => {
    const ordenados = [...itens].sort((a, b) => a.id.localeCompare(b.id));
    const revisao = createHash("sha256").update(JSON.stringify(ordenados)).digest("hex");
    return { fornecedor: ordenados[0].fornecedor!, valor: ordenados[0].valor, mes: mesOcorrenciaConta(ordenados[0]), revisao,
      contas: ordenados.map((conta) => ({ ...conta, mantida: mantidas.has(`${conta.id}:${revisao}`) })) };
  }).sort((a, b) => b.mes.localeCompare(a.mes) || a.fornecedor.localeCompare(b.fornecedor, "pt-BR") || a.valor - b.valor);
}
