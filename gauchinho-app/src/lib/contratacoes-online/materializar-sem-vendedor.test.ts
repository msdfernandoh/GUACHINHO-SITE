import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), existente: vi.fn(), resolver: vi.fn(), canon: vi.fn(async (_empresa: string, dados: unknown) => dados) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/admin/consultores", () => ({ resolverConsultorPorId: mocks.resolver }));
vi.mock("@/lib/proposta/proposta-unificacao-service", () => ({ buscarPropostaAtivaDoDia: mocks.existente }));
vi.mock("@/lib/contratacoes-online/snapshot-calculo-grupos", () => ({ canonicalizarDadosSimulacaoGrupos: mocks.canon, assertSnapshotCalculoGruposIntegro: vi.fn() }));
vi.mock("@/server/config", () => ({ getConfigJsonPublic: vi.fn() }));
import { criarPropostaDoFluxo } from "./proposta-flow";
import type { ContratacaoDraftPayload } from "./draft";
const draft: ContratacaoDraftPayload = { empresa_id: "empresa", modo: "cliente_site", origem: "grupos", createdAt: new Date().toISOString(), dados_simulacao: {} };
let saved: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks(); mocks.existente.mockResolvedValue(null);
  mocks.admin.mockReturnValue({ from(table: string) {
    if (table !== "propostas") throw Error("Consulta inesperada: " + table);
    const q = { insert(payload: Record<string, unknown>) { saved = payload; return this; }, update(payload: Record<string, unknown>) { saved = payload; return this; }, select() { return this; }, eq() { return this; },
      async single() { return { error: null, data: { id: "proposta1", public_token: "token", created_at: new Date().toISOString(), ...saved } }; } };
    return q;
  } });
});
describe("materialização sem vendedor", () => {
  it("salva proposta sem responsável após nome e telefone válidos", async () => {
    const result = await criarPropostaDoFluxo({ draft, empresaId: "empresa", nome: "Cliente", telefone: "66999999999", gerador: null });
    expect(result.public_token).toBe(saved.public_token);
    expect(saved.consultor_nome).toBeNull();
    expect(saved.consultor_email).toBeNull();
    expect(saved.preenchimento_contratacao).toMatchObject({ gerado_por_usuario_id: null });
    expect(mocks.resolver).not.toHaveBeenCalled();
    expect(mocks.canon).toHaveBeenCalledWith("empresa", {});
  });
  it("não apaga o responsável de uma proposta já existente", async () => {
    mocks.existente.mockResolvedValue({ id: "existente", consultor_nome: "Consultora", consultor_email: "vendedora@example.test", preenchimento_contratacao: { gerado_por_usuario_id: "vendedora" } });
    await criarPropostaDoFluxo({ draft, empresaId: "empresa", nome: "Cliente", telefone: "66999999999", gerador: null });
    expect(saved.consultor_nome).toBe("Consultora");
    expect(saved.preenchimento_contratacao).toMatchObject({ gerado_por_usuario_id: "vendedora" });
  });
  it("não materializa link comercial sem responsável nem dados incompletos", async () => {
    await expect(criarPropostaDoFluxo({ draft: { ...draft, modo: "sdr_link" }, empresaId: "empresa", nome: "Cliente", telefone: "66999999999", gerador: null })).rejects.toThrow("sem responsável");
    await expect(criarPropostaDoFluxo({ draft, empresaId: "empresa", nome: "", telefone: "", gerador: null })).rejects.toThrow("obrigatórios");
  });
});
