import { describe, expect, it } from "vitest";
import { formatWhatsappBrInput, formatWhatsappIntlInput } from "./format";

describe("formatWhatsappIntlInput", () => {
  it("mantém a máscara brasileira sem DDI", () => {
    expect(formatWhatsappIntlInput("66996086030")).toBe(formatWhatsappBrInput("66996086030"));
  });

  it("formata número dos EUA sem confundir com DDD", () => {
    expect(formatWhatsappIntlInput("+1 4075551234")).toBe("+1 (407) 555-1234");
    expect(formatWhatsappIntlInput("+14075551234")).toBe("+1 (407) 555-1234");
  });

  it("aceita +55 com máscara brasileira", () => {
    expect(formatWhatsappIntlInput("+55 66996086030")).toBe("+55 (66) 99608-6030");
  });
});
