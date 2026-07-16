import { describe, expect, it } from "vitest";
import {
  calcularCicloGrupoDatas,
  calcularPrazoGrupo,
  grupoPrecisaReajusteCredito,
  mesesDecorridosCicloMensal,
  milestoneReajusteMeses,
} from "@/lib/grupos/prazos";

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

describe("calcularCicloGrupoDatas", () => {
  it("calcula início e término a partir da base e prazo total", () => {
    const r = calcularCicloGrupoDatas({
      quantidade_cotas_sorteio: 999,
      data_base_parcelas: "2026-06-16",
      parcelas_realizadas_base: 25,
      parcelas_realizadas: 25,
      prazo_total: 100,
    });
    expect(r.participantes).toBe(999);
    expect(r.dataPrimeiraAssembleia).toBe("2024-05-16");
    expect(r.dataTerminoGrupo).toBe("2032-09-16");
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

describe("reajuste crédito a cada 12 meses", () => {
  it("marca marcos 12/24/36", () => {
    expect(milestoneReajusteMeses(11)).toBe(0);
    expect(milestoneReajusteMeses(12)).toBe(12);
    expect(milestoneReajusteMeses(23)).toBe(12);
    expect(milestoneReajusteMeses(24)).toBe(24);
    expect(milestoneReajusteMeses(36)).toBe(36);
  });

  it("pede reajuste só se o marco ainda não foi marcado", () => {
    expect(grupoPrecisaReajusteCredito(12, 0)).toBe(true);
    expect(grupoPrecisaReajusteCredito(12, 12)).toBe(false);
    expect(grupoPrecisaReajusteCredito(24, 12)).toBe(true);
    expect(grupoPrecisaReajusteCredito(24, 24)).toBe(false);
    expect(grupoPrecisaReajusteCredito(11, 0)).toBe(false);
  });
});
