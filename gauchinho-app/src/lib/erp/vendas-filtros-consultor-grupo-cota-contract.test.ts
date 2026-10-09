import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("Filtros avançados de Vendas: Consultor, Grupo e Cota", () => {
  const vendasView = read("src/components/erp/vendas/erp-vendas-hub-view.tsx");

  it("oferece estados e seletores para Consultor, Grupo e Cota", () => {
    expect(vendasView).toContain("filtroConsultor");
    expect(vendasView).toContain("filtroGrupo");
    expect(vendasView).toContain("filtroCota");
    expect(vendasView).toContain("limparFiltros");
  });

  it("possui campos dedicados na interface com labels e placeholders adequados", () => {
    expect(vendasView).toContain("Consultor / SDR");
    expect(vendasView).toContain("Grupo");
    expect(vendasView).toContain("Número da Cota");
    expect(vendasView).toContain("Todos os consultores");
    expect(vendasView).toContain("Todos os grupos");
  });

  it("filtra as vendas e cotas respeitando os critérios selecionados", () => {
    expect(vendasView).toContain("matchPrincipal");
    expect(vendasView).toContain("matchGrupoVenda");
    expect(vendasView).toContain("matchCotaVenda");
    expect(vendasView).toContain("operacoesPorCota");
  });
});
