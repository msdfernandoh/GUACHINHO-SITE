import { describe, expect, it } from "vitest";
import { countListaConvidadosItens, resolveConvidadoPor } from "./listas-convidados-stats";

describe("resolveConvidadoPor", () => {
  it("usa consultor quando vazio", () => {
    expect(resolveConvidadoPor("", "Maria")).toBe("Maria");
    expect(resolveConvidadoPor(null, "João")).toBe("João");
  });
  it("mantém valor informado", () => {
    expect(resolveConvidadoPor("Parceiro X", "Maria")).toBe("Parceiro X");
  });
});

describe("countListaConvidadosItens", () => {
  it("conta total e status", () => {
    expect(
      countListaConvidadosItens([
        { status_presenca: "confirmado" },
        { status_presenca: "presente" },
        { status_presenca: "cancelado" },
        { status_presenca: "pendente" },
      ]),
    ).toEqual({ total: 4, confirmados: 1, presentes: 1, cancelados: 1 });
  });
});
