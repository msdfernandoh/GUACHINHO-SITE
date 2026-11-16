import { describe, expect, it } from "vitest";
import { modeloDoConvite, parametrosConviteModelo } from "./convite";

describe("convite por modelo", () => {
  const token = "x".repeat(32);
  it("aceita o link assinado e recusa troca de modelo", () => {
    const q = new URLSearchParams(parametrosConviteModelo(token, "MN964EWW", "GERADOR_OPORTUNIDADES"));
    expect(modeloDoConvite(token, "MN964EWW", q.get("m"), q.get("s"))).toBe("GERADOR_OPORTUNIDADES");
    expect(modeloDoConvite(token, "MN964EWW", "n", q.get("s"))).toBeNull();
    expect(modeloDoConvite("y".repeat(32), "MN964EWW", q.get("m"), q.get("s"))).toBeNull();
  });
});
