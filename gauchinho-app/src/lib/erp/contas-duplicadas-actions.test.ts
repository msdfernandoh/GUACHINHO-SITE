import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rota: vi.fn(), permissao: vi.fn(), from: vi.fn(), rpc: vi.fn(), insert: vi.fn(), excluir: vi.fn(), dados: [] as Array<Record<string, unknown>>, logs: [] as Array<Record<string, unknown>> }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/erp/erp-acesso-server", () => ({ requireErpRouteAccess: mocks.rota }));
vi.mock("@/lib/tenant/context", () => ({ requireTenantPermission: mocks.permissao }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ from: mocks.from, rpc: mocks.rpc })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: vi.fn(() => ({ insert: mocks.insert })) })) }));
vi.mock("@/app/erp/contas-pagar/actions", () => ({ excluirConta: mocks.excluir }));
import { consultarContasDuplicadas, decidirContaDuplicada } from "@/app/erp/contas-pagar/duplicidades-actions";
const conta = (id: string, fornecedor = "Empresa A") => ({ id, descricao: id, fornecedor, valor: 10, competencia: "2026-10", vencimento: "2026-10-10", status: "aberta", pago_em: null, pago_pessoalmente: false, observacao: null });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rota.mockResolvedValue({ empresaAtiva: { id: "tenant-a" } });
  mocks.permissao.mockResolvedValue({ empresaAtiva: { id: "tenant-a" }, usuario: { id: "autor-a" } });
  mocks.dados = [conta("a"), conta("b")]; mocks.logs = [];
  mocks.from.mockImplementation((table: string) => {
    const chain = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), in: vi.fn(), contains: vi.fn(), order: vi.fn(), range: vi.fn() };
    for (const method of ["select", "eq", "is", "in", "contains", "order"] as const) chain[method].mockReturnValue(chain);
    chain.range.mockImplementation(async (inicio: number, fim: number) => ({ data: (table === "financeiro_contas_pagar" ? mocks.dados : mocks.logs).slice(inicio, fim + 1), error: null }));
    return chain;
  });
  mocks.rpc.mockResolvedValue({ data: true, error: null }); mocks.insert.mockResolvedValue({ error: null });
  mocks.excluir.mockResolvedValue({ ok: true, message: "excluída" });
});
describe("ações de checagem de duplicidades", () => {
  it("recusa divergência tenant antes de ler ou escrever", async () => {
    mocks.permissao.mockResolvedValue({ empresaAtiva: { id: "outro" }, usuario: { id: "autor" } });
    await expect(consultarContasDuplicadas()).rejects.toThrow("Empresa ativa divergente"); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("encontra duplicatas além do lote inicial e pagina os grupos", async () => {
    mocks.dados = Array.from({ length: 501 }, (_, i) => conta(`c${i}`, `F${i}`));
    mocks.dados.push(conta("duplicada", "F0"));
    const resultado = await consultarContasDuplicadas();
    expect(resultado.totalAnalisadas).toBe(502); expect(resultado.totalGrupos).toBe(1); expect(resultado.grupos[0].contas).toHaveLength(2);
  });
  it("registra manter com autor/empresa do servidor e não altera financeiro", async () => {
    const grupo = (await consultarContasDuplicadas()).grupos[0];
    const resultado = await decidirContaDuplicada({ contaId: "a", revisao: grupo.revisao, decisao: "manter", motivo: "" });
    expect(resultado.ok).toBe(true);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ empresa_id: "tenant-a", usuario_id: "autor-a", acao: "ALTERACAO", detalhes: expect.objectContaining({ tipo: "CONFERENCIA_DUPLICIDADE_MANTER", revisao: grupo.revisao }) }));
    expect(mocks.excluir).not.toHaveBeenCalled();
  });
  it("não permite manter sem autorização de escrita", async () => {
    const grupo = (await consultarContasDuplicadas()).grupos[0]; mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect((await decidirContaDuplicada({ contaId: "a", revisao: grupo.revisao, decisao: "manter", motivo: "" })).ok).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("não decide em lista desatualizada ou com ID de outra conta", async () => {
    const grupo = (await consultarContasDuplicadas()).grupos[0]; mocks.dados.push(conta("c"));
    expect((await decidirContaDuplicada({ contaId: "a", revisao: grupo.revisao, decisao: "excluir", motivo: "repetida" })).ok).toBe(false);
    expect(mocks.excluir).not.toHaveBeenCalled();
  });
  it("encaminha exclusão à action canônica e preserva recusas para conta paga/lacrada", async () => {
    const grupo = (await consultarContasDuplicadas()).grupos[0]; mocks.excluir.mockResolvedValue({ ok: false, message: "Período lacrado" });
    const resultado = await decidirContaDuplicada({ contaId: "b", revisao: grupo.revisao, decisao: "excluir", motivo: "duplicada conferida" });
    expect(resultado).toEqual({ ok: false, message: "Período lacrado" }); expect(mocks.excluir).toHaveBeenCalledWith("b", expect.stringContaining("duplicada conferida"));
  });
  it("grupos inteiramente mantidos saem da fila e podem ser consultados", async () => {
    const grupo = (await consultarContasDuplicadas()).grupos[0];
    mocks.logs = ["a", "b"].map((id) => ({ conta_id: id, detalhes: { tipo: "CONFERENCIA_DUPLICIDADE_MANTER", revisao: grupo.revisao } }));
    expect((await consultarContasDuplicadas()).totalGrupos).toBe(0);
    expect((await consultarContasDuplicadas(1, true)).totalGrupos).toBe(1);
  });
});
