import { describe, expect, it } from "vitest";
import { renderTermosPdf } from "./termos-pdf";
// Teste em .ts: o vitest do projeto só inclui *.test.ts.

describe("PDF do termo de parceria", () => {
  it("gera o PDF com dados e aceite", async () => {
    const pdf = await renderTermosPdf({
      versao: "20261116-1400",
      texto: "CLÁUSULA 1 — Objeto.\n\nA imobiliária indica clientes da carteira SPL.\n\nCLÁUSULA 2 — Remuneração.",
      imobiliaria: { nome: "Imobiliária Teste", cnpj: "11222333000181", responsavel: "Ana", telefone: "66999990000", email: "a@b.com", modelo: "Gerador de negócios" },
      aceite: { em: "2026-11-16T14:00:00Z", versao: "20261116-1400", ip: "200.1.2.3" },
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1500);
  });
});
