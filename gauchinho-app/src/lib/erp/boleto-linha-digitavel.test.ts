import { describe, expect, it } from "vitest";
import { extrairLinhaDigitavel, validarLinhaDigitavel } from "./boleto-linha-digitavel";

const linha = "00190500954014481606906809350314337370000000100";
describe("linha digitável bancária", () => {
  it("valida exemplo bancário e extrai a representação formatada", () => {
    expect(validarLinhaDigitavel(linha)).toBe(true);
    expect(extrairLinhaDigitavel("00190.50095 40144.816069 06809.350314 3 37370000000100")).toBe(linha);
  });
  it("rejeita alteração de qualquer algarismo", () => {
    for (let i = 0; i < linha.length; i++) {
      const alterada = linha.slice(0, i) + ((Number(linha[i]) + 1) % 10) + linha.slice(i + 1);
      expect(validarLinhaDigitavel(alterada), `posição ${i}`).toBe(false);
    }
  });
  it("bloqueia imagem, OCR aproximado, tamanho errado e códigos conflitantes", () => {
    expect(() => extrairLinhaDigitavel("PDF sem texto")).toThrow();
    expect(() => extrairLinhaDigitavel(linha.replace("9", "O"))).toThrow();
    expect(() => extrairLinhaDigitavel(linha + "0")).toThrow();
    expect(() => extrairLinhaDigitavel(linha + " texto " + "0".repeat(47))).toThrow();
    expect(extrairLinhaDigitavel(linha + " texto " + linha)).toBe(linha);
  });
});
