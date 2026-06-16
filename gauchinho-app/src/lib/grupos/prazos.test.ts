import { describe, expect, it } from "vitest";
import { calcularPrazoGrupo, mesesDecorridosCicloMensal } from "@/lib/grupos/prazos";

describe("mesesDecorridosCicloMensal", () => {
  it("conta ciclo no mesmo dia do mês seguinte", () => {
    expect(mesesDecorridosCicloMensal("2026-06-16", "2026-07-16")).toBe(1);
  });

  it("não conta antes de completar o dia base", () => {
    expect(mesesDecorridosCicloMensal("2026-06-16", "2026-07-15")).toBe(0);
  });

  it("conta dois meses", () => {
    expect(mesesDecorridosCicloMensal("2026-06-16", "2026-08-16")).toBe(2);
  });
});

describe("calcularPrazoGrupo — automático", () => {
  const base = {
    prazoTotal: 220,
    parcelasRealizadasBase: 25,
    dataBaseParcelas: "2026-06-16",
    atualizacaoAutomatica: true,
    parcelasRealizadasManual: 0,
    prazoRestanteManual: null as number | null,
  };

  it("caso 1 — mesma data base", () => {
    const r = calcularPrazoGrupo({
      ...base,
      dataReferencia: new Date(2026, 5, 16),
    });
    expect(r.parcelasRealizadasAtuais).toBe(25);
    expect(r.prazoRestanteAtual).toBe(195);
    expect(r.modoAutomatico).toBe(true);
  });

  it("caso 2 — +1 mês completo", () => {
    const r = calcularPrazoGrupo({
      ...base,
      dataReferencia: new Date(2026, 6, 16),
    });
    expect(r.parcelasRealizadasAtuais).toBe(26);
    expect(r.prazoRestanteAtual).toBe(194);
  });

  it("caso 3 — um dia antes do ciclo", () => {
    const r = calcularPrazoGrupo({
      ...base,
      dataReferencia: new Date(2026, 6, 15),
    });
    expect(r.parcelasRealizadasAtuais).toBe(25);
    expect(r.prazoRestanteAtual).toBe(195);
  });

  it("caso 4 — não ultrapassa prazo total", () => {
    const r = calcularPrazoGrupo({
      ...base,
      parcelasRealizadasBase: 219,
      dataReferencia: new Date(2026, 7, 16),
    });
    expect(r.parcelasRealizadasAtuais).toBe(220);
    expect(r.prazoRestanteAtual).toBe(0);
  });
});

describe("calcularPrazoGrupo — manual", () => {
  it("usa prazo restante manual quando informado", () => {
    const r = calcularPrazoGrupo({
      prazoTotal: 220,
      atualizacaoAutomatica: false,
      parcelasRealizadasManual: 11,
      prazoRestanteManual: 209,
      parcelasRealizadasBase: null,
      dataBaseParcelas: null,
    });
    expect(r.parcelasRealizadasAtuais).toBe(11);
    expect(r.prazoRestanteAtual).toBe(209);
    expect(r.modoAutomatico).toBe(false);
  });

  it("calcula restante quando manual sem prazo_restante", () => {
    const r = calcularPrazoGrupo({
      prazoTotal: 220,
      atualizacaoAutomatica: false,
      parcelasRealizadasManual: 25,
      prazoRestanteManual: null,
      parcelasRealizadasBase: null,
      dataBaseParcelas: null,
    });
    expect(r.prazoRestanteAtual).toBe(195);
  });
});
