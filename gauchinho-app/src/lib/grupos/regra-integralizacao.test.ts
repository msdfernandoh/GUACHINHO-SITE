import { describe, expect, it } from "vitest";
import {
  calcularAssembleiaMetade,
  calcularDataPrimeiraParcelaIntegral,
  descricaoIntegralizacaoParcela,
} from "./regra-integralizacao";

describe("regra informativa de integralização", () => {
  it("usa a metade do prazo como facilitador de UX", () => {
    expect(calcularAssembleiaMetade(160)).toBe(80);
    expect(calcularAssembleiaMetade(161)).toBe(81);
  });

  it("começa a integral em X+1", () => {
    expect(calcularDataPrimeiraParcelaIntegral("2026-08-10", 12)).toBe("2027-08-10");
    expect(descricaoIntegralizacaoParcela({
      regra_integralizacao_parcela_reduzida: "ASSEMBLEIA",
      assembleia_limite_parcela_reduzida: 12,
      data_primeira_assembleia: "2026-08-10",
    })).toContain("assembleia 13, prevista para 10/08/2027");
  });
});
