import { describe, expect, it } from "vitest";
import { grupoEmFormacao } from "./em-formacao";

describe("grupoEmFormacao", () => {
  it("considera apenas primeira assembleia futura", () => {
    const agora = new Date("2026-09-01T12:00:00-04:00");
    expect(grupoEmFormacao("2026-09-02", agora)).toBe(true);
    expect(grupoEmFormacao("2026-09-01", agora)).toBe(false);
    expect(grupoEmFormacao("2026-08-31", agora)).toBe(false);
  });
});
