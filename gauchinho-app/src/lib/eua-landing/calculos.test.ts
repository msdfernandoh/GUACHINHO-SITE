import { describe, expect, it } from "vitest";
import {
  aluguelEstimado,
  calcularPlano,
  cambioValido,
  cartaParaLiquido,
  comparativoFinanciamento,
  lanceEmbutido,
  opcoesDeCota,
  parcelaReduzida,
} from "./calculos";

describe("calcularPlano", () => {
  it("reproduz a tabela comercial do imóvel (R$ 100 mil → R$ 375)", () => {
    expect(parcelaReduzida(100_000, "imovel")).toBeCloseTo(375);
    expect(parcelaReduzida(150_000, "veiculo")).toBeCloseTo(870);
  });

  it("converte dólar mensal em crédito de imóvel", () => {
    const plano = calcularPlano(300, 5.4, "imovel");
    expect(plano.reaisMensal).toBeCloseTo(1620);
    expect(plano.creditoTotal).toBe(430_000);
    expect(plano.quantidadeCotas).toBe(1);
    expect(plano.parcelaReduzidaTotal).toBeLessThanOrEqual(1620);
  });

  it("divide em várias cotas quando passa do teto do grupo", () => {
    const plano = calcularPlano(1000, 5.4, "imovel");
    expect(plano.quantidadeCotas).toBe(2);
    expect(plano.creditoPorCota).toBe(720_000);
    expect(plano.creditoTotal).toBe(1_440_000);
  });

  it("sinaliza valor abaixo do mínimo e usa o mínimo do grupo", () => {
    const plano = calcularPlano(50, 5.4, "imovel");
    expect(plano.abaixoDoMinimo).toBe(true);
    expect(plano.creditoTotal).toBe(100_000);
  });

  it("oferece cotas vizinhas sem sair dos limites", () => {
    const plano = calcularPlano(300, 5.4, "imovel");
    expect(opcoesDeCota(plano)).toEqual([390_000, 430_000, 470_000]);
    const minimo = calcularPlano(50, 5.4, "imovel");
    expect(opcoesDeCota(minimo).every((v) => v >= 100_000)).toBe(true);
  });
});

describe("apoios", () => {
  it("usa câmbio padrão quando o informado é inválido", () => {
    expect(cambioValido(null)).toBe(5.4);
    expect(cambioValido(0)).toBe(5.4);
    expect(cambioValido(5.12)).toBe(5.12);
  });

  it("limita o lance embutido a 30%", () => {
    expect(lanceEmbutido(300_000, 0.25)).toMatchObject({ lance: 75_000, liquido: 225_000 });
    expect(lanceEmbutido(300_000, 0.9).percentual).toBe(0.3);
    expect(cartaParaLiquido(300_000)).toBe(430_000);
  });

  it("estima aluguel e comparativo", () => {
    expect(aluguelEstimado(3, 250_000)).toBe(3750);
    const cmp = comparativoFinanciamento(300_000);
    expect(cmp.totalConsorcio).toBe(360_000);
    expect(cmp.totalFinanciamento).toBeGreaterThan(cmp.totalConsorcio);
  });
});
