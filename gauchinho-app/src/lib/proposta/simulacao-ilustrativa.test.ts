import { expect, it } from "vitest";
import { projetarCredito } from "./simulacao-ilustrativa";

it("aplica o reajuste anual até o ano da contemplação e capitaliza por mês até o fim do prazo", () => {
  const resultado = projetarCredito(100_000, 42, {
    taxaAnual: 8,
    contemplacao: { ano: 3, taxaMensal: 1 },
  });
  expect(resultado.linhas[1].sem).toBeCloseTo(108_000);
  expect(resultado.linhas[2].sem).toBeCloseTo(116_640);
  expect(resultado.linhas[2].com).toBeCloseTo(116_640 * 1.01 ** 12);
  expect(resultado.linhas[3].sem).toBeNull();
  expect(resultado.finalSem).toBeCloseTo(125_971.20);
  expect(resultado.finalCom).toBeCloseTo(116_640 * 1.01 ** 18);
});

it("mostra o reajuste em todos os anos quando a contemplação não é selecionada", () => {
  const resultado = projetarCredito(100_000, 25, { taxaAnual: 8 });
  expect(resultado.linhas.map(linha => Math.round(linha.sem ?? 0))).toEqual([100_000, 108_000, 116_640]);
  expect(resultado.finalCom).toBeNull();
});
