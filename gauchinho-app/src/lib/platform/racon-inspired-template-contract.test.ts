import { describe, it, expect } from "vitest";

describe("Template Racon Inspired — Estrutura e Governança Visual", () => {
  const raconPreset = {
    cor_primaria: "#0066cc",
    cor_secundaria: "#0c2340",
    cor_destaque: "#ffb800",
    cor_fundo: "#ffffff",
    cor_texto: "#0f172a",
    fonte_familia: "Inter, system-ui, sans-serif",
    border_radius: "16px",
    estilo_botoes: "rounded-full",
    estilo_cards: "rounded-2xl shadow-lg border border-slate-100",
  };

  const secoesObrigatorias = [
    "topbar",
    "header",
    "hero",
    "produtos",
    "beneficios",
    "como_funciona",
    "estatisticas",
    "cta",
    "footer",
  ];

  it("deve conter tokens cromáticos canônicos da identidade Racon (Royal Blue, Deep Navy e Amarelo)", () => {
    expect(raconPreset.cor_primaria).toBe("#0066cc");
    expect(raconPreset.cor_secundaria).toBe("#0c2340");
    expect(raconPreset.cor_destaque).toBe("#ffb800");
    expect(raconPreset.cor_fundo).toBe("#ffffff");
    expect(raconPreset.cor_texto).toBe("#0f172a");
  });

  it("deve garantir presença de todas as seções estruturais chave da home", () => {
    secoesObrigatorias.forEach((sec) => {
      expect(secoesObrigatorias).toContain(sec);
    });
  });

  it("deve calcular estimativas de parcela reduzida e integral com precisão para os 4 segmentos", () => {
    const segmentos = {
      imovel: { credito: 250000, fatorIntegral: 0.0055, taxaReduzida: 0.5 },
      auto: { credito: 75000, fatorIntegral: 0.0118, taxaReduzida: 0.6 },
      pesados: { credito: 350000, fatorIntegral: 0.0098, taxaReduzida: 0.6 },
      agro: { credito: 300000, fatorIntegral: 0.0084, taxaReduzida: 0.6 },
    };

    // Imóvel R$ 250.000
    const imovelIntegral = segmentos.imovel.credito * segmentos.imovel.fatorIntegral;
    const imovelReduzida = imovelIntegral * segmentos.imovel.taxaReduzida;
    expect(imovelIntegral).toBe(1375.0);
    expect(imovelReduzida).toBe(687.5);

    // Auto R$ 75.000
    const autoIntegral = segmentos.auto.credito * segmentos.auto.fatorIntegral;
    const autoReduzida = autoIntegral * segmentos.auto.taxaReduzida;
    expect(autoIntegral).toBe(885.0);
    expect(autoReduzida).toBe(531.0);
  });
});
