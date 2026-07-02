import { describe, expect, it } from "vitest";
import { formatBRL, maskBRLMoneyInput, parseBRLMoney } from "./money";

/** Intl pt-BR usa espaço fino (NBSP) após R$. */
function brl(s: string) {
  return s.replace(/\u00a0/g, " ");
}

describe("formatBRL", () => {
  it("formata milhões", () => {
    expect(brl(formatBRL(1_000_000))).toBe("R$ 1.000.000,00");
  });
});

describe("parseBRLMoney", () => {
  it("parse formatado", () => {
    expect(parseBRLMoney("R$ 1.000.000,00")).toBe(1_000_000);
    expect(parseBRLMoney("1000000,00")).toBe(1_000_000);
    expect(parseBRLMoney("1.000.000,00")).toBe(1_000_000);
  });

  it("vazio e inválido", () => {
    expect(parseBRLMoney("")).toBeNull();
    expect(parseBRLMoney("abc")).toBeNull();
  });

  it("dígitos como centavos", () => {
    expect(parseBRLMoney("100000")).toBe(1000);
  });
});

describe("maskBRLMoneyInput", () => {
  it("escala centavos", () => {
    expect(brl(maskBRLMoneyInput("1"))).toBe("R$ 0,01");
    expect(brl(maskBRLMoneyInput("10"))).toBe("R$ 0,10");
    expect(brl(maskBRLMoneyInput("100"))).toBe("R$ 1,00");
    expect(brl(maskBRLMoneyInput("100000"))).toBe("R$ 1.000,00");
    expect(brl(maskBRLMoneyInput("100000000"))).toBe("R$ 1.000.000,00");
  });
});
