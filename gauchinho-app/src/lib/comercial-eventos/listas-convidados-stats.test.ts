import { describe, expect, it } from "vitest";
import { countListaConvidadosItens } from "./listas-convidados-stats";

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
