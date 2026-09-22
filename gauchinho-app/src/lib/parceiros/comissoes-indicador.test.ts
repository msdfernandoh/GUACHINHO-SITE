import { describe, expect, it } from "vitest";
import {
  agruparComissoesIndicador,
  dataPrevistaDaParcela,
} from "./comissoes-indicador";

const parcela = (ordemEtapa: number, valorPrevisto = 825) => ({
  id: `parcela-${ordemEtapa}`,
  vendaId: "venda-1",
  ordemEtapa,
  etapa: `Parcela ${ordemEtapa}`,
  competencia: `2026-1${ordemEtapa}`,
  valorPrevisto,
  valorPago: 0,
  status: "prevista",
  conferido: false,
  cliente: "Maria da Silva",
  credito: 1_000_000,
  dataVenda: "2026-09-01",
  percentualAplicado: 12.5,
  comissaoFranqueadoraBruta: 40_000,
  impostoPercentual: 17.5,
  impostoValor: 7_000,
  comissaoFranqueadoraLiquida: 33_000,
});

describe("extrato de comissões do indicador", () => {
  it("agrupa cinco parcelas na mesma venda sem duplicar a base da franqueadora", () => {
    const vendas = agruparComissoesIndicador([5, 1, 4, 2, 3].map((ordem) => parcela(ordem)));

    expect(vendas).toHaveLength(1);
    expect(vendas[0]).toMatchObject({
      cliente: "Maria da Silva",
      credito: 1_000_000,
      comissaoFranqueadoraBruta: 40_000,
      impostoValor: 7_000,
      comissaoFranqueadoraLiquida: 33_000,
      percentualAplicado: 12.5,
      totalIndicador: 4_125,
    });
    expect(vendas[0].parcelas.map((item) => item.ordemEtapa)).toEqual([1, 2, 3, 4, 5]);
  });

  it("informa a primeira parcela até 30 dias após a conclusão", () => {
    expect(dataPrevistaDaParcela(parcela(1))).toBe("Até 01/10/2026");
    expect(dataPrevistaDaParcela(parcela(2))).toBe("Até 31/10/2026");
  });
});
