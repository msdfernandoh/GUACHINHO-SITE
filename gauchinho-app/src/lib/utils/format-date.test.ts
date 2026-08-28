import { describe, expect, it } from "vitest";
import { formatDate } from "./format";

describe("formatDate", () => {
  it("formata data civil sem deslocamento de fuso horário", () => {
    expect(formatDate("1988-01-22")).toBe("22/01/1988");
  });

  it("aceita a representação de data retornada com sufixo de horário", () => {
    expect(formatDate("1988-01-22T12:00:00.000Z")).toBe("22/01/1988");
  });

  it("mantém o marcador para valor ausente", () => {
    expect(formatDate(null)).toBe("—");
  });
});
