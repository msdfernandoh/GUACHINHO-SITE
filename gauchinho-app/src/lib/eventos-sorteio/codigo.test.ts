import { describe, expect, it } from "vitest";
import { formatCodigoParticipacao, parseCodigoSequencia, proximoCodigoFromExisting } from "./codigo";

describe("formatCodigoParticipacao", () => {
  it("formata com padding de 4 dígitos", () => {
    expect(formatCodigoParticipacao(1)).toBe("GCH-0001");
    expect(formatCodigoParticipacao(47)).toBe("GCH-0047");
    expect(formatCodigoParticipacao(9999)).toBe("GCH-9999");
  });
});

describe("proximoCodigoFromExisting", () => {
  it("incrementa a partir do maior código existente", () => {
    expect(proximoCodigoFromExisting(["GCH-0001", "GCH-0003", "GCH-0002"])).toBe("GCH-0004");
    expect(proximoCodigoFromExisting([])).toBe("GCH-0001");
  });

  it("ignora códigos fora do padrão", () => {
    expect(proximoCodigoFromExisting(["EVT-0005", "GCH-0010"])).toBe("GCH-0011");
  });
});

describe("parseCodigoSequencia", () => {
  it("parseia GCH-nnnn", () => {
    expect(parseCodigoSequencia("GCH-0047")).toBe(47);
    expect(parseCodigoSequencia("gch-0001")).toBe(1);
    expect(parseCodigoSequencia("X-1")).toBeNull();
  });
});
