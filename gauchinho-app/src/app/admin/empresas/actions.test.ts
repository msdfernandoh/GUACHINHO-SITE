import { beforeEach, describe, expect, it, vi } from "vitest";

const isPlatformSuperadmin = vi.fn();
const createClient = vi.fn();
const invalidateTenantHostCache = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/auth/is-superadmin", () => ({
  isPlatformSuperadmin: () => isPlatformSuperadmin(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

vi.mock("@/lib/tenant/tenant-host-cache", () => ({
  invalidateTenantHostCache: () => invalidateTenantHostCache(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

describe("admin empresas actions — autorização", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPlatformSuperadmin.mockResolvedValue(false);
  });

  it("bloqueia fetchEmpresasList sem SuperAdmin", async () => {
    const { fetchEmpresasList } = await import("@/app/admin/empresas/actions");
    await expect(fetchEmpresasList()).rejects.toThrow(/SuperAdmin/i);
  });

  it("bloqueia createDominioAction sem SuperAdmin", async () => {
    const { createDominioAction } = await import("@/app/admin/empresas/actions");
    const fd = new FormData();
    fd.set("valor", "exemplo.com.br");
    fd.set("tipo", "DOMINIO_CUSTOMIZADO");
    await expect(createDominioAction("emp-1", fd)).rejects.toThrow(/SuperAdmin/i);
  });

  it("bloqueia upsertBrandingAction sem SuperAdmin", async () => {
    const { upsertBrandingAction } = await import("@/app/admin/empresas/actions");
    const fd = new FormData();
    fd.set("nome_site", "X");
    await expect(upsertBrandingAction("emp-1", fd)).rejects.toThrow(/SuperAdmin/i);
  });

  it("SuperAdmin valida domínio e invalida cache", async () => {
    isPlatformSuperadmin.mockResolvedValue(true);
    const insert = vi.fn(async () => ({ error: null }));
    createClient.mockResolvedValue({
      from: () => ({ insert }),
    });

    const { createDominioAction } = await import("@/app/admin/empresas/actions");
    const fd = new FormData();
    fd.set("valor", "https://WWW.NovoDominio.com.br/path");
    fd.set("tipo", "DOMINIO_CUSTOMIZADO");
    await createDominioAction("emp-1", fd);

    expect(insert).toHaveBeenCalled();
    const arg = insert.mock.calls[0][0];
    expect(arg.valor).toBe("novodominio.com.br");
    expect(invalidateTenantHostCache).toHaveBeenCalled();
  });

  it("SuperAdmin rejeita localhost persistido", async () => {
    isPlatformSuperadmin.mockResolvedValue(true);
    createClient.mockResolvedValue({ from: () => ({ insert: vi.fn() }) });
    const { createDominioAction } = await import("@/app/admin/empresas/actions");
    const fd = new FormData();
    fd.set("valor", "localhost");
    fd.set("tipo", "DOMINIO_CUSTOMIZADO");
    await expect(createDominioAction("emp-1", fd)).rejects.toThrow(/localhost/i);
  });
});
