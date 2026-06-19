import { describe, expect, it } from "vitest";
import { DEFAULT_FINANCIAMENTO_CONFIG } from "@/lib/config/defaults";
import { simularFinanciamento } from "@/lib/simulador/financiamento";
import { entradaPadraoFinanciamento, taxaFinanciamentoEfetiva } from "@/lib/simulador/financiamento-entrada";
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
});
