import { describe, expect, it } from "vitest";
import {
  financiamentoConfigParaTipo,
  normalizeFinanciamentoStored,
  normalizeTipoFinanciamento,
  tipoFinanciamentoFromBem,
} from "./financiamento-por-tipo";

const stored = normalizeFinanciamentoStored({
  imovel: { taxaMensalPercentual: 1.27 },
  veiculo: { taxaMensalPercentual: 3.07 },
});

function taxa(tipo: Parameters<typeof tipoFinanciamentoFromBem>[0]) {
  return financiamentoConfigParaTipo(stored, tipoFinanciamentoFromBem(tipo)).taxaMensalPadrao;
}

describe("financiamento-por-tipo", () => {
  it("resolve imóvel e veículo sem inverter", () => {
    expect(taxa("imovel")).toBe(1.27);
    expect(taxa("automovel")).toBe(3.07);
  });

  it("aliases resolvem veículo", () => {
    expect(normalizeTipoFinanciamento("auto")).toBe("veiculo");
    expect(normalizeTipoFinanciamento("automovel")).toBe("veiculo");
    expect(normalizeTipoFinanciamento("moto")).toBe("veiculo");
    expect(normalizeTipoFinanciamento("caminhoes_frota")).toBe("veiculo");
    expect(normalizeTipoFinanciamento("caminhonete")).toBe("veiculo");
  });

  it("taxa por alias de bem", () => {
    expect(taxa("moto")).toBe(3.07);
    expect(taxa("caminhoes_frota")).toBe(3.07);
  });
});
