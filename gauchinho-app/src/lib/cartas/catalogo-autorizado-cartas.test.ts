import { describe, expect, it, vi } from "vitest";
import {
  assertEmpresaPodeAcessarCarta,
  cartaPertenceAoCatalogoAutorizado,
  fetchAuthorizedAdministradoraIdsForEmpresa,
  fetchPublicCartasAutorizadasForEmpresa,
  getCartaAutorizadaForEmpresa,
  type CatalogoCartasDeps,
} from "./catalogo-autorizado-cartas";

const RACON_UUID = "c5f8ecb4-cb5a-5014-b567-50484719b404";
const OUTRA_ADMIN_UUID = "00000000-0000-0000-0000-000000000099";
const GAUCHINHO_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "e2000000-0000-0000-0000-000000000002";

function concessaoRows(
  empresaId: string,
  vinculoStatus: "ATIVA" | "INATIVA" | "SUSPENSA" = "ATIVA",
  administradoraStatus: "ATIVA" | "INATIVA" = "ATIVA",
) {
  return [
    {
      concessao: {
        id: "conc-1",
        empresa_id: empresaId,
        administradora_id: RACON_UUID,
        status: vinculoStatus,
      },
      administradora: {
        id: RACON_UUID,
        nome: "Racon",
        nome_fantasia: "Racon Consórcios",
        razao_social: "Racon Administradora de Consórcios Ltda.",
        cnpj: null,
        slug: "racon",
        logo_url: null,
        site_url: null,
        status: administradoraStatus,
        recursos_integracao: {},
        metadata: {},
        created_at: "2026-08-08T00:00:00Z",
        updated_at: "2026-08-08T00:00:00Z",
      },
    },
  ];
}

function depsWithRows(rows: ReturnType<typeof concessaoRows> | []): CatalogoCartasDeps {
  return {
    fetchConcessoes: vi.fn().mockResolvedValue(rows),
    adminFrom: vi.fn(() => {
      throw new Error("adminFrom não deveria ser chamado sem concessão ativa");
    }),
  };
}

describe("catálogo tenant-scoped de cartas contempladas", () => {
  it("autoriza somente a Racon para a Gauchinho com concessão ATIVA + global ATIVA", async () => {
    const result = await fetchAuthorizedAdministradoraIdsForEmpresa(
      GAUCHINHO_ID,
      depsWithRows(concessaoRows(GAUCHINHO_ID)),
    );
    expect(result.adminIds).toEqual([RACON_UUID]);
    expect(result.adminNamesLower).toContain("racon");
  });

  it("Empresa B sem concessões não recebe administradoras nem consulta cartas", async () => {
    const deps = depsWithRows([]);
    await expect(fetchAuthorizedAdministradoraIdsForEmpresa(EMPRESA_B_ID, deps)).resolves.toEqual({
      adminIds: [],
      adminNamesLower: [],
    });
    await expect(fetchPublicCartasAutorizadasForEmpresa(EMPRESA_B_ID, {}, deps)).resolves.toEqual([]);
    expect(deps.adminFrom).not.toHaveBeenCalled();
  });

  it.each(["INATIVA", "SUSPENSA"] as const)(
    "concessão %s não autoriza cartas",
    async (status) => {
      const result = await fetchAuthorizedAdministradoraIdsForEmpresa(
        GAUCHINHO_ID,
        depsWithRows(concessaoRows(GAUCHINHO_ID, status)),
      );
      expect(result.adminIds).toEqual([]);
    },
  );

  it("administradora global INATIVA não autoriza cartas", async () => {
    const result = await fetchAuthorizedAdministradoraIdsForEmpresa(
      GAUCHINHO_ID,
      depsWithRows(concessaoRows(GAUCHINHO_ID, "ATIVA", "INATIVA")),
    );
    expect(result.adminIds).toEqual([]);
  });

  describe("Matriz Canônica da Função cartaPertenceAoCatalogoAutorizado (UUID-First)", () => {
    const autorizadas = { adminIds: [RACON_UUID], adminNamesLower: ["racon"] };

    it("CASO 1: administradora_id = RACON_UUID, administradora = 'RACON' (Racon autorizada) -> TRUE", () => {
      expect(
        cartaPertenceAoCatalogoAutorizado(
          { administradora_id: RACON_UUID, administradora: "RACON" },
          autorizadas,
        ),
      ).toBe(true);
    });

    it("CASO 2 (REGRESSÃO PRINCIPAL): administradora_id = OUTRA_ADMIN_UUID, administradora = 'RACON' (Racon autorizada) -> FALSE (Bypass de texto bloqueado)", () => {
      expect(
        cartaPertenceAoCatalogoAutorizado(
          { administradora_id: OUTRA_ADMIN_UUID, administradora: "RACON" },
          autorizadas,
        ),
      ).toBe(false);
    });

    it("CASO 3: administradora_id = OUTRA_ADMIN_UUID, administradora = 'OUTRA' (Racon autorizada) -> FALSE", () => {
      expect(
        cartaPertenceAoCatalogoAutorizado(
          { administradora_id: OUTRA_ADMIN_UUID, administradora: "OUTRA" },
          autorizadas,
        ),
      ).toBe(false);
    });

    it("CASO 4: administradora_id = null, administradora = 'RACON' (Racon autorizada) -> TRUE (Fallback legado)", () => {
      expect(
        cartaPertenceAoCatalogoAutorizado(
          { administradora_id: null, administradora: "RACON" },
          autorizadas,
        ),
      ).toBe(true);
    });

    it("CASO 5: administradora_id = null, administradora = 'OUTRA' (Racon autorizada) -> FALSE", () => {
      expect(
        cartaPertenceAoCatalogoAutorizado(
          { administradora_id: null, administradora: "OUTRA" },
          autorizadas,
        ),
      ).toBe(false);
    });

    it("CASO 6: administradora_id = RACON_UUID, administradora = 'OUTRA' (Racon autorizada) -> TRUE (UUID tem precedência sobre snapshot textual para leitura)", () => {
      expect(
        cartaPertenceAoCatalogoAutorizado(
          { administradora_id: RACON_UUID, administradora: "OUTRA" },
          autorizadas,
        ),
      ).toBe(true);
    });
  });

  it("UUID inexistente e UUID cross-tenant retornam a mesma ausência para Empresa B", async () => {
    const deps = depsWithRows([]);
    await expect(getCartaAutorizadaForEmpresa(EMPRESA_B_ID, "carta-racon", deps)).resolves.toBeNull();
    await expect(getCartaAutorizadaForEmpresa(EMPRESA_B_ID, "carta-inexistente", deps)).resolves.toBeNull();
  });

  it("assert público usa erro NOT_FOUND uniforme", async () => {
    await expect(
      assertEmpresaPodeAcessarCarta(EMPRESA_B_ID, "carta-racon", depsWithRows([])),
    ).rejects.toThrow("Carta contemplada não encontrada");
  });
});
