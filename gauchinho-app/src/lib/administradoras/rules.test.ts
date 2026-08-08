import { describe, expect, it } from "vitest";
import {
  EMPRESA_B_ID,
  FASE4_PERMISSOES,
  GAUCHINHO_EMPRESA_ID,
  RACON_ADMINISTRADORA_ID,
  RACON_SLUG,
} from "./constants";
import {
  concessaoPermiteUso,
  filterAdministradorasAutorizadasForEmpresa,
  normalizeAdministradoraSlug,
  papelPodeListarCatalogoGlobal,
  papelTemPermissaoFase4,
  resolveAutorizadaById,
  resolveAutorizadaBySlug,
} from "./rules";

const racon = {
  id: RACON_ADMINISTRADORA_ID,
  nome: "Racon",
  nome_fantasia: "Racon",
  slug: RACON_SLUG,
  logo_url: null,
  site_url: null,
  status: "ATIVA" as const,
};

function row(
  empresaId: string,
  adminStatus: "ATIVA" | "INATIVA",
  vinculoStatus: "ATIVA" | "INATIVA" | "SUSPENSA",
  admin = racon,
) {
  return {
    administradora: { ...admin, status: adminStatus },
    concessao: {
      id: "c1",
      empresa_id: empresaId,
      administradora_id: admin.id,
      status: vinculoStatus,
    },
  };
}

describe("terminologia / papéis Fase 4", () => {
  it("somente super_admin tem permissões do catálogo", () => {
    for (const papel of [
      "admin_empresa",
      "gestor",
      "consultor",
      "parceiro_comercial",
      "parceiro_imobiliaria",
      "visualizador",
    ]) {
      expect(papelTemPermissaoFase4(papel, FASE4_PERMISSOES.gerenciarCatalogoAdministradoras)).toBe(
        false,
      );
      expect(papelTemPermissaoFase4(papel, FASE4_PERMISSOES.gerenciarAdministradorasEmpresa)).toBe(
        false,
      );
      expect(papelPodeListarCatalogoGlobal(papel)).toBe(false);
    }
    expect(papelTemPermissaoFase4("super_admin", FASE4_PERMISSOES.gerenciarCatalogoAdministradoras)).toBe(
      true,
    );
    expect(papelPodeListarCatalogoGlobal("super_admin")).toBe(true);
  });
});

describe("concessaoPermiteUso", () => {
  it("permite só global ATIVA + vínculo ATIVA", () => {
    expect(concessaoPermiteUso("ATIVA", "ATIVA")).toBe(true);
    expect(concessaoPermiteUso("INATIVA", "ATIVA")).toBe(false);
    expect(concessaoPermiteUso("ATIVA", "INATIVA")).toBe(false);
    expect(concessaoPermiteUso("ATIVA", "SUSPENSA")).toBe(false);
    expect(concessaoPermiteUso(null, "ATIVA")).toBe(false);
  });
});

describe("listagem autorizada — Gauchinho vs Empresa B", () => {
  it("Gauchinho com Racon ATIVA retorna exatamente 1", () => {
    const list = filterAdministradorasAutorizadasForEmpresa(GAUCHINHO_EMPRESA_ID, [
      row(GAUCHINHO_EMPRESA_ID, "ATIVA", "ATIVA"),
      row(EMPRESA_B_ID, "ATIVA", "ATIVA"), // cross-tenant deve ser ignorado
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(RACON_ADMINISTRADORA_ID);
    expect(list[0]?.slug).toBe("racon");
    expect(list[0]?.concessao.empresa_id).toBe(GAUCHINHO_EMPRESA_ID);
  });

  it("Empresa B sem vínculo autorizado retorna []", () => {
    const list = filterAdministradorasAutorizadasForEmpresa(EMPRESA_B_ID, [
      row(GAUCHINHO_EMPRESA_ID, "ATIVA", "ATIVA"),
    ]);
    expect(list).toEqual([]);
  });

  it("não retorna INATIVA / SUSPENSA / global INATIVA", () => {
    expect(
      filterAdministradorasAutorizadasForEmpresa(GAUCHINHO_EMPRESA_ID, [
        row(GAUCHINHO_EMPRESA_ID, "INATIVA", "ATIVA"),
      ]),
    ).toEqual([]);
    expect(
      filterAdministradorasAutorizadasForEmpresa(GAUCHINHO_EMPRESA_ID, [
        row(GAUCHINHO_EMPRESA_ID, "ATIVA", "INATIVA"),
      ]),
    ).toEqual([]);
    expect(
      filterAdministradorasAutorizadasForEmpresa(GAUCHINHO_EMPRESA_ID, [
        row(GAUCHINHO_EMPRESA_ID, "ATIVA", "SUSPENSA"),
      ]),
    ).toEqual([]);
  });
});

describe("resolução UUID / slug com erro uniforme (via null)", () => {
  it("UUID Racon para Gauchinho ATIVA resolve", () => {
    const found = resolveAutorizadaById(GAUCHINHO_EMPRESA_ID, RACON_ADMINISTRADORA_ID, [
      row(GAUCHINHO_EMPRESA_ID, "ATIVA", "ATIVA"),
    ]);
    expect(found?.id).toBe(RACON_ADMINISTRADORA_ID);
  });

  it("UUID Racon para Empresa B → null (NOT_FOUND no service)", () => {
    expect(
      resolveAutorizadaById(EMPRESA_B_ID, RACON_ADMINISTRADORA_ID, [
        row(GAUCHINHO_EMPRESA_ID, "ATIVA", "ATIVA"),
      ]),
    ).toBeNull();
  });

  it("slug racon case-insensitive para Gauchinho", () => {
    expect(
      resolveAutorizadaBySlug(GAUCHINHO_EMPRESA_ID, "RACON", [
        row(GAUCHINHO_EMPRESA_ID, "ATIVA", "ATIVA"),
      ])?.slug,
    ).toBe("racon");
  });

  it("slug racon para Empresa B → null", () => {
    expect(
      resolveAutorizadaBySlug(EMPRESA_B_ID, "racon", [
        row(GAUCHINHO_EMPRESA_ID, "ATIVA", "ATIVA"),
      ]),
    ).toBeNull();
  });

  it("vínculo de outra empresa nunca vaza", () => {
    expect(
      resolveAutorizadaById(EMPRESA_B_ID, RACON_ADMINISTRADORA_ID, [
        row(GAUCHINHO_EMPRESA_ID, "ATIVA", "ATIVA"),
      ]),
    ).toBeNull();
  });
});

describe("normalizeAdministradoraSlug", () => {
  it("normaliza lowercase e hífens", () => {
    expect(normalizeAdministradoraSlug(" Racon ")).toBe("racon");
    expect(normalizeAdministradoraSlug("")).toBeNull();
  });
});
