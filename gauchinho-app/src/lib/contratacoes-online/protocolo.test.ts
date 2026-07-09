import { describe, expect, it } from "vitest";
import { formatProtocoloFromSequence, parseProtocoloNumber } from "./protocolo";

describe("protocolo contratacao", () => {
  it("formata sequência com padding", () => {
    expect(formatProtocoloFromSequence(123)).toBe("GCH-CTR-000123");
    expect(formatProtocoloFromSequence(1)).toBe("GCH-CTR-000001");
  });

  it("parseia protocolo válido", () => {
    expect(parseProtocoloNumber("GCH-CTR-000123")).toBe(123);
    expect(parseProtocoloNumber("invalid")).toBeNull();
  });
});
