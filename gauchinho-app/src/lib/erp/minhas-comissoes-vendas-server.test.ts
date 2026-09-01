import { beforeEach, describe, expect, it, vi } from "vitest";
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));
import { carregarResumoVendasMes } from "./minhas-comissoes-vendas-server";

function consulta(data: unknown[], error: unknown = null) {
  const query = { select: vi.fn(), eq: vi.fn(), or: vi.fn(), order: vi.fn(), range: vi.fn() };
  for (const method of [query.select, query.eq, query.or, query.order]) method.mockReturnValue(query);
  query.range.mockResolvedValue({ data, error });
  return query;
}

describe("consulta de vendas mensais por participante", () => {
  beforeEach(() => from.mockReset());
  it("soma vendas sem previsão de comissão e deduplica a participação na mesma venda", async () => {
    const venda = { id: "v1", valor_credito: 400000, quantidade_cotas: 2, data_venda: "2026-08-10", status: "confirmada", afeta_faturamento: true };
    const principal = consulta([venda]);
    const participacoes = consulta([{ id: "participacao", venda }]);
    from.mockReturnValueOnce(principal).mockReturnValueOnce(participacoes);
    expect(await carregarResumoVendasMes("empresa", "participante", "2026-08"))
      .toMatchObject({ valorVendido: 400000, quantidadeCotas: 2, quantidadeVendas: 1 });
    expect(principal.eq).toHaveBeenCalledWith("empresa_id", "empresa");
    expect(principal.eq).toHaveBeenCalledWith("participante_comercial_id", "participante");
    expect(participacoes.eq).toHaveBeenCalledWith("empresa_id", "empresa");
    expect(participacoes.eq).toHaveBeenCalledWith("venda.empresa_id", "empresa");
    expect(participacoes.eq).toHaveBeenCalledWith("participante_comercial_id", "participante");
    expect(principal.select).toHaveBeenCalledWith(expect.stringContaining("data_primeira_parcela"));
    expect(principal.or).toHaveBeenCalledWith(expect.stringContaining("data_primeira_parcela.gte.2026-08-01"));
    expect(participacoes.or).toHaveBeenCalledWith(expect.stringContaining("data_primeira_parcela.gte.2026-08-01"), { referencedTable: "venda" });
  });
  it("pagina os fatos sem truncar no limite de resposta", async () => {
    const vendas = Array.from({ length: 500 }, (_, i) => ({ id: String(i), valor_credito: 100, quantidade_cotas: 1, data_venda: "2026-12-01", status: "confirmada", afeta_faturamento: true }));
    const primeira = consulta(vendas);
    const segunda = consulta([{ ...vendas[0], id: "500" }]);
    from.mockReturnValueOnce(primeira).mockReturnValueOnce(segunda).mockReturnValueOnce(consulta([]));
    expect(await carregarResumoVendasMes("empresa", "participante", "2026-12"))
      .toMatchObject({ valorVendido: 50100, quantidadeCotas: 501, quantidadeVendas: 501 });
    expect(segunda.range).toHaveBeenCalledWith(500, 999);
    expect(primeira.select).toHaveBeenCalledWith(expect.stringContaining("data_primeira_parcela"));
  });
  it("não apresenta zero como se fosse ausência de vendas quando a consulta falha", async () => {
    from.mockReturnValueOnce(consulta([], { message: "falha" }));
    await expect(carregarResumoVendasMes("empresa", "participante", "2026-08")).rejects.toThrow("Não foi possível consultar");
  });
});
