import { describe, expect, it } from "vitest";
import { agruparContasPossivelmenteDuplicadas, mesOcorrenciaConta, type ContaParaChecagem } from "./contas-duplicadas";
const conta = (id: string, extra: Partial<ContaParaChecagem> = {}): ContaParaChecagem => ({
  id, descricao: "Energia", fornecedor: "Fornecedor A", valor: 100.1, competencia: "2026-09", vencimento: "2026-09-10",
  status: "aberta", pago_em: null, pago_pessoalmente: false, observacao: null, ...extra,
});
describe("checagem de contas possivelmente repetidas", () => {
  it("detecta mesa e cadeira com singular/plural e fornecedores distintos", () => {
    const grupos = agruparContasPossivelmenteDuplicadas([
      conta("a", { descricao: "15 JOGOS DE MESA E CADEIRA", fornecedor: "KI LEGAL", valor: 225, competencia: "2026-07" }),
      conta("b", { descricao: "Conta – Mesa e Cadeiras", fornecedor: "Mesa e Cadeiras", valor: 225, competencia: "2026-07" }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].contas).toHaveLength(2);
  });
  it("detecta piscineiro e salário pagos no mesmo mês com fornecedor e competência diferentes", () => {
    for (const descricao of ["Piscineiro", "Salario"]) {
      const grupos = agruparContasPossivelmenteDuplicadas([
        conta("a", { descricao, fornecedor: "Cadastro antigo", competencia: "2026-08", status: "paga", pago_em: "2026-09-24" }),
        conta("b", { descricao, fornecedor: "Cadastro manual", competencia: "2026-09", status: "paga", pago_em: "2026-09-24" }),
      ]);
      expect(grupos).toHaveLength(1);
      expect(grupos[0].mes).toBe("2026-09");
      expect(grupos[0].motivos.join(" ")).toContain("competências diferentes");
    }
  });
  it("encontra Madalena entre nome resumido e nome completo no fornecedor", () => {
    expect(agruparContasPossivelmenteDuplicadas([
      conta("a", { descricao: "Madalena", fornecedor: "Salario Madalena", valor: 1500 }),
      conta("b", { descricao: "Salario Zeladora", fornecedor: "Maria Madalena de Jesus Macedo", valor: 1500 }),
    ])).toHaveLength(1);
  });
  it("não associa salários de pessoas diferentes apenas pela palavra genérica", () => {
    expect(agruparContasPossivelmenteDuplicadas([
      conta("a", { descricao: "Salario Laura", fornecedor: "Laura" }),
      conta("b", { descricao: "Salario Madalena", fornecedor: "Madalena" }),
    ])).toEqual([]);
  });
  it("não mistura recorrências pagas em meses diferentes", () => {
    expect(agruparContasPossivelmenteDuplicadas([
      conta("a", { competencia: "2026-08", status: "paga", pago_em: "2026-08-24" }),
      conta("b", { competencia: "2026-09", status: "paga", pago_em: "2026-09-24" }),
    ])).toEqual([]);
  });
  it("não associa despesas distintas só por mencionarem escritório", () => {
    expect(agruparContasPossivelmenteDuplicadas([
      conta("a", { descricao: "Lixeira escritório novo", fornecedor: "Lixeira" }),
      conta("b", { descricao: "AR condicionado escritorio", fornecedor: "Martinello" }),
    ])).toEqual([]);
  });
  it("agrupa mesmo fornecedor normalizado, centavos e competência, incluindo abertas e pagas", () => {
    const grupos = agruparContasPossivelmenteDuplicadas([conta("a", { fornecedor: "  FORNECÉDOR   A " }), conta("b", { status: "paga", pago_em: "2026-10-01" })]);
    expect(grupos).toHaveLength(1); expect(grupos[0].contas).toHaveLength(2); expect(grupos[0].mes).toBe("2026-09");
  });
  it("não mistura meses, fornecedores, centavos diferentes, canceladas ou fornecedores ausentes", () => {
    expect(agruparContasPossivelmenteDuplicadas([conta("a"), conta("b", { competencia: "2026-10" }), conta("c", { valor: 100.11 }), conta("d", { fornecedor: "Outro", descricao: "Internet" }), conta("e", { status: "cancelada" }), conta("f", { fornecedor: "" })])).toEqual([]);
  });
  it("usa mês de vencimento apenas quando não há competência válida", () => {
    expect(mesOcorrenciaConta(conta("a", { competencia: null }))).toBe("2026-09");
    expect(mesOcorrenciaConta(conta("a", { competencia: "2026-13", vencimento: "2026-10-10" }))).toBe("2026-10");
  });
  it("é estável com outra ordem de consulta e não modifica as contas", () => {
    const contas = [conta("b"), conta("a")];
    expect(agruparContasPossivelmenteDuplicadas(contas)[0].revisao).toBe(agruparContasPossivelmenteDuplicadas([...contas].reverse())[0].revisao);
    expect(contas[0].id).toBe("b");
  });
  it("preserva decisão de manter só para o snapshot conferido; nova ocorrência exige revisão", () => {
    const contas = [conta("a"), conta("b")];
    const revisao = agruparContasPossivelmenteDuplicadas(contas)[0].revisao;
    const decisoes = [{ conta_id: "a", detalhes: { tipo: "CONFERENCIA_DUPLICIDADE_MANTER", revisao } }];
    expect(agruparContasPossivelmenteDuplicadas(contas, decisoes)[0].contas.map((c) => c.mantida)).toEqual([true, false]);
    expect(agruparContasPossivelmenteDuplicadas([...contas, conta("c")], decisoes)[0].contas.every((c) => !c.mantida)).toBe(true);
    expect(agruparContasPossivelmenteDuplicadas([conta("a", { descricao: "Corrigida" }), conta("b")], decisoes)[0].contas[0].mantida).toBe(false);
  });
  it("excluir uma ocorrência não apaga a outra nem a classifica automaticamente como duplicada", () => {
    expect(agruparContasPossivelmenteDuplicadas([conta("a")])).toEqual([]);
  });
});
