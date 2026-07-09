import { describe, expect, it } from "vitest";
import { normalizarPercentualGrupo } from "./percentual";
import { calcularSaldoDevedorSimulacao, grupoToParametros } from "./calculos";

describe("normalizarPercentualGrupo", () => {
  it("22 e 0.22 equivalem a 22 pontos percentuais", () => {
    expect(normalizarPercentualGrupo(22)).toBe(22);
    expect(normalizarPercentualGrupo(0.22)).toBe(22);
  });

  it("2 e 0.02 equivalem a 2 pontos (fundo reserva)", () => {
    expect(normalizarPercentualGrupo(2)).toBe(2);
    expect(normalizarPercentualGrupo(0.02)).toBe(2);
  });
});

describe("taxa adm / fundo — saldo devedor", () => {
  it("0.22 + 0.02 produz mesmo saldo que 22 + 2", () => {
    const credito = 1_050_000;
    const comPontos = calcularSaldoDevedorSimulacao(credito, {
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
    } as Parameters<typeof calcularSaldoDevedorSimulacao>[1]);
    const paramsFrac = grupoToParametros({
      taxa_administrativa_percentual: 0.22,
      fundo_reserva_percentual: 0.02,
      prazo_total: 220,
    });
    const comFracao = calcularSaldoDevedorSimulacao(credito, paramsFrac);
    expect(comFracao).toBe(1_302_000);
    expect(comPontos).toBe(comFracao);
  });
});
