import { describe, expect, it } from "vitest";
import { parsePercentualParcela, parseValorMonetario } from "./fechamento";

describe("parseValorMonetario", () => {
  it("parses BR format", () => {
    expect(parseValorMonetario("150.000,50")).toBe(150000.5);
    expect(parseValorMonetario("850")).toBe(850);
  });
});

describe("parsePercentualParcela", () => {
  it("accepts 1-100", () => {
    expect(parsePercentualParcela("60")).toBe(60);
    expect(parsePercentualParcela("0")).toBeNull();
    expect(parsePercentualParcela("101")).toBeNull();
  });
});
