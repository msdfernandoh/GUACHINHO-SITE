import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/erp/extrato-clientes/actions", () => ({
  carregarExtratoCliente: async () => ({
    cliente: { nome: "Cliente de teste" }, hoje: "2026-11-25", historico: "12",
    cotas: Array.from({ length: 5 }, (_, i) => ({
      id: String(i), grupo: "1203", cota: String(i + 1), adesao: "2025-01-01",
      quantidade: 23, contratado: 100000, atual: 110000, valorizacao: 10000,
      percentual: 10, totalParcelas: 23000, projecao3: 146410, projecao5: 177156.1, taxa: 10,
      assembleias: Array.from({ length: 12 }, (_, mes) => ({
        numero: mes + 1, data: "2026-01-10", melhor: { modalidade: "SORTEIO", cota: "0035", distancia: 35 }, percentual: 98.83,
      })),
    })),
  }),
}));
import { GET } from "@/app/api/erp/extrato-clientes/[id]/pdf/route";

describe("PDF consolidado do cliente", () => {
  it("gera um documento PDF com várias cotas e histórico paginado", async () => {
    const resposta = await GET(new Request("https://exemplo.test/api/erp/extrato-clientes/cliente/pdf"), {
      params: Promise.resolve({ id: "cliente" }),
    });
    expect(resposta.headers.get("content-type")).toBe("application/pdf");
    const dados = Buffer.from(await resposta.arrayBuffer());
    expect(dados.subarray(0, 5).toString()).toBe("%PDF-");
    expect(dados.length).toBeGreaterThan(3000);
  });
});
