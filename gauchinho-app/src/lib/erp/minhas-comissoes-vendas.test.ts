import { describe, expect, it } from "vitest";
import { calcularResumoVendasMes, mesAtualEmCuiaba } from "./minhas-comissoes-vendas";

describe("resumo mensal de vendas em Minhas comissões", () => {
  it("soma o crédito total e as cotas, sem duplicar a venda por parcela de comissão", () => {
    const venda = {
      id: "venda-1",
      valor_credito: 360_000,
      quantidade_cotas: 2,
      data_venda: "2026-08-15",
      status: "confirmada",
      afeta_faturamento: true,
    };

    expect(calcularResumoVendasMes([venda, venda], "2026-08")).toEqual({
      competencia: "2026-08",
      valorVendido: 360_000,
      quantidadeCotas: 2,
      quantidadeVendas: 1,
    });
  });

  it("preserva venda legada como uma cota e ignora registros fora do faturamento", () => {
    const resumo = calcularResumoVendasMes([
      {
        id: "legada",
        valor_credito: "212000.50",
        quantidade_cotas: null,
        data_venda: "2026-08-01",
        status: "confirmada",
        afeta_faturamento: true,
      },
      {
        id: "cancelada",
        valor_credito: 500_000,
        quantidade_cotas: 1,
        data_venda: "2026-08-02",
        status: "cancelada",
        afeta_faturamento: true,
      },
      {
        id: "sem-faturamento",
        valor_credito: 900_000,
        quantidade_cotas: 4,
        data_venda: "2026-08-02",
        status: "confirmada",
        afeta_faturamento: false,
      },
      {
        id: "outra-competencia",
        valor_credito: 100_000,
        quantidade_cotas: 1,
        data_venda: "2026-07-31",
        status: "confirmada",
        afeta_faturamento: true,
      },
    ], "2026-08");

    expect(resumo.valorVendido).toBe(212_000.5);
    expect(resumo.quantidadeCotas).toBe(1);
    expect(resumo.quantidadeVendas).toBe(1);
  });

  it("atribui a venda à competência da primeira parcela, mesmo formalizada no mês seguinte", () => {
    const resumo = calcularResumoVendasMes([{
      id: "janser",
      valor_credito: 254_400,
      quantidade_cotas: 2,
      data_venda: "2026-09-01",
      data_primeira_parcela: "2026-08-10",
      status: "confirmada",
      afeta_faturamento: true,
    }], "2026-08");

    expect(resumo).toMatchObject({ valorVendido: 254_400, quantidadeCotas: 2, quantidadeVendas: 1 });
  });

  it("determina o mês pela hora de Cuiabá, inclusive na virada em UTC", () => {
    expect(mesAtualEmCuiaba(new Date("2026-09-01T02:30:00.000Z"))).toBe("2026-08");
  });
});
