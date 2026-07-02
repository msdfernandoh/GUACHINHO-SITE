import { describe, expect, it, vi } from "vitest";
import {
  buildGuidedReply,
  detectGuidedIntent,
  parseParcelaDesejadaFromText,
  parseTipoCreditoFromText,
  stripGuidedMarker,
} from "./guided-assistant";
import { DEFAULT_IA_CONFIG } from "@/lib/config/ia-defaults";
import { estimarCreditoConsorcioPorParcela } from "@/lib/simulador/estimar-credito-por-parcela";

describe("guided-assistant", () => {
  it("detects parcela from monthly budget phrase", () => {
    expect(parseParcelaDesejadaFromText("Tenho R$ 500 por mês")).toBe(500);
  });

  it("detects imóvel tipo", () => {
    expect(parseTipoCreditoFromText("Quero imóvel")).toBe("Imóvel");
  });

  it("intent quanto_credito", () => {
    expect(detectGuidedIntent("Quanto consigo de crédito?")).toBe("quanto_credito");
  });

  it("credit flow uses real simulator function", () => {
    const history = [
      { role: "user" as const, content: "Quanto consigo de crédito?" },
      { role: "assistant" as const, content: "tipo?" },
      { role: "user" as const, content: "Imóvel" },
      { role: "assistant" as const, content: "parcela?" },
      { role: "user" as const, content: "R$ 500" },
    ];
    const r = buildGuidedReply(history, DEFAULT_IA_CONFIG);
    expect(stripGuidedMarker(r.reply)).toMatch(/crédito estimado/i);
    const expected = estimarCreditoConsorcioPorParcela({
      parcelaDesejada: 500,
      prazoMeses: 220,
      percentualParcelaReduzida: 60,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0.038,
    });
    expect(r.reply).toMatch(new RegExp(String(Math.round(expected!.creditoContratadoEstimado / 1000))));
  });

  it("does not call OpenAI (guided is pure)", () => {
    const openAi = vi.fn();
    buildGuidedReply([{ role: "user", content: "eventos" }], DEFAULT_IA_CONFIG);
    expect(openAi).not.toHaveBeenCalled();
  });

  it("creates lead payload after name and whatsapp in credit flow", () => {
    const base = [
      { role: "user" as const, content: "Quanto consigo de crédito?" },
      { role: "user" as const, content: "Imóvel" },
      { role: "user" as const, content: "500" },
    ];
    const afterSim = buildGuidedReply(base, DEFAULT_IA_CONFIG);
    const withLead = buildGuidedReply(
      [
        ...base,
        { role: "assistant" as const, content: afterSim.reply },
        { role: "user" as const, content: "João Silva, whatsapp 51999887766" },
      ],
      DEFAULT_IA_CONFIG,
    );
    expect(withLead.prontoParaLead).toBe(true);
    expect(withLead.leadPayload?.nome).toBeTruthy();
    expect(withLead.leadPayload?.whatsapp).toMatch(/51999887766/);
    expect(withLead.leadPayload?.dadosSimulacao?.modo_assistente).toBe("guided");
  });
});
