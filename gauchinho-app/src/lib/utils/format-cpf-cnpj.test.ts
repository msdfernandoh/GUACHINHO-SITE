import { describe, expect, it } from "vitest";
import { formatCnpjBrInput, formatCpfBrInput, formatWhatsappBrInput } from "./format";

describe("máscaras BR — proposta", () => {
  it("CPF", () => {
    expect(formatCpfBrInput("52998224725")).toBe("529.982.247-25");
  });

  it("CNPJ", () => {
    expect(formatCnpjBrInput("04252011000110")).toBe("04.252.011/0001-10");
  });

  it("telefone celular", () => {
    expect(formatWhatsappBrInput("51999887766")).toBe("(51) 99988-7766");
  });
});
