import { describe, expect, it } from "vitest";
import { digitsOnlyPhone, formatWhatsappBrInput } from "./format";

describe("formatWhatsappBrInput", () => {
  it("formata celular 11 dígitos", () => {
    expect(formatWhatsappBrInput("51999887766")).toBe("(51) 99988-7766");
  });

  it("ignora caracteres não numéricos", () => {
    expect(formatWhatsappBrInput("(51) 99988-7766")).toBe("(51) 99988-7766");
  });

  it("limita a 11 dígitos", () => {
    expect(formatWhatsappBrInput("519998877661234")).toBe("(51) 99988-7766");
  });
});

describe("digitsOnlyPhone", () => {
  it("remove máscara", () => {
    expect(digitsOnlyPhone("(51) 99988-7766")).toBe("51999887766");
  });
});
