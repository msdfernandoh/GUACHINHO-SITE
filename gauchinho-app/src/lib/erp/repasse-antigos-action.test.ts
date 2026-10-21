import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), lookup: vi.fn(), parse: vi.fn(), pdf: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/erp/erp-acesso-server", () => ({ requireErpRouteAccess: vi.fn() }));
vi.mock("@/lib/tenant/context", () => ({ requireTenantPermission: async () => ({ empresaAtiva: { id: "empresa-teste" } }) }));
vi.mock("unpdf", () => ({ getDocumentProxy: mocks.pdf, extractText: async () => ({ text: "pdf teste" }) }));
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
    mocks.pdf.mockImplementation(async (bytes: Uint8Array) => {
      structuredClone(bytes, { transfer: [bytes.buffer] });
      return {};
    });
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
  it("preserva o PDF no upload mesmo quando o parser transfere o buffer", async () => {
    const result = await importarRelatorioRepasseRaconAction({ ok: false, message: "" }, formulario());
    expect(result.ok).toBe(true);
    const [, bytes, options] = mocks.upload.mock.calls[0];
    expect(new TextDecoder().decode(bytes)).toBe("PDF teste");
    expect(bytes.byteLength).toBe(9);
    expect(options.upsert).toBe(true);
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

  it("envia todas as cotas e o total divergente à importação financeira e abre conferência", async () => {
    const parsed = { valor_total: 8352.58, itens: [{ valor_comissao: 8000 }, { valor_comissao: 1318 }], alertas: ["Diferença de R$ 965,42 para conferência"] };
    mocks.parse.mockReturnValue(parsed);
    mocks.rpc.mockResolvedValue({ data: { importacao_id: "relatorio-teste", vinculados_auto: 2 }, error: null });
    const result = await importarRelatorioRepasseRaconAction({ ok: false, message: "" }, formulario(false));
    expect(result).toMatchObject({ ok: true, importacaoId: "relatorio-teste", alertas: parsed.alertas });
    expect(result.message).toContain("diferença mantida para conferência");
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_importar_repasse_racon", expect.objectContaining({ p_relatorio: parsed }));
  });

  it("permite três arquivos distintos na mesma competência com hashes independentes", async () => {
    mocks.parse.mockReturnValue({ valor_total: 10, itens: [{ valor_comissao: 10 }], alertas: [] });
    for (const dia of [5, 15, 25]) {
      const form = formulario(false);
      form.set("arquivo_pdf", new File([`PDF do dia ${dia}`], `${dia}.pdf`, { type: "application/pdf" }));
      expect((await importarRelatorioRepasseRaconAction({ ok: false, message: "" }, form)).ok).toBe(true);
    }
    const chamadas = mocks.rpc.mock.calls.map(([, parametros]) => parametros);
    expect(chamadas).toHaveLength(3);
    expect(new Set(chamadas.map((p) => p.p_competencia)).size).toBe(1);
    expect(new Set(chamadas.map((p) => p.p_arquivo_hash)).size).toBe(3);
  });
});
