import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), isPlatformSuperadmin: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc: mocks.rpc, from: mocks.from })) }));
vi.mock("@/lib/auth/is-superadmin", () => ({ isPlatformSuperadmin: mocks.isPlatformSuperadmin }));
vi.mock("@/lib/erp/erp-acesso-server", () => ({
  requireErpRouteAccess: vi.fn(async () => ({ empresaAtiva: { id: "tenant-a" } })),
}));

import { homologateFranchiseRuleAction } from "@/app/erp/regras-comissao/actions";

const formulario = (empresa = "tenant-a") => {
  const form = new FormData();
  form.set("empresa_id", empresa);
  form.set("regra_id", "regra-a");
  return form;
};

describe("autorização da homologação de comissão da franquia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.isPlatformSuperadmin.mockResolvedValue(false);
    mocks.from.mockImplementation(() => { throw new Error("consulta autorizada"); });
  });

  it("bloqueia administrador tenant antes de consultar ou modificar a regra", async () => {
    await expect(homologateFranchiseRuleAction(formulario())).rejects.toThrow("Somente Platform Superadmin");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("mantém a verificação de empresa ativa mesmo para Superadmin", async () => {
    mocks.isPlatformSuperadmin.mockResolvedValue(true);
    await expect(homologateFranchiseRuleAction(formulario("outro-tenant"))).rejects.toThrow("tenant ativo");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("permite ao Superadmin da empresa ativa prosseguir para a conferência da regra", async () => {
    mocks.isPlatformSuperadmin.mockResolvedValue(true);
    await expect(homologateFranchiseRuleAction(formulario())).rejects.toThrow("consulta autorizada");
    expect(mocks.rpc).toHaveBeenCalledWith("can_write_tenant_internal", { p_empresa_id: "tenant-a" });
    expect(mocks.from).toHaveBeenCalledWith("comissao_regras_franquia");
  });
});
