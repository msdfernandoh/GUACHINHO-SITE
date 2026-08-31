import { describe, expect, it } from "vitest";
import { distributeProfileSchedule, parseProfileSchedule } from "./profile-rule-schedule";

function form(rows: unknown, follow?: string) {
  const fd = new FormData();
  if (follow !== undefined) fd.set("seguir_cronograma_franquia", follow);
  fd.set("etapas_cronograma", JSON.stringify(rows));
  return fd;
}

describe("cronograma próprio do perfil", () => {
  it("distribui SDR em seis meses e conserva 100% com resíduo na última parcela", () => {
    const stages = parseProfileSchedule(form(distributeProfileSchedule(6), "false"), null);
    expect(stages.map(r => r.mes_relativo)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(stages.map(r => r.percentual_etapa)).toEqual([16.66, 16.66, 16.66, 16.66, 16.66, 16.7]);
  });
  it("permite indicador à vista no primeiro mês", () => {
    expect(parseProfileSchedule(form(distributeProfileSchedule(1)), null)).toMatchObject([
      { ordem: 1, mes_relativo: 1, percentual_etapa: 100 },
    ]);
  });
  it("checkbox ausente não herda cronograma nem inventa parcela única", () => {
    expect(() => parseProfileSchedule(new FormData(), null)).toThrow("cronograma próprio");
  });
  it("ignora etapas próprias somente quando a herança está explicitamente ativa", () => {
    expect(parseProfileSchedule(form([{ invalid: true }], "true"), null)).toEqual([]);
  });
  it("preserva valores fixos e meses personalizados ao editar", () => {
    const rows = [
      { mes_relativo: 1, valor_etapa: 500, nome: "Entrada" },
      { mes_relativo: 3, valor_etapa: 250.01, nome: "Saldo" },
    ];
    expect(parseProfileSchedule(form(rows, "false"), 750.01)).toMatchObject(rows);
    expect(() => parseProfileSchedule(form(rows), 750)).toThrow("valor fixo total");
  });
  it.each([[], [{ mes_relativo: 1, percentual_etapa: 50 }], [{ mes_relativo: 0, percentual_etapa: 100 }],
    [{ mes_relativo: 1.5, percentual_etapa: 100 }], [{ mes_relativo: 1, percentual_etapa: -100 }],
    [{ mes_relativo: 1, percentual_etapa: 50 }, { mes_relativo: 1, percentual_etapa: 50 }],
  ])("recusa cronograma inválido %#", rows => {
    expect(() => parseProfileSchedule(form(rows), null)).toThrow();
  });
  it("ordena meses sem alterar valores", () => {
    const rows = [{ mes_relativo: 6, percentual_etapa: 70 }, { mes_relativo: 1, percentual_etapa: 30 }];
    expect(parseProfileSchedule(form(rows), null).map(r => [r.ordem, r.mes_relativo, r.percentual_etapa])).toEqual([[1, 1, 30], [2, 6, 70]]);
  });
  it("recusa quantidade não inteira, excessiva ou total insuficiente", () => {
    for (const count of [0, 1.5, 361]) expect(() => distributeProfileSchedule(count)).toThrow();
    expect(() => distributeProfileSchedule(6, 0.01)).toThrow();
  });
  it("não salva uma quantidade diferente daquela informada pelo operador", () => {
    const fd = form(distributeProfileSchedule(1), "false");
    fd.set("numero_parcelas", "6");
    expect(() => parseProfileSchedule(fd, null)).toThrow("Distribuir igualmente");
  });
  it("representa 0,5% da cota como 12,5% de uma comissão de franquia de 4% e divide em seis", () => {
    const credito = 100_000;
    const comissaoFranquia = credito * 0.04;
    const totalSdr = comissaoFranquia * 0.125;
    const stages = distributeProfileSchedule(6);
    const payments = stages.map(stage => Math.round(totalSdr * stage.percentual_etapa! / 100 * 100) / 100);
    expect(totalSdr).toBe(credito * 0.005);
    expect(payments).toEqual([83.3, 83.3, 83.3, 83.3, 83.3, 83.5]);
    expect(payments.reduce((sum, value) => sum + value, 0)).toBe(500);
  });
});
