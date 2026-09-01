import { describe, expect, it } from "vitest";
import { descricaoReajusteAnual } from "./reajuste-anual";

describe("reajuste anual do grupo", () => {
  it("descreve percentual fixo", () => {
    expect(descricaoReajusteAnual({ tipo_reajuste_anual: "FIXO", reajuste_anual_percentual: 6, reajuste_anual_indice: null })).toBe("Reajuste anual: 6% fixo");
  });
  it("descreve índice variável", () => {
    expect(descricaoReajusteAnual({ tipo_reajuste_anual: "VARIAVEL", reajuste_anual_percentual: null, reajuste_anual_indice: "INCC" })).toBe("Reajuste anual: INCC");
  });
  it("não inventa regra para grupo legado", () => {
    expect(descricaoReajusteAnual({ tipo_reajuste_anual: null, reajuste_anual_percentual: null, reajuste_anual_indice: null })).toBeNull();
  });
});
