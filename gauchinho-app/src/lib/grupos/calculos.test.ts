import { describe, expect, it } from "vitest";
import {
  calcularCreditoLiquidoPosContemplacao,
  estimarCamposCotaBulk,
  calcularLanceEmbutido,
  calcularLanceTotal,
  calcularParcelasRestantes,
  calcularPrimeiraParcela,
  calcularRecursoProprio,
  calcularSaldoDevedor,
  calcularSeguro,
  calcularSomaCotas,
  calcularTotaisGrupos,
  type ParametrosGrupo,
} from "./calculos";

const paramsBase: ParametrosGrupo = {
  taxaAdministrativaPercentual: 20,
  fundoReservaPercentual: 2,
  seguroHabilitado: true,
  seguroPercentual: 1,
  permiteLanceEmbutido: true,
  percentualLanceEmbutido: 10,
  percentualRecursoProprioSugerido: 5,
  prazoTotal: 60,
  parcelasRealizadas: 10,
  seguroPosContemplacao: false,
};

describe("calculos grupos", () => {
  it("soma cotas com quantidade", () => {
    expect(
      calcularSomaCotas([
        { valorCredito: 100_000, quantidadeCotas: 2 },
        { valorCredito: 50_000 },
      ]),
    ).toBe(250_000);
  });

  it("saldo devedor usa saldo informado", () => {
    expect(
      calcularSaldoDevedor(
        [{ valorCredito: 100_000, saldoDevedorInformado: 80_000 }],
        paramsBase,
      ),
    ).toBe(80_000);
  });

  it("lance embutido e recurso próprio", () => {
    const saldo = 100_000;
    const emb = calcularLanceEmbutido(saldo, paramsBase);
    expect(emb).toBe(10_000);
    const rec = calcularRecursoProprio(100_000, paramsBase);
    expect(rec).toBe(5_000);
    expect(calcularLanceTotal(emb, rec)).toBe(15_000);
  });

  it("seguro e parcelas restantes", () => {
    expect(calcularSeguro(100_000, paramsBase)).toBe(1_000);
    expect(calcularParcelasRestantes(paramsBase)).toBe(50);
  });

  it("crédito líquido (Excel: soma − embutido)", () => {
    expect(calcularCreditoLiquidoPosContemplacao(100_000, 10_000)).toBe(90_000);
  });

  it("primeira parcela soma parcelas informadas", () => {
    expect(
      calcularPrimeiraParcela([
        { valorCredito: 1, valorParcelaInformado: 1200 },
        { valorCredito: 1, valorParcelaInformado: 800, quantidadeCotas: 2 },
      ]),
    ).toBe(2800);
  });

  it("totais agregados", () => {
    const tot = calcularTotaisGrupos([
      {
        linha: { valorCredito: 100_000, valorParcelaInformado: 2000 },
        params: paramsBase,
      },
    ]);
    expect(tot.somaCotas).toBe(100_000);
    expect(tot.lanceEmbutido).toBe(12_200);
    expect(tot.recursoProprio).toBe(5_000);
    expect(tot.creditoLiquido).toBe(87_800);
  });

  it("parcela reduzida usa prazo total (Excel 1533)", () => {
    const grupo = {
      taxa_administrativa_percentual: 22,
      fundo_reserva_percentual: 2,
      seguro_habilitado: false,
      seguro_pos_contemplacao: true,
      seguro_percentual: 0.0004,
      tem_parcela_reduzida: true,
      percentual_parcela_reduzida: 60,
      prazo_total: 220,
      parcelas_realizadas: 11,
      prazo_restante: 209,
    };
    const est = estimarCamposCotaBulk(1_000_000, grupo);
    expect(est.parcela_integral).toBeCloseTo(5636.36, 1);
    expect(est.valor_parcela).toBeCloseTo(3381.82, 1);
  });
});
