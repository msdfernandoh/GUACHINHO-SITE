import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ acesso: vi.fn(), permissao: vi.fn(), from: vi.fn(), eq: vi.fn(), range: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/tenant/context", () => ({ requireTenantPermission: mocks.permissao }));
vi.mock("@/lib/gestao/api-access", () => {
  class GestaoApiError extends Error { status = 403; }
  return { GestaoApiError, requireGestaoApiAccess: mocks.acesso,
    gestaoApiStatus: (e: Error) => e instanceof GestaoApiError ? 403 : 500,
    gestaoApiMessage: (e: Error) => e.message };
});
import { GET } from "@/app/api/admin/gestao/metas/orcamento/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.acesso.mockResolvedValue({ empresaId: "empresa-a" });
  mocks.permissao.mockResolvedValue({ empresaAtiva: { id: "empresa-a" } });
  const chain = { select: vi.fn(), eq: mocks.eq, order: vi.fn(), range: mocks.range };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.order.mockReturnValue(chain);
  mocks.from.mockReturnValue(chain);
  mocks.range.mockResolvedValue({ data: [{ id: "orcamento", competencia: "2026-10", categoria: "Contabilidade", valor_previsto_admin: 488.3 }], error: null });
});

describe("orçamento financeiro na tela de metas", () => {
  it("exige permissão financeira e restringe a empresa resolvida no servidor", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mocks.permissao).toHaveBeenCalledWith("gerenciar_financeiro");
    expect(mocks.eq).toHaveBeenCalledWith("empresa_id", "empresa-a");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual([expect.objectContaining({ categoria: "Contabilidade" })]);
  });
  it("recusa divergência de tenant antes de consultar dados", async () => {
    mocks.permissao.mockResolvedValue({ empresaAtiva: { id: "empresa-b" } });
    expect((await GET()).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("não consulta orçamento sem permissão financeira", async () => {
    mocks.permissao.mockRejectedValue(new Error("Sem permissão"));
    expect((await GET()).status).not.toBe(200);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("pagina para não omitir orçamentos após o primeiro lote", async () => {
    mocks.range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => ({ id: String(i) })), error: null })
      .mockResolvedValueOnce({ data: [{ id: "ultimo" }], error: null });
    const res = await GET();
    expect(await res.json()).toHaveLength(501);
    expect(mocks.range).toHaveBeenLastCalledWith(500, 999);
  });
  it("não apresenta dados parciais quando a consulta falha", async () => {
    mocks.range.mockResolvedValue({ data: null, error: { message: "erro restrito" } });
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Não foi possível carregar o orçamento financeiro." });
  });
});
