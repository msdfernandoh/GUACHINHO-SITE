import { describe, expect, it } from "vitest";
import {
  parseRecursoProprioPercentualInput,
  parseRecursoProprioValorInput,
} from "@/components/public/grupos/use-grupo-linha";

describe("parseRecursoProprioValorInput", () => {
  it("interpreta máscara BRL", () => {
    expect(parseRecursoProprioValorInput("R$ 15.000,00")).toBe(15_000);
    expect(parseRecursoProprioValorInput("1.000,50")).toBe(1000.5);
  });

  it("aceita número simples sem máscara", () => {
    expect(parseRecursoProprioValorInput("15000")).toBe(15_000);
  });
});

describe("parseRecursoProprioPercentualInput", () => {
  it("aceita vírgula decimal", () => {
    expect(parseRecursoProprioPercentualInput("10,5")).toBe(10.5);
  });
});
