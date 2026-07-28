import { describe, expect, it } from "vitest";
import { formatDisponibilidadeResumo } from "./disponibilidade";

describe("formatDisponibilidadeResumo", () => {
  it("formata dias e horários", () => {
    expect(
      formatDisponibilidadeResumo([
        { dia_semana: 1, hora_inicio: "09:00", hora_fim: "12:00", ativo: true },
        { dia_semana: 1, hora_inicio: "14:00", hora_fim: "18:00", ativo: true },
        { dia_semana: 3, hora_inicio: "10:00", hora_fim: "16:00", ativo: true },
      ]),
    ).toBe("Seg 09:00–12:00, 14:00–18:00 · Qua 10:00–16:00");
  });

  it("inclui observação", () => {
    expect(
      formatDisponibilidadeResumo(
        [{ dia_semana: 5, hora_inicio: "09:00", hora_fim: "12:00", ativo: true }],
        "Só manhã",
      ),
    ).toContain("Só manhã");
  });
});
