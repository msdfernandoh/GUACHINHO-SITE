import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), lookup: vi.fn(), parse: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/erp/erp-acesso-server", () => ({ requireErpRouteAccess: vi.fn() }));
vi.mock("@/lib/tenant/context", () => ({ requireTenantPermission: async () => ({ empresaAtiva: { id: "empresa-teste" } }) }));
vi.mock("unpdf", () => ({ getDocumentProxy: vi.fn(), extractText: async () => ({ text: "pdf teste" }) }));
vi.mock("@/lib/erp/repasse-racon-parser", () => ({ parseRepasseRaconText: mocks.parse }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  rpc: mocks.rpc, storage: { from: () => ({ upload: mocks.upload }) },
  from: () => { const query = { select: () => query, eq: () => query, maybeSingle: mocks.lookup }; return query; },
}) }));
import { importarRelatorioRepasseRaconAction } from "@/app/erp/repasse-franquia/actions";

function formulario(antigo = true) {
  const form = new FormData();
  form.set("arquivo_pdf", new File(["PDF teste"], "teste.pdf", { type: "application/pdf" }));
  form.set("administradora_id", "admin-teste");
  form.set("competencia", "2020-01");
  if (antigo) { form.set("relatorio_antigo", "on"); form.set("consultor_antigo_id", "consultor-teste"); }
  else form.set("data_recebimento", "2026-10-09");
  return form;
}

describe("importação antiga sem movimentação financeira", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({ error: null });
    mocks.parse.mockReturnValue({ itens: [{ cliente_nome: "Teste" }] });
    mocks.rpc.mockResolvedValue({ data: { novos: 1, reutilizados: 0 }, error: null });
    mocks.lookup.mockResolvedValue({ data: null, error: null });
  });
  it("envia o PDF e o consultor apenas à RPC de controle, dispensando data e conta de entrada", async () => {
    const result = await importarRelatorioRepasseRaconAction({ ok: false, message: "" }, formulario());
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Sem receita e sem comissões");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_importar_repasse_antigo", expect.objectContaining({
      p_participante_comercial_id: "consultor-teste", p_empresa_id: "empresa-teste",
      p_arquivo_path: expect.stringContaining("empresa-teste/antigos/"),
    }));
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty("p_data_recebimento");
  });
  it("não reprocessa nem concilia financeiramente um PDF antigo repetido", async () => {
    mocks.rpc.mockResolvedValue({ data: { idempotente: true }, error: null });
    const result = await importarRelatorioRepasseRaconAction({ ok: false, message: "" }, formulario());
    expect(result.message).toContain("sem duplicações");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("exige consultor antes de enviar ou gravar dados", async () => {
    const form = formulario(); form.delete("consultor_antigo_id");
    const result = await importarRelatorioRepasseRaconAction({ ok: false, message: "" }, form);
    expect(result.ok).toBe(false);
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("bloqueia um PDF antigo submetido pelo caminho financeiro", async () => {
    mocks.lookup.mockResolvedValue({ data: { id: "antigo-teste" }, error: null });
    const result = await importarRelatorioRepasseRaconAction({ ok: false, message: "" }, formulario(false));
    expect(result.ok).toBe(false);
    expect(result.message).toContain("não pode gerar entrada financeira");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
