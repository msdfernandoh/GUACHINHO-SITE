import { describe, expect, it } from "vitest";
import {
  calcularPalavraChave,
  validarPrimeiroPremio,
  validarQuantidadeCotas,
} from "./calcular-palavra-chave";

describe("calcularPalavraChave", () => {
  it("80246 com 2000 retorna 246 (exemplo veículo)", () => {
    expect(calcularPalavraChave("80246", 2000)).toBe(246);
  });

  it("95866 com 999 retorna 961", () => {
    expect(calcularPalavraChave("95866", 999)).toBe(961);
  });

  it("01234 com 999 retorna 235", () => {
    expect(calcularPalavraChave("01234", 999)).toBe(235);
  });

  it("00007 com 999 retorna 7", () => {
    expect(calcularPalavraChave("00007", 999)).toBe(7);
  });

  it("00000 com 999 retorna 0", () => {
    expect(calcularPalavraChave("00000", 999)).toBe(0);
  });

  it("rejeita 1234", () => {
    expect(() => calcularPalavraChave("1234", 999)).toThrow(/5 dígitos/);
  });

  it("rejeita 123456", () => {
    expect(() => calcularPalavraChave("123456", 999)).toThrow(/5 dígitos/);
  });

  it("rejeita abcde", () => {
    expect(() => calcularPalavraChave("abcde", 999)).toThrow(/5 dígitos/);
  });

  it("rejeita 12a34", () => {
    expect(() => calcularPalavraChave("12a34", 999)).toThrow(/5 dígitos/);
  });

  it("rejeita 95.866", () => {
    expect(validarPrimeiroPremio("95.866")).toBe(false);
  });

  it("rejeita 95-866", () => {
    expect(validarPrimeiroPremio("95-866")).toBe(false);
  });

  it("rejeita vazio", () => {
    expect(validarPrimeiroPremio("")).toBe(false);
  });

  it("rejeita quantidade 0", () => {
    expect(validarQuantidadeCotas(0)).toBe(false);
    expect(() => calcularPalavraChave("95866", 0)).toThrow(/cotas/);
  });

  it("rejeita quantidade -1", () => {
    expect(validarQuantidadeCotas(-1)).toBe(false);
  });

  it("rejeita quantidade 10.5", () => {
    expect(validarQuantidadeCotas(10.5)).toBe(false);
  });
});
