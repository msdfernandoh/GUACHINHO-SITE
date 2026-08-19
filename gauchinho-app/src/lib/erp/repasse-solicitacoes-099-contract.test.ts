import { describe, it, expect } from "vitest";
import {
  normalizarPedidos,
  formatarMesReferencia,
  verificarDivergenciaValores,
  calcularValorSugeridoRecebimento,
  isElegivelParaRecebimento,
  gerarIdempotencyKeyRecebimento,
  STATUS_LABELS,
} from "./repasse-solicitacoes-helpers";

describe("ERP Solicitações de Repasse & Integração com Recebimentos (Fase 099 Contract)", () => {
  it("normaliza e deduplica pedidos em lote a partir de textarea/strings com quebras de linha e vírgulas", () => {
    const raw = `15326
    15331, 15355; 15361
    15326
    15331`;
    const resultado = normalizarPedidos(raw);
    expect(resultado).toEqual(["15326", "15331", "15355", "15361"]);
  });

  it("formata o mês de referência de YYYY-MM para NomeDoMês/YYYY", () => {
    expect(formatarMesReferencia("2026-07")).toBe("Julho/2026");
    expect(formatarMesReferencia("2026-01")).toBe("Janeiro/2026");
    expect(formatarMesReferencia("2026-12")).toBe("Dezembro/2026");
  });

  it("detecta divergência entre o valor solicitado e o valor da nota fiscal", () => {
    const semDivergencia = verificarDivergenciaValores(20000, 20000);
    expect(semDivergencia.divergente).toBe(false);
    expect(semDivergencia.diferenca).toBe(0);

    const comDivergencia = verificarDivergenciaValores(20000, 19850);
    expect(comDivergencia.divergente).toBe(true);
    expect(comDivergencia.diferenca).toBe(150);

    const semNota = verificarDivergenciaValores(20000, null);
    expect(semNota.divergente).toBe(false);
  });

  it("sugere o valor da NF quando presente, ou o valor solicitado quando a NF não estiver preenchida", () => {
    expect(calcularValorSugeridoRecebimento(20000, 19850)).toBe(19850);
    expect(calcularValorSugeridoRecebimento(20000, null)).toBe(20000);
    expect(calcularValorSugeridoRecebimento(20000, 0)).toBe(20000);
  });

  it("valida a elegibilidade para registrar recebimento respeitando idempotência e status", () => {
    expect(isElegivelParaRecebimento("APROVADO", null)).toBe(true);
    expect(isElegivelParaRecebimento("SOLICITADO", null)).toBe(true);
    expect(isElegivelParaRecebimento("AGUARDANDO_RECEBIMENTO", null)).toBe(true);

    // Se já tiver recebimentoId, bloqueia novo registro (idempotência)
    expect(isElegivelParaRecebimento("APROVADO", "rec-uuid-123")).toBe(false);
    expect(isElegivelParaRecebimento("RECEBIDO", "rec-uuid-123")).toBe(false);
    expect(isElegivelParaRecebimento("CANCELADO", null)).toBe(false);
    expect(isElegivelParaRecebimento("RECUSADO", null)).toBe(false);
  });

  it("gera chave de idempotência prefixada por solicitação", () => {
    const key = gerarIdempotencyKeyRecebimento("solic-456");
    expect(key.startsWith("SOLIC-solic-456-")).toBe(true);
  });

  it("contém todos os 9 status operacionais mapeados", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(9);
    expect(STATUS_LABELS["RASCUNHO"]).toBe("Rascunho");
    expect(STATUS_LABELS["RECEBIDO"]).toBe("Recebido");
  });
});
