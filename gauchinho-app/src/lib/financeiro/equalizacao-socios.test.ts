import { describe, expect, it } from "vitest";
import { calcularEqualizacaoSocios } from "./equalizacao-socios";

describe("equalização societária configurável", () => {
  it("preserva o caso de dois sócios 50/50", () => {
    const resultado = calcularEqualizacaoSocios([
      { id: "a", nome: "Fernando", percentual: 50, pago: 1000 },
      { id: "b", nome: "Eroni", percentual: 50, pago: 0 },
    ]);
    expect(resultado.socios.map((socio) => socio.responsabilidade)).toEqual([500, 500]);
    expect(resultado.instrucoes[0]).toMatchObject({ devedorNome: "Eroni", credorNome: "Fernando", valorTransferencia: 500, valorContasAlternativo: 1000 });
  });

  it("calcula três sócios com percentuais diferentes e fecha os centavos", () => {
    const resultado = calcularEqualizacaoSocios([
      { id: "a", nome: "A", percentual: 50, pago: 100 },
      { id: "b", nome: "B", percentual: 30, pago: 0 },
      { id: "c", nome: "C", percentual: 20, pago: 0 },
    ]);
    expect(resultado.socios.map((socio) => socio.responsabilidade)).toEqual([50, 30, 20]);
    expect(resultado.instrucoes.reduce((total, item) => total + item.valorTransferencia, 0)).toBe(50);
  });
});
