import { beforeEach, describe, expect, it, vi } from "vitest";

const assertNaoPodeEditarSiteComoParceiro = vi.fn();

vi.mock("@/lib/parceiros/authorization", () => ({
  assertNaoPodeEditarSiteComoParceiro: (papel: string) =>
    assertNaoPodeEditarSiteComoParceiro(papel),
  requireGerenciarSitesParceiros: vi.fn(),
}));

vi.mock("@/lib/auth/is-superadmin", () => ({
  isPlatformSuperadmin: vi.fn(async () => false),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/parceiros/schema-ready", () => ({
  isFase3ParceiroSitesAdminReady: vi.fn(async () => true),
  fase3SitesAdminDisabledMessage: () => "disabled",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("parceiro-sites E5 — autorização e bundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertNaoPodeEditarSiteComoParceiro.mockImplementation(async (papel: string) => {
      if (papel === "parceiro_comercial") {
        throw new Error("Parceiro comercial não pode editar site, domínio, DNS ou branding.");
      }
    });
  });

  it("chamada direta por parceiro_comercial rejeitada", async () => {
    const { assertParceiroComercialBlockedAction } = await import("./actions");
    await expect(assertParceiroComercialBlockedAction("parceiro_comercial")).rejects.toThrow(
      /Parceiro comercial/i
    );
  });

  it("outro papel bloqueado no guard", async () => {
    const { assertParceiroComercialBlockedAction } = await import("./actions");
    await expect(assertParceiroComercialBlockedAction("consultor")).rejects.toThrow(
      /sem permissão/i
    );
  });

  it("actions não importam service role admin client", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    expect(src).not.toMatch(/supabase\/admin/);
    expect(src).not.toMatch(/SERVICE_ROLE/);
    expect(src).not.toMatch(/NEXT_PUBLIC_VERCEL/);
  });
});
