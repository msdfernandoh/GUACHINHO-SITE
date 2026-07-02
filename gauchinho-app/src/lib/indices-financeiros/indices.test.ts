import { describe, expect, it } from "vitest";
import { taxaAnualParaMensalPercentual, taxaMensalParaAnualPercentual } from "./math";
import { taxaMensalAplicacaoFromIndice } from "./index";
import type { IndicePublico } from "./types";

describe("taxa anual/mensal", () => {
  it("converte taxa anual para mensal", () => {
    const m = taxaAnualParaMensalPercentual(12);
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThan(12);
    const back = taxaMensalParaAnualPercentual(m);
    expect(back).toBeCloseTo(12, 1);
  });
});

describe("taxaMensalAplicacaoFromIndice", () => {
  const cdi: IndicePublico = {
    codigo: "cdi",
    nome: "CDI",
    valor_mensal: null,
    valor_anual: 10,
    valor_acumulado_12m: 10,
    data_referencia: "2026-01-01",
    ultima_atualizacao: null,
    fonte: "test",
    usando_fallback: false,
    atualizacao_automatica: true,
  };

  it("CDI 100%", () => {
    const t = taxaMensalAplicacaoFromIndice("cdi", cdi, { percentualCdi: 100 });
    expect(t).not.toBeNull();
    expect(t!).toBeCloseTo(taxaAnualParaMensalPercentual(10), 2);
  });

  it("CDI 110%", () => {
    const t100 = taxaMensalAplicacaoFromIndice("cdi", cdi, { percentualCdi: 100 })!;
    const t110 = taxaMensalAplicacaoFromIndice("cdi", cdi, { percentualCdi: 110 })!;
    expect(t110).toBeGreaterThan(t100);
  });

  it("CDI 14,15% a.a. não vira 14,15% a.m.", () => {
    const cdi1415: IndicePublico = {
      ...cdi,
      valor_anual: 14.15,
      valor_acumulado_12m: 14.15,
    };
    const t = taxaMensalAplicacaoFromIndice("cdi", cdi1415, { percentualCdi: 100 })!;
    expect(t).toBeCloseTo(taxaAnualParaMensalPercentual(14.15), 1);
    expect(t).toBeLessThan(2);
  });
});
