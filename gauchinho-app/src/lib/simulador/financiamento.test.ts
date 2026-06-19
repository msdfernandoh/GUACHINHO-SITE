import { describe, expect, it } from "vitest";
import { DEFAULT_FINANCIAMENTO_CONFIG } from "@/lib/config/defaults";
import { simularFinanciamento } from "@/lib/simulador/financiamento";
import {
  entradaFinanciamentoParaCalculo,
  entradaPadraoFinanciamento,
  taxaFinanciamentoEfetiva,
  taxaMensalFinanciamentoCalculo,
} from "@/lib/simulador/financiamento-entrada";
import { listPrazosFinanciamento } from "@/lib/simulador/prazos";

describe("financiamento — preview home", () => {
  it("com config válida, parcela > 0", () => {
    const valor = 500_000;
    const prazo = 220;
    const fin = DEFAULT_FINANCIAMENTO_CONFIG;
    const prazos = listPrazosFinanciamento(fin);
    const prazoEfetivo = prazos.includes(prazo) ? prazo : prazos[0];
    const taxa = taxaFinanciamentoEfetiva(fin)!;
    const r = simularFinanciamento({
      valorBem: valor,
      entrada: entradaPadraoFinanciamento(valor, fin),
      taxaMensalPercentual: taxa,
      prazoMeses: prazoEfetivo,
    });
    expect(r.parcelaEstimada).toBeGreaterThan(0);
  });

  it("taxa zero não é considerada configurada", () => {
    expect(taxaFinanciamentoEfetiva({ ...DEFAULT_FINANCIAMENTO_CONFIG, taxaMensalPadrao: 0 })).toBeNull();
  });

  it("taxaMensalFinanciamentoCalculo usa fallback quando informada é zero", () => {
    const fin = { ...DEFAULT_FINANCIAMENTO_CONFIG, taxaMensalPadrao: 1.2 };
    expect(taxaMensalFinanciamentoCalculo(0, fin)).toBe(1.2);
  });

  it("entradaFinanciamentoParaCalculo evita valor financiado zero", () => {
    const valor = 5_000_000;
    const entrada = entradaFinanciamentoParaCalculo(valor, valor);
    expect(entrada).toBeLessThan(valor);
    const r = simularFinanciamento({
      valorBem: valor,
      entrada,
      taxaMensalPercentual: 1,
      prazoMeses: 220,
    });
    expect(r.parcelaEstimada).toBeGreaterThan(0);
  });
});
