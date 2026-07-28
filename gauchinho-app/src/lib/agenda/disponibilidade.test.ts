import { describe, expect, it } from "vitest";
import {
  formatDisponibilidadeResumo,
  gerarDatasDiaSemana,
  isDataBloqueada,
  statusDiaCalendario,
  toDateIso,
} from "./disponibilidade";

describe("formatDisponibilidadeResumo", () => {
  it("formata dias e horários semanais", () => {
    expect(
      formatDisponibilidadeResumo([
        {
          dia_semana: 1,
          data_especifica: null,
          hora_inicio: "09:00",
          hora_fim: "12:00",
          ativo: true,
          modalidade_atendimento: "ambos",
        },
        {
          dia_semana: 1,
          data_especifica: null,
          hora_inicio: "14:00",
          hora_fim: "18:00",
          ativo: true,
          modalidade_atendimento: "ambos",
        },
        {
          dia_semana: 3,
          data_especifica: null,
          hora_inicio: "10:00",
          hora_fim: "16:00",
          ativo: true,
          modalidade_atendimento: "ambos",
        },
      ]),
    ).toBe("Seg 09:00–12:00, 14:00–18:00 · Qua 10:00–16:00");
  });

  it("inclui bloqueio e modalidade", () => {
    const txt = formatDisponibilidadeResumo(
      [
        {
          dia_semana: 5,
          data_especifica: null,
          hora_inicio: "09:00",
          hora_fim: "12:00",
          ativo: true,
          modalidade_atendimento: "presencial",
        },
      ],
      "Só manhã",
      [{ data_inicio: "2099-01-10", data_fim: "2099-01-20", hora_inicio: null, hora_fim: null, motivo: "Férias" }],
      "presencial",
    );
    expect(txt).toContain("Presencial");
    expect(txt).toContain("Férias");
    expect(txt).toContain("Só manhã");
  });
});

describe("gerarDatasDiaSemana", () => {
  it("gera quartas do mês a partir de uma data fixa", () => {
    const datas = gerarDatasDiaSemana({
      diaSemana: 3,
      mesesAFrente: 0,
      aPartirDe: new Date(2026, 6, 1),
    });
    expect(datas.length).toBeGreaterThan(0);
    for (const d of datas) {
      const [y, m, day] = d.split("-").map(Number);
      expect(new Date(y!, m! - 1, day!).getDay()).toBe(3);
      expect(m).toBe(7);
    }
  });
});

describe("isDataBloqueada", () => {
  it("detecta data dentro do período", () => {
    expect(
      isDataBloqueada("2026-07-15", [
        {
          data_inicio: "2026-07-10",
          data_fim: "2026-07-20",
          hora_inicio: null,
          hora_fim: null,
          motivo: "Congresso",
        },
      ])?.motivo,
    ).toBe("Congresso");
    expect(isDataBloqueada("2026-07-21", [
      { data_inicio: "2026-07-10", data_fim: "2026-07-20", hora_inicio: null, hora_fim: null, motivo: "x" },
    ])).toBeNull();
  });
});

describe("toDateIso", () => {
  it("formata data local", () => {
    expect(toDateIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("statusDiaCalendario", () => {
  const slotSeg = {
    dia_semana: 1,
    data_especifica: null as string | null,
    hora_inicio: "09:00",
    hora_fim: "12:00",
    ativo: true,
    modalidade_atendimento: "ambos" as const,
  };

  it("prioriza bloqueio, depois compromisso, depois livre", () => {
    // 2026-07-27 = segunda
    expect(
      statusDiaCalendario({
        dataIso: "2026-07-27",
        slots: [slotSeg],
        bloqueios: [
          {
            data_inicio: "2026-07-27",
            data_fim: "2026-07-27",
            hora_inicio: null,
            hora_fim: null,
            motivo: "Folga",
          },
        ],
        temCompromisso: true,
      }),
    ).toBe("bloqueado");

    expect(
      statusDiaCalendario({
        dataIso: "2026-07-27",
        slots: [slotSeg],
        bloqueios: [],
        temCompromisso: true,
      }),
    ).toBe("compromisso");

    expect(
      statusDiaCalendario({
        dataIso: "2026-07-27",
        slots: [slotSeg],
        bloqueios: [],
        temCompromisso: false,
      }),
    ).toBe("livre");

    expect(
      statusDiaCalendario({
        dataIso: "2026-07-28",
        slots: [slotSeg],
        bloqueios: [],
        temCompromisso: false,
      }),
    ).toBe("vazio");
  });
});
