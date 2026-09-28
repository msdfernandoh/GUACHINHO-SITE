import { describe, expect, it } from "vitest";
import { montarHistoricoDespesasPagas, type ContaHistorico } from "./historico-despesas-pagas";

const conta = (campos: Partial<ContaHistorico> = {}): ContaHistorico => ({
  centro_custo_id: "administrativo",
  valor: 100,
  status: "paga",
  pago_em: "2026-08-25",
  excluida_em: null,
  retirar_reserva_impostos: false,
  ...campos,
});

describe("cards mensais de despesas pagas", () => {
  it("mostra todos os meses até hoje, separa tipos e alerta só gastos acima do teto", () => {
    const historico = montarHistoricoDespesasPagas([
      { id: "administrativo", nome: "Administrativo", limite_mensal: 150 },
      { id: "eventos", nome: "Eventos", limite_mensal: 200 },
      { id: "impostos", nome: "Impostos", limite_mensal: null, descontado_comissao: true },
    ], [
      conta({ valor: 180 }),
      conta({ centro_custo_id: "eventos", valor: 50, pago_em: "2026-10-01" }),
      conta({ centro_custo_id: "eventos", valor: 300, status: "aberta", pago_em: null }),
      conta({ centro_custo_id: "impostos", valor: 90 }),
      conta({ valor: 70, retirar_reserva_impostos: true }),
      conta({ valor: 80, excluida_em: "2026-08-27T10:00:00Z" }),
      conta({ valor: 30, centro_custo_id: null, pago_em: "2026-09-05" }),
    ], "2026-09-28");

    expect(historico.map((mes) => mes.mes)).toEqual(["2026-08", "2026-09"]);
    expect(historico[0]).toEqual(expect.objectContaining({ totalPago: 180, totalExcedente: 30 }));
    expect(historico[0].tipos.find((tipo) => tipo.nome === "Administrativo"))
      .toEqual(expect.objectContaining({ pago: 180, teto: 150, excesso: 30 }));
    expect(historico[1]).toEqual(expect.objectContaining({ totalPago: 30, totalExcedente: 0 }));
    expect(historico[1].tipos.find((tipo) => tipo.nome === "Sem centro de custo"))
      .toEqual(expect.objectContaining({ pago: 30, teto: null }));
    expect(historico.map((mes) => mes.despesas.length)).toEqual([1, 1]);
    expect(historico[0].despesas[0]).toEqual(expect.objectContaining({ valor: 180, tipo: "Administrativo" }));
  });
});
