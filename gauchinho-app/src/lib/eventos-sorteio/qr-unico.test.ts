import { describe, expect, it } from "vitest";
import { normalizeQrSlug, periodoContemAgora } from "./qr-unico";

describe("periodoContemAgora", () => {
  it("aceita ISO com Z", () => {
    const agora = new Date("2026-07-28T12:00:00.000Z");
    expect(
      periodoContemAgora("2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z", agora),
    ).toBe(true);
  });

  it("aceita formato Postgres com espaço e offset", () => {
    const agora = new Date("2026-07-28T12:00:00.000Z");
    expect(
      periodoContemAgora("2026-07-01 00:00:00+00", "2026-08-01 00:00:00+00", agora),
    ).toBe(true);
  });

  it("rejeita fora do período", () => {
    const agora = new Date("2026-09-01T12:00:00.000Z");
    expect(
      periodoContemAgora("2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z", agora),
    ).toBe(false);
  });
});

describe("normalizeQrSlug", () => {
  it("normaliza slug", () => {
    expect(normalizeQrSlug("Sinop 2026")).toMatch(/sinop/);
  });
});
