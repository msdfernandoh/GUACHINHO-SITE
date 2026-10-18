import { describe, expect, it } from "vitest";
import { chaveGrupoFiltro, listarGruposFiltro } from "./vendas-filtro-grupos";

describe("filtro de grupos de vendas", () => {
  it("reúne código legado e nome do catálogo pelo UUID", () => {
    expect(listarGruposFiltro([
      { grupo_id: "grupo-imovel", codigo: "001443" },
      { grupo_id: "grupo-imovel", codigo: "1443 IMÓVEL" },
      { grupo_id: "grupo-auto", codigo: "005288" },
      { grupo_id: "grupo-auto", codigo: "5288 VEÍCULO" },
    ])).toEqual([
      { id: "grupo-imovel", nome: "1443 IMÓVEL" },
      { id: "grupo-auto", nome: "5288 VEÍCULO" },
    ]);
    expect(chaveGrupoFiltro("grupo-auto", "005288"))
      .toBe(chaveGrupoFiltro("grupo-auto", "5288 VEÍCULO"));
  });

  it("preserva grupos de número igual com UUIDs distintos", () => {
    expect(listarGruposFiltro([
      { grupo_id: "veiculo", codigo: "5388 VEÍCULO" },
      { grupo_id: "moto", codigo: "5388 MOTO" },
    ])).toHaveLength(2);
  });

  it("normaliza zeros e espaços em códigos sem UUID sem remover o tipo", () => {
    expect(listarGruposFiltro([
      { codigo: "001061" }, { codigo: " 1061 " }, { codigo: null },
    ])).toEqual([{ id: "1061", nome: "1061" }]);
    expect(chaveGrupoFiltro(null, "5388 MOTO"))
      .not.toBe(chaveGrupoFiltro(null, "5388 VEÍCULO"));
  });
});
