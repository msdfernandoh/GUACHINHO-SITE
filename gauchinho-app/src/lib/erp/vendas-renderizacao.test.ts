import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/erp/vendas/actions", () => ({}));
import { ErpVendasHubView, type VendaItem } from "@/components/erp/vendas/erp-vendas-hub-view";

// O seletor percorre os consultores já na primeira renderização, antes de qualquer clique.
describe("renderização inicial de Vendas com dados", () => {
  it("renderiza uma venda com consultor e cota sem erro de inicialização", () => {
    const venda: VendaItem = {
      id: "venda-teste", cliente_nome: "Cliente de teste", cliente_cpf_cnpj: null,
      cliente_email: null, cliente_telefone: null, valor_credito: 100000,
      prazo: 100, parcela: 1000, status: "confirmada", data_venda: "2026-10-01",
      created_at: "2026-10-01T12:00:00Z", data_primeira_parcela: "2026-10-01",
      data_segunda_parcela: null, participante_comercial_id: "participante-teste",
      participante_secundario_id: null, participante_secundario_fracao_percentual: null,
      snapshot_venda: {},
      consultor_nome: "Consultor com acentuação", grupo_codigo: "1000",
    };
    const html = renderToStaticMarkup(React.createElement(ErpVendasHubView, {
      vendas: [venda], cotas: [{ id: "cota-teste", venda_id: venda.id,
        numero_grupo: "1000", numero_cota: "10", valor_credito: 100000,
        prazo: 100, parcela: 1000, status: "ativa", contemplada: false,
        consultor_nome: venda.consultor_nome }],
      empresaNome: "Empresa de teste", isMaster: true,
      participantes: [], vinculosPerfis: [], metas: [],
    }));
    expect(html).toContain("Cliente de teste");
    expect(html).toContain("Consultor com acentuação");
    expect(html).toContain("Controle de Boletos");
  });
});
