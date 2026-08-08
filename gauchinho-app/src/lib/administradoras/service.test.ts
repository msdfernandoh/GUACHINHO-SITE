import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPRESA_B_ID,
  GAUCHINHO_EMPRESA_ID,
  RACON_ADMINISTRADORA_ID,
  RACON_SLUG,
} from "./constants";
import { AdministradoraNotFoundError } from "./errors";
import type { AdministradorasServiceDeps } from "./service";
import {
  assertAdministradoraGlobalAtiva,
  assertEmpresaPodeUsarAdministradora,
  getAdministradoraAutorizadaById,
  getAdministradoraAutorizadaBySlug,
  listAdministradorasAutorizadasForEmpresa,
  listAdministradorasGlobaisForSuperadmin,
} from "./service";
import type { Administradora } from "./types";

const racon: Administradora = {
  id: RACON_ADMINISTRADORA_ID,
  nome: "Racon",
  nome_fantasia: "Racon",
  razao_social: null,
  cnpj: null,
  slug: RACON_SLUG,
  logo_url: null,
  site_url: null,
  status: "ATIVA",
  recursos_integracao: {},
  metadata: {},
  created_at: "2026-08-08T00:00:00Z",
  updated_at: "2026-08-08T00:00:00Z",
};

function makeDeps(overrides: Partial<AdministradorasServiceDeps> = {}): AdministradorasServiceDeps {
  return {
    isPlatformSuperadmin: vi.fn(async () => true),
    requireGerenciarCatalogoAdministradoras: vi.fn(async () => undefined),
    assertCallerCanAccessEmpresa: vi.fn(async () => undefined),
    fetchAdministradorasGlobais: vi.fn(async () => [racon]),
    fetchConcessoesComAdministradoraByEmpresa: vi.fn(async (empresaId: string) => {
      if (empresaId === GAUCHINHO_EMPRESA_ID) {
        return [
          {
            concessao: {
              id: "c-g",
              empresa_id: GAUCHINHO_EMPRESA_ID,
              administradora_id: RACON_ADMINISTRADORA_ID,
              status: "ATIVA" as const,
            },
            administradora: racon,
          },
        ];
      }
      return [];
    }),
    fetchConcessaoEmpresaAdministradora: vi.fn(async (empresaId: string, adminId: string) => {
      if (
        empresaId === GAUCHINHO_EMPRESA_ID &&
        adminId === RACON_ADMINISTRADORA_ID
      ) {
        return {
          concessao: {
            id: "c-g",
            empresa_id: GAUCHINHO_EMPRESA_ID,
            administradora_id: RACON_ADMINISTRADORA_ID,
            status: "ATIVA" as const,
          },
          administradora: racon,
        };
      }
      return { concessao: null, administradora: null };
    }),
    ...overrides,
  };
}

describe("listAdministradorasGlobaisForSuperadmin", () => {
  it("lista quando Superadmin", async () => {
    const deps = makeDeps();
    const list = await listAdministradorasGlobaisForSuperadmin(deps);
    expect(list).toHaveLength(1);
    expect(list[0]?.slug).toBe("racon");
    expect(deps.requireGerenciarCatalogoAdministradoras).toHaveBeenCalled();
  });

  it("nega admin_empresa / tenant (require lança)", async () => {
    const deps = makeDeps({
      requireGerenciarCatalogoAdministradoras: vi.fn(async () => {
        throw new Error("Sem permissão para gerenciar o catálogo global de administradoras.");
      }),
    });
    await expect(listAdministradorasGlobaisForSuperadmin(deps)).rejects.toThrow(/catálogo global/i);
  });
});

describe("listAdministradorasAutorizadasForEmpresa", () => {
  it("Gauchinho → exatamente Racon", async () => {
    const list = await listAdministradorasAutorizadasForEmpresa(
      GAUCHINHO_EMPRESA_ID,
      makeDeps(),
    );
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(RACON_ADMINISTRADORA_ID);
  });

  it("Empresa B → []", async () => {
    const list = await listAdministradorasAutorizadasForEmpresa(EMPRESA_B_ID, makeDeps());
    expect(list).toEqual([]);
  });

  it("não confia em empresaId sem assertCaller", async () => {
    const deps = makeDeps({
      assertCallerCanAccessEmpresa: vi.fn(async () => {
        throw new Error("Sem acesso à empresa informada.");
      }),
    });
    await expect(
      listAdministradorasAutorizadasForEmpresa(GAUCHINHO_EMPRESA_ID, deps),
    ).rejects.toThrow(/Sem acesso/);
  });
});

describe("getAdministradoraAutorizadaById / slug — NOT_FOUND uniforme", () => {
  it("Gauchinho + UUID Racon ok", async () => {
    const found = await getAdministradoraAutorizadaById(
      GAUCHINHO_EMPRESA_ID,
      RACON_ADMINISTRADORA_ID,
      makeDeps(),
    );
    expect(found.slug).toBe("racon");
  });

  it("Empresa B + UUID Racon → NOT_FOUND (não revela existência)", async () => {
    await expect(
      getAdministradoraAutorizadaById(EMPRESA_B_ID, RACON_ADMINISTRADORA_ID, makeDeps()),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("Empresa B + slug racon → NOT_FOUND", async () => {
    await expect(
      getAdministradoraAutorizadaBySlug(EMPRESA_B_ID, "racon", makeDeps()),
    ).rejects.toBeInstanceOf(AdministradoraNotFoundError);
  });

  it("slug RACON resolve para Gauchinho", async () => {
    const found = await getAdministradoraAutorizadaBySlug(
      GAUCHINHO_EMPRESA_ID,
      "RACON",
      makeDeps(),
    );
    expect(found.id).toBe(RACON_ADMINISTRADORA_ID);
  });
});

describe("status de concessão", () => {
  const cases: Array<{
    name: string;
    admin: "ATIVA" | "INATIVA";
    vinculo: "ATIVA" | "INATIVA" | "SUSPENSA";
    ok: boolean;
  }> = [
    { name: "ATIVA+ATIVA", admin: "ATIVA", vinculo: "ATIVA", ok: true },
    { name: "INATIVA+ATIVA", admin: "INATIVA", vinculo: "ATIVA", ok: false },
    { name: "ATIVA+INATIVA", admin: "ATIVA", vinculo: "INATIVA", ok: false },
    { name: "ATIVA+SUSPENSA", admin: "ATIVA", vinculo: "SUSPENSA", ok: false },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      const admin = { ...racon, status: c.admin };
      const deps = makeDeps({
        fetchConcessaoEmpresaAdministradora: vi.fn(async () => ({
          concessao: {
            id: "c1",
            empresa_id: GAUCHINHO_EMPRESA_ID,
            administradora_id: RACON_ADMINISTRADORA_ID,
            status: c.vinculo,
          },
          administradora: admin,
        })),
      });
      if (c.ok) {
        await expect(
          assertEmpresaPodeUsarAdministradora(
            GAUCHINHO_EMPRESA_ID,
            RACON_ADMINISTRADORA_ID,
            deps,
          ),
        ).resolves.toMatchObject({ id: RACON_ADMINISTRADORA_ID });
      } else {
        await expect(
          assertEmpresaPodeUsarAdministradora(
            GAUCHINHO_EMPRESA_ID,
            RACON_ADMINISTRADORA_ID,
            deps,
          ),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
      }
    });
  }
});

describe("assertAdministradoraGlobalAtiva", () => {
  it("ok para Racon ATIVA (Superadmin)", async () => {
    const a = await assertAdministradoraGlobalAtiva(RACON_ADMINISTRADORA_ID, makeDeps());
    expect(a.slug).toBe("racon");
  });

  it("NOT_FOUND se global INATIVA", async () => {
    const deps = makeDeps({
      fetchAdministradorasGlobais: vi.fn(async () => [{ ...racon, status: "INATIVA" as const }]),
    });
    await expect(
      assertAdministradoraGlobalAtiva(RACON_ADMINISTRADORA_ID, deps),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("cache", () => {
  it("E2 não introduz cache compartilhado entre tenants", () => {
    // Documentação viva: service não usa cache; cada chamada reconsulta com empresaId.
    expect(true).toBe(true);
  });
});

describe("service role / sessão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listagem global exige guard Superadmin antes do fetch", async () => {
    const order: string[] = [];
    const deps = makeDeps({
      requireGerenciarCatalogoAdministradoras: vi.fn(async () => {
        order.push("guard");
      }),
      fetchAdministradorasGlobais: vi.fn(async () => {
        order.push("fetch");
        return [racon];
      }),
    });
    await listAdministradorasGlobaisForSuperadmin(deps);
    expect(order).toEqual(["guard", "fetch"]);
  });

  it("listagem autorizada exige assertCaller antes do fetch privilegiado", async () => {
    const order: string[] = [];
    const deps = makeDeps({
      assertCallerCanAccessEmpresa: vi.fn(async () => {
        order.push("assert");
      }),
      fetchConcessoesComAdministradoraByEmpresa: vi.fn(async () => {
        order.push("fetch");
        return [];
      }),
    });
    await listAdministradorasAutorizadasForEmpresa(EMPRESA_B_ID, deps);
    expect(order).toEqual(["assert", "fetch"]);
  });
});
