import { describe, expect, it } from "vitest";
import { calcularFechamentoSocios } from "./fechamento-socios";

const base = {
  despesasPagas: 10000,
  lucroConsultores: 2000,
  reservaImpostos: 500,
  caixaAntes: 12000,
  socios: [
    { id: "f", nome: "Fernando", percentual: 50, comissaoGuardada: 4000, adiantamentoPessoal: 6000, saldoAnterior: 0, retirada: 0 },
    { id: "e", nome: "Eroni", percentual: 50, comissaoGuardada: 5000, adiantamentoPessoal: 0, saldoAnterior: 0, retirada: 0 },
  ],
};

describe("fechamento societário", () => {
  it("usa primeiro a margem comum e divide somente o restante das contas pagas", () => {
    const resultado = calcularFechamentoSocios(base);
    expect(resultado.despesasDivididas).toBe(8000);
    expect(resultado.socios.map((s) => s.parteDespesas)).toEqual([4000, 4000]);
    expect(resultado.socios.map((s) => s.ficouNaEmpresa)).toEqual([6000, 1000]);
    expect(resultado.cobertura).toBe(4500);
  });

  it("separa retirada, reserva fiscal e sobra da margem", () => {
    const resultado = calcularFechamentoSocios({
      ...base, despesasPagas: 1000, lucroConsultores: 2000,
      socios: [{ ...base.socios[0], retirada: 500 }, base.socios[1]],
    });
    expect(resultado.lucroRestanteNaEmpresa).toBe(1000);
    expect(resultado.caixaDepois).toBe(11500);
    expect(resultado.socios[0].ficouNaEmpresa).toBe(9500);
  });

  it("impede retirada maior que o direito do sócio", () => {
    expect(() => calcularFechamentoSocios({
      ...base, socios: [{ ...base.socios[0], retirada: 6001 }, base.socios[1]],
    })).toThrow(/supera seu saldo positivo/);
  });
});


it("a retirada digitada é previsão e mantém os centavos do crédito", () => {
  const resultado = calcularFechamentoSocios({ despesasPagas: 66200.20, lucroConsultores: 0,
    reservaImpostos: 0, caixaAntes: 50000, socios: [
      { id: "f", nome: "Fernando", percentual: 50, comissaoGuardada: 34462.18, adiantamentoPessoal: 9790.61, saldoAnterior: 0, retirada: 8928.73 },
      { id: "e", nome: "Eroni", percentual: 50, comissaoGuardada: 40000, adiantamentoPessoal: 0, saldoAnterior: 0, retirada: 0 },
    ] });
  expect(resultado.socios[0].direitoAntesRetirada).toBe(11152.69);
  expect(resultado.socios[0].ficouNaEmpresa).toBe(2223.96);
});
