import { describe, expect, it } from "vitest";
import {
  normalizarPrefixoSorteio,
  formatarExemploPrefixo,
  detectarModeloAtivo,
  MODELOS_IDENTIDADE_EVENTO,
} from "./modelos-identidade";

describe("modelos-identidade e prefixo de sorteio", () => {
  it("normaliza prefixos sem hífen adicionando hífen no final", () => {
    expect(normalizarPrefixoSorteio("ING")).toBe("ING-");
    expect(normalizarPrefixoSorteio("rcn")).toBe("RCN-");
    expect(normalizarPrefixoSorteio("gch-")).toBe("GCH-");
    expect(normalizarPrefixoSorteio("gch---")).toBe("GCH-");
    expect(normalizarPrefixoSorteio("")).toBe("");
    expect(normalizarPrefixoSorteio("   ")).toBe("");
    expect(normalizarPrefixoSorteio(null)).toBe("");
    expect(normalizarPrefixoSorteio(undefined)).toBe("");
  });

  it("formata exemplos de números da sorte para a prévia", () => {
    expect(formatarExemploPrefixo("ING")).toBe("ING-001");
    expect(formatarExemploPrefixo("ING-", 27)).toBe("ING-027");
    expect(formatarExemploPrefixo("", 1)).toBe("001");
    expect(formatarExemploPrefixo(null, 5)).toBe("005");
  });

  it("detecta modelo Racon e Gauchinho", () => {
    expect(detectarModeloAtivo("/racon/logoracon.jpg", "#0066cc")).toBe("racon");
    expect(detectarModeloAtivo("/media/gauchinho-logo.png", "#c9a84c")).toBe("gauchinho");
    expect(detectarModeloAtivo(null, "#c9a84c")).toBe("gauchinho");
    expect(detectarModeloAtivo("https://custom.com/logo.png", "#123456")).toBe("personalizado");
    expect(detectarModeloAtivo(null, null)).toBe(null);
  });

  it("contém modelos oficiais de Racon e Gauchinho com logos válidos", () => {
    expect(MODELOS_IDENTIDADE_EVENTO.racon.logoUrl).toBe("/racon/logoracon.jpg");
    expect(MODELOS_IDENTIDADE_EVENTO.racon.corPrimaria).toBe("#0066cc");
    expect(MODELOS_IDENTIDADE_EVENTO.gauchinho.logoUrl).toBe("/media/gauchinho-logo.png");
    expect(MODELOS_IDENTIDADE_EVENTO.gauchinho.corPrimaria).toBe("#c9a84c");
  });
});
