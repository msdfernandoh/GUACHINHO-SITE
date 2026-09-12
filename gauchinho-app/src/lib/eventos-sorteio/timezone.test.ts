import { describe, expect, it } from "vitest";
import {
  EVENTO_TIME_ZONE,
  eventoLocalDateTimeToIso,
  eventoIsoToDatetimeLocal,
  formatarDataHoraEvento,
  formatarHoraEvento,
  formatarDataEvento,
} from "./timezone";

describe("eventos timezone (America/Cuiaba)", () => {
  it("tem America/Cuiaba como timezone oficial da operacao", () => {
    expect(EVENTO_TIME_ZONE).toBe("America/Cuiaba");
  });

  const testCases = [
    { input: "2026-09-16T18:30", expectedDisplay: "16/09/2026 às 18:30", expectedUtc: "2026-09-16T22:30:00.000Z" },
    { input: "2026-09-16T08:00", expectedDisplay: "16/09/2026 às 08:00", expectedUtc: "2026-09-16T12:00:00.000Z" },
    { input: "2026-09-16T23:30", expectedDisplay: "16/09/2026 às 23:30", expectedUtc: "2026-09-17T03:30:00.000Z" },
    { input: "2027-01-01T00:15", expectedDisplay: "01/01/2027 às 00:15", expectedUtc: "2027-01-01T04:15:00.000Z" },
  ];

  for (const tc of testCases) {
    it(`converte e preserva perfeitamente ${tc.input}`, () => {
      const iso = eventoLocalDateTimeToIso(tc.input);
      expect(iso).toBe(tc.expectedUtc);

      const localUi = eventoIsoToDatetimeLocal(iso);
      expect(localUi).toBe(tc.input);

      const display = formatarDataHoraEvento(iso);
      expect(display).toBe(tc.expectedDisplay);
    });

    it(`garante idempotência no duplo salvamento de ${tc.input}`, () => {
      // 1º salvamento
      const iso1 = eventoLocalDateTimeToIso(tc.input);
      const ui1 = eventoIsoToDatetimeLocal(iso1);

      // 2º salvamento com o valor da UI reaberto
      const iso2 = eventoLocalDateTimeToIso(ui1);
      const ui2 = eventoIsoToDatetimeLocal(iso2);

      expect(iso2).toBe(iso1);
      expect(ui2).toBe(ui1);
      expect(ui2).toBe(tc.input);
    });
  }

  it("trata valores nulos e vazios com seguranca", () => {
    expect(eventoLocalDateTimeToIso("")).toBe(null);
    expect(eventoLocalDateTimeToIso(null)).toBe(null);
    expect(eventoLocalDateTimeToIso(undefined)).toBe(null);

    expect(eventoIsoToDatetimeLocal("")).toBe("");
    expect(eventoIsoToDatetimeLocal(null)).toBe("");
    expect(eventoIsoToDatetimeLocal(undefined)).toBe("");

    expect(formatarDataHoraEvento(null)).toBe("—");
    expect(formatarHoraEvento(null)).toBe("—");
    expect(formatarDataEvento(null)).toBe("—");
  });

  it("formata hora e data separadamente", () => {
    const iso = eventoLocalDateTimeToIso("2026-09-16T18:30");
    expect(formatarHoraEvento(iso)).toBe("18:30");
    expect(formatarDataEvento(iso)).toBe("16/09/2026");
  });
});
