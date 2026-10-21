import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));

import { getContasPagarPermissoes } from "./contas-pagar-permissoes";

beforeEach(() => { rpc.mockReset(); });

describe("autorização canônica de Contas a Pagar", () => {
  it("reconhece Master/Superadmin autorizado pelo banco, sem exigir admin_empresa na tela", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await getContasPagarPermissoes("empresa-ativa")).toEqual({ master: true, podeEstornar: true });
    expect(rpc).toHaveBeenCalledWith("is_financeiro_tenant_master", { p_empresa_id: "empresa-ativa" });
    expect(rpc).toHaveBeenCalledWith("pode_estornar_conta_pagar", { p_empresa_id: "empresa-ativa" });
  });

  it("mantém operador comum sem edição de fatos pagos", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await getContasPagarPermissoes("empresa-ativa")).toEqual({ master: false, podeEstornar: false });
  });

  it("não transforma autorização delegada de estorno em Master", async () => {
    rpc.mockImplementation(async (name: string) => ({
      data: name === "pode_estornar_conta_pagar", error: null,
    }));
    expect(await getContasPagarPermissoes("empresa-ativa")).toEqual({ master: false, podeEstornar: true });
  });

  it("consulta a empresa solicitada a cada resolução, sem reaproveitar a autorização de outra", async () => {
    rpc.mockImplementation(async (_name: string, args: { p_empresa_id: string }) => ({
      data: args.p_empresa_id === "empresa-a", error: null,
    }));
    expect((await getContasPagarPermissoes("empresa-a")).master).toBe(true);
    expect((await getContasPagarPermissoes("empresa-b")).master).toBe(false);
  });

  it.each(["is_financeiro_tenant_master", "pode_estornar_conta_pagar"])("expõe falha em %s sem presumir permissão", async (failing) => {
    rpc.mockImplementation(async (name: string) => ({
      data: null, error: name === failing ? { message: "falha" } : null,
    }));
    await expect(getContasPagarPermissoes("empresa-ativa")).rejects.toThrow("Não foi possível verificar");
  });
});
