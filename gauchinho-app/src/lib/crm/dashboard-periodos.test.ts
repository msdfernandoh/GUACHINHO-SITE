import { describe, expect, it } from "vitest";
import { periodosLeadsDashboard } from "./dashboard-periodos";

describe("períodos dos leads do dashboard", () => {
  it("usa o dia de Cuiabá, segunda-feira e primeiro dia do mês", () => {
    expect(periodosLeadsDashboard(new Date("2026-10-30T02:00:00Z"))).toEqual({
      dia: "2026-10-29T04:00:00.000Z", semana: "2026-10-26T04:00:00.000Z",
      mes: "2026-10-01T04:00:00.000Z", ate: "2026-10-30T02:00:00.000Z",
    });
  });
  it("semana pode começar no mês e ano anteriores", () => {
    expect(periodosLeadsDashboard(new Date("2027-01-03T15:00:00Z"))).toMatchObject({
      dia: "2027-01-03T04:00:00.000Z", semana: "2026-12-28T04:00:00.000Z", mes: "2027-01-01T04:00:00.000Z",
    });
  });
});
