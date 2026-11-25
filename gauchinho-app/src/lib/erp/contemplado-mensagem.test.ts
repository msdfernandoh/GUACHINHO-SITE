import { describe, expect, it } from "vitest";
import { mensagemContemplacao, parcelaDaContemplacao, rotuloModalidade } from "./contemplado-mensagem";

describe("aviso de contemplação", () => {
  it("calcula a parcela pela diferença de meses", () => {
    expect(parcelaDaContemplacao("2025-10-29", "2026-11-12")).toBe(14);
    expect(parcelaDaContemplacao("2026-11-09", "2026-11-15")).toBe(1);
    expect(parcelaDaContemplacao(null, "2026-11-12")).toBeNull();
  });
  it("monta a mensagem com nome, grupo, cota, valores e parcela", () => {
    const m = mensagemContemplacao({ cliente: "JOABIS FIOROTI DOS SANTOS", grupo: "1253", cota: "652", credito: 264356, liquido: 250000, parcela: 14, modalidade: "LANCE_FIXO", data: "2026-11-12" });
    expect(m).toContain("PARABÉNS, JOABIS!");
    expect(m).toContain("Grupo *1253* · Cota *652*");
    expect(m).toContain("14ª parcela* por lance fixo");
    expect(m).toContain("Crédito líquido");
    expect(rotuloModalidade("SORTEIO")).toBe("sorteio");
  });
});
