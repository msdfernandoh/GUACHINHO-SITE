import { describe, expect, it } from "vitest";
import { agendaAllDayRange, agendaLocalDateTimeToIso, agendaDateKey, agendaFormRange } from "./timezone";

describe("fuso da Agenda", () => {
  it("interpreta 15h em Cuiabá como 19h UTC", () => {
    expect(agendaLocalDateTimeToIso("2026-09-16", "15:00")).toBe("2026-09-16T19:00:00.000Z");
  });

  it("preserva um dia inteiro civil de Cuiabá", () => {
    expect(agendaAllDayRange("2026-09-16")).toEqual({
      inicio: "2026-09-16T04:00:00.000Z",
      fim: "2026-09-17T04:00:00.000Z",
    });
  });
  it.each([["2026-02-30", "15:00"], ["2026-09-16", "24:00"], ["2026-09-16", "15:60"], ["2026-13-01", "15:00"]])("rejeita data/hora inválida: %s %s", (date, time) => {
    expect(() => agendaLocalDateTimeToIso(date, time)).toThrow();
  });
  it("exibe a data civil correta perto da meia-noite UTC", () => {
    expect(agendaDateKey("2026-09-17T02:30:00Z")).toBe("2026-09-16");
  });
  it("aceita 1h30 e preserva duração legada", () => {
    const form = new FormData(); form.set("data", "2026-09-16"); form.set("hora", "15:00");
    form.set("duracao_minutos", "90"); expect(agendaFormRange(form).duracao).toBe(90);
    form.set("duracao_horas", "1"); form.set("duracao_minutos_restantes", "30");
    expect(agendaFormRange(form)).toMatchObject({ inicio: "2026-09-16T19:00:00.000Z", fim: "2026-09-16T20:30:00.000Z", duracao: 90 });
  });
  it("rejeita duração zero e minutos acima de 59", () => {
    const form = new FormData(); form.set("data", "2026-09-16"); form.set("hora", "15:00");
    form.set("duracao_horas", "0"); form.set("duracao_minutos_restantes", "0"); expect(() => agendaFormRange(form)).toThrow();
    form.set("duracao_minutos_restantes", "60"); expect(() => agendaFormRange(form)).toThrow();
  });
});
