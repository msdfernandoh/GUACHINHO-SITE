import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./bcb", () => ({
  fetchIpcaAcumulado12m: vi.fn(async () => null),
  fetchSelicAnual: vi.fn(async () => null),
  fetchCdiAnualReferencia: vi.fn(async () => null),
  fetchCdiAcumulado12m: vi.fn(async () => null),
}));

vi.mock("./repository", () => ({
  getIndiceByCodigo: vi.fn(async () => ({
    codigo: "ipca",
    fallback_manual: true,
    atualizacao_automatica: true,
  })),
  persistIndiceAtualizado: vi.fn(async () => undefined),
}));

describe("refreshIndiceAutomatico fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("quando API externa falhar, retorna erro com fallback manual", async () => {
    const { refreshIndiceAutomatico } = await import("./refresh");
    const r = await refreshIndiceAutomatico("ipca");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/mantidos|indisponível/i);
  });
});
