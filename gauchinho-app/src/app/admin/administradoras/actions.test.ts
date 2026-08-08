import { beforeEach, describe, expect, it, vi } from "vitest";

const requireGerenciarCatalogoAdministradoras = vi.fn();
const listAdministradorasGlobaisForSuperadmin = vi.fn();
const countEmpresasVinculadasByAdministradoraIds = vi.fn();
const createAdministradoraGlobal = vi.fn();
const updateAdministradoraGlobal = vi.fn();
const setAdministradoraGlobalStatus = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("@/lib/administradoras/authorization", () => ({
  requireGerenciarCatalogoAdministradoras: () => requireGerenciarCatalogoAdministradoras(),
}));

vi.mock("@/lib/administradoras/service", () => ({
  listAdministradorasGlobaisForSuperadmin: () => listAdministradorasGlobaisForSuperadmin(),
}));

vi.mock("@/lib/administradoras/mutations", () => ({
  countEmpresasVinculadasByAdministradoraIds: (ids: string[]) =>
    countEmpresasVinculadasByAdministradoraIds(ids),
  createAdministradoraGlobal: (input: unknown) => createAdministradoraGlobal(input),
  updateAdministradoraGlobal: (id: string, input: unknown) => updateAdministradoraGlobal(id, input),
  setAdministradoraGlobalStatus: (id: string, status: unknown) =>
    setAdministradoraGlobalStatus(id, status),
  getAdministradoraGlobalByIdForSuperadmin: vi.fn(),
  listEmpresasFranqueadasVinculadas: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

describe("admin administradoras actions — autorização", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGerenciarCatalogoAdministradoras.mockRejectedValue(
      new Error("Sem permissão para gerenciar o catálogo global de administradoras."),
    );
  });

  it("lista negada para não-Superadmin", async () => {
    const { fetchAdministradorasGlobaisList } = await import("./actions");
    await expect(fetchAdministradorasGlobaisList()).rejects.toThrow(/catálogo global/i);
  });

  it("create negado para não-Superadmin", async () => {
    const { createAdministradoraAction } = await import("./actions");
    const fd = new FormData();
    fd.set("nome", "X");
    fd.set("slug", "x");
    fd.set("status", "ATIVA");
    fd.set("recursos_integracao_json", "{}");
    await expect(createAdministradoraAction(fd)).rejects.toThrow(/catálogo global/i);
  });

  it("status negado para não-Superadmin", async () => {
    const { setAdministradoraStatusAction } = await import("./actions");
    await expect(setAdministradoraStatusAction("id", "INATIVA")).rejects.toThrow(/catálogo global/i);
  });

  it("Superadmin lista e anexa contagem de empresas/franquias", async () => {
    requireGerenciarCatalogoAdministradoras.mockResolvedValue(undefined);
    listAdministradorasGlobaisForSuperadmin.mockResolvedValue([
      {
        id: "c5f8ecb4-cb5a-5014-b567-50484719b404",
        nome: "Racon",
        nome_fantasia: "Racon",
        slug: "racon",
        cnpj: null,
        status: "ATIVA",
        updated_at: "2026-08-08T00:00:00Z",
      },
    ]);
    countEmpresasVinculadasByAdministradoraIds.mockResolvedValue(
      new Map([["c5f8ecb4-cb5a-5014-b567-50484719b404", 1]]),
    );

    const { fetchAdministradorasGlobaisList } = await import("./actions");
    const list = await fetchAdministradorasGlobaisList();
    expect(list).toHaveLength(1);
    expect(list[0]?.slug).toBe("racon");
    expect(list[0]?.empresas_vinculadas_count).toBe(1);
    expect(list.every((r) => r.slug !== "gauchinho")).toBe(true);
  });

  it("Superadmin cria e redireciona", async () => {
    requireGerenciarCatalogoAdministradoras.mockResolvedValue(undefined);
    createAdministradoraGlobal.mockResolvedValue({ id: "new-1", slug: "nova" });
    const { createAdministradoraAction } = await import("./actions");
    const fd = new FormData();
    fd.set("nome", "Nova");
    fd.set("slug", "nova");
    fd.set("status", "ATIVA");
    fd.set("recursos_integracao_json", "{}");
    await expect(createAdministradoraAction(fd)).rejects.toThrow("REDIRECT:/admin/administradoras/new-1");
    expect(createAdministradoraGlobal).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/admin/administradoras");
  });
});
