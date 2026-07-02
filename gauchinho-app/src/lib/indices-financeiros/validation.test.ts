import { describe, expect, it } from "vitest";
import { validarValoresIndiceAutomatico } from "./validation";

describe("validarValoresIndiceAutomatico", () => {
  it("rejeita CDI anual 0.05 (taxa diária indevida)", () => {
    const r = validarValoresIndiceAutomatico("cdi", { valor_anual: 0.05 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/diária|incompatível/i);
  });

  it("aceita CDI anual 14.15", () => {
    const r = validarValoresIndiceAutomatico("cdi", {
      valor_anual: 14.15,
      valor_mensal: 1.1,
    });
    expect(r.ok).toBe(true);
  });
});
