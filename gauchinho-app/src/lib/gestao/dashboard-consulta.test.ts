import { describe, expect, it, vi } from "vitest";
import { consultarDashboard, normalizarPeriodoDashboard } from "./dashboard-consulta";

function pendente<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("consulta do dashboard", () => {
  it("valida período da URL sem aceitar valores arbitrários", () => {
    expect(normalizarPeriodoDashboard("ultimos_6_meses")).toBe("ultimos_6_meses");
    expect(normalizarPeriodoDashboard("personalizado")).toBe("personalizado");
    expect(normalizarPeriodoDashboard(null)).toBe("mes_atual");
    expect(normalizarPeriodoDashboard("outro-periodo")).toBe("mes_atual");
  });

  it("encaminha filtros escapados e o cancelamento, sem cache", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ origem: "nova" }));
    const signal = new AbortController().signal;
    await consultarDashboard({ periodo: "mes_anterior", administradoraId: "adm&outra", signal, fetcher });
    expect(fetcher).toHaveBeenCalledWith("/api/admin/gestao/dashboard?periodo=mes_anterior&administradoraId=adm%26outra", { signal, cache: "no-store" });
  });

  it("não publica a consulta antiga que conclui depois da consulta nova", async () => {
    const antiga = pendente<Response>();
    const fetcher = vi.fn<typeof fetch>().mockReturnValueOnce(antiga.promise)
      .mockResolvedValueOnce(Response.json({ origem: "nova" }));
    const controllerAntigo = new AbortController();
    const primeira = consultarDashboard({ periodo: "mes_anterior", administradoraId: "", signal: controllerAntigo.signal, fetcher });
    controllerAntigo.abort();
    const segunda = consultarDashboard({ periodo: "mes_atual", administradoraId: "", signal: new AbortController().signal, fetcher });
    await expect(segunda).resolves.toEqual({ origem: "nova" });
    antiga.resolve(Response.json({ origem: "antiga" }));
    await expect(primeira).rejects.toMatchObject({ name: "AbortError" });
  });

  it("também cancela quando a troca de filtro ocorre durante a leitura do JSON", async () => {
    const json = pendente<{ origem: string }>();
    const resposta = Response.json({});
    vi.spyOn(resposta, "json").mockReturnValue(json.promise);
    const controller = new AbortController();
    const consulta = consultarDashboard({ periodo: "mes_atual", administradoraId: "", signal: controller.signal,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(resposta) });
    await Promise.resolve();
    controller.abort();
    json.resolve({ origem: "cancelada" });
    await expect(consulta).rejects.toMatchObject({ name: "AbortError" });
  });

  it("expõe falha HTTP em vez de tratar resposta de erro como indicadores", async () => {
    await expect(consultarDashboard({ periodo: "mes_atual", administradoraId: "", signal: new AbortController().signal,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response("indisponível", { status: 503 })) })).rejects.toThrow("HTTP 503");
  });
});
