import { describe, expect, it } from "vitest";
import { formatCodigoParticipacao, parseCodigoSequencia, proximoCodigoFromExisting } from "./codigo";

describe("formatCodigoParticipacao", () => {
  it("formata com padding padrão de 3 dígitos sem prefixo", () => {
    expect(formatCodigoParticipacao(1)).toBe("001");
    expect(formatCodigoParticipacao(27)).toBe("027");
    expect(formatCodigoParticipacao(184)).toBe("184");
  });

  it("permite prefixo dinâmico (ex: RCN- ou GCH-)", () => {
    expect(formatCodigoParticipacao(1, "RCN-")).toBe("RCN-001");
    expect(formatCodigoParticipacao(47, "GCH-", 4)).toBe("GCH-0047");
  });
});

describe("parseCodigoSequencia", () => {
  it("parseia números limpos (001, 027, 184)", () => {
    expect(parseCodigoSequencia("001")).toBe(1);
    expect(parseCodigoSequencia("027")).toBe(27);
    expect(parseCodigoSequencia("184")).toBe(184);
  });

  it("parseia códigos com prefixo (GCH-0047, RCN-001)", () => {
    expect(parseCodigoSequencia("GCH-0047")).toBe(47);
    expect(parseCodigoSequencia("RCN-001")).toBe(1);
    expect(parseCodigoSequencia("gch-0001")).toBe(1);
  });
});

describe("proximoCodigoFromExisting", () => {
  it("incrementa a partir do maior código limpo", () => {
    expect(proximoCodigoFromExisting(["001", "003", "002"])).toBe("004");
    expect(proximoCodigoFromExisting([])).toBe("001");
  });

  it("funciona com prefixo customizado", () => {
    expect(proximoCodigoFromExisting(["RCN-001", "RCN-002"], "RCN-")).toBe("RCN-003");
  });

  it("lida com lista mista e calcula o próximo", () => {
    expect(proximoCodigoFromExisting(["GCH-0005", "010"])).toBe("011");
  });
});
