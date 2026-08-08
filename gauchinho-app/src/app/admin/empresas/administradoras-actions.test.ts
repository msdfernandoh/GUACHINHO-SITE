import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPRESA_B_ID, GAUCHINHO_EMPRESA_ID, RACON_ADMINISTRADORA_ID } from "@/lib/administradoras/constants";

const requireGerenciarAdministradorasEmpresa = vi.fn();
const getEmpresaAdministradorasForSuperadmin = vi.fn();
const listAdministradorasCandidatasParaEmpresa = vi.fn();
const grantAdministradoraToEmpresa = vi.fn();
const updateEmpresaAdministradora = vi.fn();
const setEmpresaAdministradoraStatus = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/administradoras/authorization", () => ({
  requireGerenciarAdministradorasEmpresa: () => requireGerenciarAdministradorasEmpresa(),
}));

vi.mock("@/lib/administradoras/concessoes", () => ({
  getEmpresaAdministradorasForSuperadmin: (empresaId: string) =>
    getEmpresaAdministradorasForSuperadmin(empresaId),
  listAdministradorasCandidatasParaEmpresa: (empresaId: string) =>
    listAdministradorasCandidatasParaEmpresa(empresaId),
  grantAdministradoraToEmpresa: (input: unknown) => grantAdministradoraToEmpresa(input),
  updateEmpresaAdministradora: (id: string, local: unknown) =>
    updateEmpresaAdministradora(id, local),
  setEmpresaAdministradoraStatus: (id: string, status: unknown) =>
    setEmpresaAdministradoraStatus(id, status),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

describe("empresas administradoras-actions — autorização", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGerenciarAdministradorasEmpresa.mockRejectedValue(
      new Error("Sem permissão para gerenciar concessões de administradoras."),
    );
  });

  it("fetch concessões negado (admin_empresa/gestor/consultor/parceiro/anon)", async () => {
    const { fetchEmpresaAdministradorasAction } = await import("./administradoras-actions");
    await expect(fetchEmpresaAdministradorasAction(GAUCHINHO_EMPRESA_ID)).rejects.toThrow(
      /concessões/i,
    );
  });

  it("candidatas globais negadas (sem endpoint tenant)", async () => {
    const { fetchAdministradorasCandidatasAction } = await import("./administradoras-actions");
    await expect(fetchAdministradorasCandidatasAction(EMPRESA_B_ID)).rejects.toThrow(/concessões/i);
  });

  it("grant negado em chamada direta", async () => {
    const { grantAdministradoraAction } = await import("./administradoras-actions");
    const fd = new FormData();
    fd.set("administradora_id", RACON_ADMINISTRADORA_ID);
    await expect(grantAdministradoraAction(EMPRESA_B_ID, fd)).rejects.toThrow(/concessões/i);
  });

  it("status negado em chamada direta", async () => {
    const { setEmpresaAdministradoraStatusAction } = await import("./administradoras-actions");
    await expect(
      setEmpresaAdministradoraStatusAction("v1", GAUCHINHO_EMPRESA_ID, "SUSPENSA"),
    ).rejects.toThrow(/concessões/i);
  });

  it("update negado em chamada direta", async () => {
    const { updateEmpresaAdministradoraAction } = await import("./administradoras-actions");
    const fd = new FormData();
    fd.set("codigo_franquia", "X");
    await expect(updateEmpresaAdministradoraAction("v1", GAUCHINHO_EMPRESA_ID, fd)).rejects.toThrow(
      /concessões/i,
    );
  });

  it("Superadmin lista e revalida após grant", async () => {
    requireGerenciarAdministradorasEmpresa.mockResolvedValue(undefined);
    getEmpresaAdministradorasForSuperadmin.mockResolvedValue([
      {
        id: "v1",
        empresa_id: GAUCHINHO_EMPRESA_ID,
        administradora_id: RACON_ADMINISTRADORA_ID,
        status: "ATIVA",
        administradora: { slug: "racon", nome: "Racon", status: "ATIVA" },
      },
    ]);
    grantAdministradoraToEmpresa.mockResolvedValue({ id: "new-v" });

    const {
      fetchEmpresaAdministradorasAction,
      grantAdministradoraAction,
    } = await import("./administradoras-actions");

    const list = await fetchEmpresaAdministradorasAction(GAUCHINHO_EMPRESA_ID);
    expect(list).toHaveLength(1);
    expect(list[0]?.administradora.slug).toBe("racon");

    const fd = new FormData();
    fd.set("administradora_id", "other-admin");
    await grantAdministradoraAction(EMPRESA_B_ID, fd);
    expect(grantAdministradoraToEmpresa).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/empresas/${EMPRESA_B_ID}`);
  });
});
