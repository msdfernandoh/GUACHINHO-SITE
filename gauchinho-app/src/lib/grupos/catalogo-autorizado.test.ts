import { describe, expect, it } from "vitest";
import {
  EMPRESA_B_ID,
  GAUCHINHO_EMPRESA_ID,
  RACON_ADMINISTRADORA_ID,
} from "@/lib/administradoras/constants";
import {
  assertCotaDoGrupo,
  assertGrupoAutorizadoPorIds,
  filterAdministradoraIdsAutorizadas,
  grupoElegivelCatalogo,
  parseSelecoesGrupoFromDadosSimulacao,
  resolveEmpresaIdForCatalog,
  throwGrupoNotFound,
  GRUPO_NOT_FOUND_MESSAGE,
} from "./catalogo-autorizado";
import { listAdministradoraIdsAutorizadasForEmpresa, listGruposAutorizadosForEmpresa, getGrupoAutorizadoForEmpresa, assertDadosSimulacaoGruposAutorizadosForEmpresa } from "./catalogo-autorizado-service";

describe("resolveEmpresaIdForCatalog", () => {
  it("aceita UUID real", () => {
    expect(
      resolveEmpresaIdForCatalog({ empresaId: EMPRESA_B_ID, slug: "empresa-b" }),
    ).toBe(EMPRESA_B_ID);
  });

  it("mapeia synthetic Gauchinho por slug confiável do proxy", () => {
    expect(
      resolveEmpresaIdForCatalog({
        empresaId: "dev-gauchinho-synthetic",
        slug: "gauchinho",
      }),
    ).toBe(GAUCHINHO_EMPRESA_ID);
  });

  it("não mapeia synthetic de outro slug", () => {
    expect(
      resolveEmpresaIdForCatalog({
        empresaId: "dev-empresa-b-synthetic",
        slug: "empresa-b",
      }),
    ).toBeNull();
  });

  it("ignora empresa_id arbitrário não-UUID sem slug gauchinho", () => {
    expect(
      resolveEmpresaIdForCatalog({ empresaId: "forjado", slug: "empresa-b" }),
    ).toBeNull();
  });
});

describe("filterAdministradoraIdsAutorizadas", () => {
  it("exige global ATIVA e vínculo ATIVA", () => {
    expect(
      filterAdministradoraIdsAutorizadas([
        {
          administradora_id: RACON_ADMINISTRADORA_ID,
          status: "ATIVA",
          administradora_status: "ATIVA",
        },
        {
          administradora_id: "other",
          status: "SUSPENSA",
          administradora_status: "ATIVA",
        },
        {
          administradora_id: "inactive-global",
          status: "ATIVA",
          administradora_status: "INATIVA",
        },
      ]),
    ).toEqual([RACON_ADMINISTRADORA_ID]);
  });
});

describe("assertGrupoAutorizadoPorIds", () => {
  const allowed = new Set([RACON_ADMINISTRADORA_ID]);

  it("aceita grupo Racon elegível", () => {
    expect(() =>
      assertGrupoAutorizadoPorIds(
        {
          id: "g1",
          ativo: true,
          status: "Disponível",
          administradora_id: RACON_ADMINISTRADORA_ID,
        },
        allowed,
      ),
    ).not.toThrow();
  });

  it("nega grupo sem concessão (Empresa B)", () => {
    expect(() =>
      assertGrupoAutorizadoPorIds(
        {
          id: "g1",
          ativo: true,
          status: "Disponível",
          administradora_id: RACON_ADMINISTRADORA_ID,
        },
        new Set(),
      ),
    ).toThrow(GRUPO_NOT_FOUND_MESSAGE);
  });

  it("nega grupo inexistente e não autorizado com mesma mensagem", () => {
    try {
      throwGrupoNotFound();
    } catch (a) {
      try {
        assertGrupoAutorizadoPorIds(null, allowed);
      } catch (b) {
        expect((a as Error).message).toBe((b as Error).message);
      }
    }
  });

  it("não usa texto legado como autorização", () => {
    expect(
      grupoElegivelCatalogo({
        ativo: true,
        status: "Disponível",
        administradora_id: null,
      }),
    ).toBe(false);
  });
});

describe("assertCotaDoGrupo", () => {
  it("nega cota de outro grupo", () => {
    expect(() =>
      assertCotaDoGrupo(
        { id: "c1", grupo_id: "g2", ativo: true, status: "Disponível" },
        "g1",
      ),
    ).toThrow(/Cota não encontrada/);
  });
});

describe("parseSelecoesGrupoFromDadosSimulacao", () => {
  it("extrai grupoId/cotaId do payload público", () => {
    expect(
      parseSelecoesGrupoFromDadosSimulacao({
        selecoes: [{ grupoId: "g1", cotaId: "c1" }],
      }),
    ).toEqual([{ grupoId: "g1", cotaId: "c1" }]);
  });

  it("aceita objetos aninhados grupo/cota", () => {
    expect(
      parseSelecoesGrupoFromDadosSimulacao({
        selecoes: [{ grupo: { id: "g2" }, cota: { id: "c2" } }],
      }),
    ).toEqual([{ grupoId: "g2", cotaId: "c2" }]);
  });
});

describe("assertDadosSimulacaoGruposAutorizadosForEmpresa", () => {
  it("Empresa B com grupo Racon → NOT_FOUND", async () => {
    const deps = {
      fetchConcessoes: async () => [],
      adminFrom: () => {
        throw new Error("admin não deve ser chamado");
      },
    };
    await expect(
      assertDadosSimulacaoGruposAutorizadosForEmpresa(
        EMPRESA_B_ID,
        { selecoes: [{ grupoId: "g-racon", cotaId: "c1" }] },
        deps,
      ),
    ).rejects.toThrow(GRUPO_NOT_FOUND_MESSAGE);
  });
});

describe("getGrupoAutorizadoForEmpresa (mock)", () => {
  it("Empresa B → NOT_FOUND para UUID Racon", async () => {
    const deps = {
      fetchConcessoes: async () => [],
      adminFrom: () => {
        throw new Error("admin não deve ser chamado sem concessão");
      },
    };
    await expect(getGrupoAutorizadoForEmpresa(EMPRESA_B_ID, "any-grupo", deps)).rejects.toThrow(
      GRUPO_NOT_FOUND_MESSAGE,
    );
  });
});

describe("catalogo service — Empresa B / Gauchinho (mock)", () => {
  it("Empresa B sem concessão → [] e grupo Racon NOT_FOUND", async () => {
    const deps = {
      fetchConcessoes: async () => [],
      adminFrom: () => {
        throw new Error("admin não deve ser chamado sem concessão");
      },
    };
    await expect(listAdministradoraIdsAutorizadasForEmpresa(EMPRESA_B_ID, deps)).resolves.toEqual(
      [],
    );
    await expect(listGruposAutorizadosForEmpresa(EMPRESA_B_ID, undefined, deps)).resolves.toEqual(
      [],
    );
  });

  it("Gauchinho com Racon ATIVA → ids autorizados", async () => {
    const deps = {
      fetchConcessoes: async () => [
        {
          concessao: {
            id: "v1",
            empresa_id: GAUCHINHO_EMPRESA_ID,
            administradora_id: RACON_ADMINISTRADORA_ID,
            status: "ATIVA" as const,
          },
          administradora: {
            id: RACON_ADMINISTRADORA_ID,
            nome: "Racon",
            nome_fantasia: "Racon",
            razao_social: null,
            cnpj: null,
            slug: "racon",
            logo_url: null,
            site_url: null,
            status: "ATIVA" as const,
            recursos_integracao: {},
            metadata: {},
            created_at: "",
            updated_at: "",
          },
        },
      ],
      adminFrom: () => {
        throw new Error("não necessário neste teste");
      },
    };
    await expect(
      listAdministradoraIdsAutorizadasForEmpresa(GAUCHINHO_EMPRESA_ID, deps),
    ).resolves.toEqual([RACON_ADMINISTRADORA_ID]);
  });

  it("concessão SUSPENSA → 0 ids", async () => {
    const deps = {
      fetchConcessoes: async () => [
        {
          concessao: {
            id: "v1",
            empresa_id: GAUCHINHO_EMPRESA_ID,
            administradora_id: RACON_ADMINISTRADORA_ID,
            status: "SUSPENSA" as const,
          },
          administradora: {
            id: RACON_ADMINISTRADORA_ID,
            nome: "Racon",
            nome_fantasia: null,
            razao_social: null,
            cnpj: null,
            slug: "racon",
            logo_url: null,
            site_url: null,
            status: "ATIVA" as const,
            recursos_integracao: {},
            metadata: {},
            created_at: "",
            updated_at: "",
          },
        },
      ],
      adminFrom: () => {
        throw new Error("não necessário");
      },
    };
    await expect(
      listAdministradoraIdsAutorizadasForEmpresa(GAUCHINHO_EMPRESA_ID, deps),
    ).resolves.toEqual([]);
  });

  it("admin global INATIVA → 0 ids mesmo com vínculo ATIVA", async () => {
    const deps = {
      fetchConcessoes: async () => [
        {
          concessao: {
            id: "v1",
            empresa_id: GAUCHINHO_EMPRESA_ID,
            administradora_id: RACON_ADMINISTRADORA_ID,
            status: "ATIVA" as const,
          },
          administradora: {
            id: RACON_ADMINISTRADORA_ID,
            nome: "Racon",
            nome_fantasia: null,
            razao_social: null,
            cnpj: null,
            slug: "racon",
            logo_url: null,
            site_url: null,
            status: "INATIVA" as const,
            recursos_integracao: {},
            metadata: {},
            created_at: "",
            updated_at: "",
          },
        },
      ],
      adminFrom: () => {
        throw new Error("não necessário");
      },
    };
    await expect(
      listAdministradoraIdsAutorizadasForEmpresa(GAUCHINHO_EMPRESA_ID, deps),
    ).resolves.toEqual([]);
  });

  it("sem fallback Empresa B → Gauchinho", async () => {
    const deps = {
      fetchConcessoes: async (empresaId: string) => {
        expect(empresaId).toBe(EMPRESA_B_ID);
        return [];
      },
      adminFrom: () => {
        throw new Error("não");
      },
    };
    const ids = await listAdministradoraIdsAutorizadasForEmpresa(EMPRESA_B_ID, deps);
    expect(ids).toEqual([]);
    expect(ids).not.toContain(RACON_ADMINISTRADORA_ID);
  });
});
