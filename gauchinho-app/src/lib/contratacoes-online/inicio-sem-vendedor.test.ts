import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), resolver: vi.fn(), list: vi.fn(), link: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/security/public-ingress", () => ({ authorizePublicIngress: async () => ({ ok: true, empresaId: "empresa" }) }));
vi.mock("@/lib/tenant/context", () => ({ getCurrentTenantContext: mocks.context }));
vi.mock("@/lib/tenant/assert-legacy-operational-api", () => ({ resolveOperationalTenantForApi: async () => ({ ok: true, empresaId: "empresa" }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/admin/consultores", () => ({ resolverConsultorPorId: mocks.resolver, listarConsultores: mocks.list }));
vi.mock("@/lib/contratacoes-online/draft-link", () => ({ criarContratacaoDraftLink: mocks.link }));
vi.mock("@/lib/grupos/catalogo-autorizado-service", () => ({ assertDadosSimulacaoGruposAutorizadosForEmpresa: vi.fn() }));
vi.mock("@/lib/grupos/resolve-catalog-empresa", () => ({ getCatalogEmpresaIdFromRequest: async () => "empresa" }));
import { POST } from "@/app/api/public/contratacoes/iniciar/route";
import { GET } from "@/app/api/public/consultores/route";
const request = (extra = {}) => new Request("https://site.test/api/public/contratacoes/iniciar", { method: "POST", body: JSON.stringify({ origem: "grupos", modo: "cliente_site", dados_simulacao: {}, ...extra }) });
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue({ usuario: null, empresaAtiva: null, permissoes: new Set() }); });
describe("contratação sem lista pública", () => {
  it("visitante continua sem vendedor e não consegue forjar um responsável", async () => {
    const response = await POST(request({ consultor_id: "terceiro", consultor_nome: "Forjado" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.draftPayload.consultor_id).toBeUndefined();
    expect(body.draftPayload.consultor_nome).toBeUndefined();
    expect(mocks.resolver).not.toHaveBeenCalled();
  });
  it("atribui apenas o usuário comercial autenticado e validado no tenant", async () => {
    mocks.context.mockResolvedValue({ usuario: { id: "eu" }, empresaAtiva: { id: "empresa" }, permissoes: new Set(["gerenciar_propostas"]) });
    mocks.resolver.mockResolvedValue({ id: "eu", nome: "Nome canônico" });
    const body = await (await POST(request({ consultor_id: "terceiro" }))).json();
    expect(mocks.resolver).toHaveBeenCalledWith(undefined, "eu", "empresa");
    expect(body.draftPayload).toMatchObject({ consultor_id: "eu", consultor_nome: "Nome canônico" });
  });
  it("usuário de outra empresa segue sem vendedor e não gera link comercial", async () => {
    mocks.context.mockResolvedValue({ usuario: { id: "eu" }, empresaAtiva: { id: "outra" }, permissoes: new Set(["gerenciar_propostas"]) });
    expect((await (await POST(request())).json()).draftPayload.consultor_id).toBeUndefined();
    expect((await POST(request({ modo: "sdr_link" }))).status).toBe(403);
  });
  it("não expõe lista de usuários a visitantes ou sessões de outra empresa", async () => {
    expect((await GET(new Request("https://site.test/api/public/consultores"))).status).toBe(401);
    mocks.context.mockResolvedValue({ usuario: { id: "eu" }, empresaAtiva: { id: "outra" }, permissoes: new Set(["gerenciar_propostas"]) });
    expect((await GET(new Request("https://site.test/api/public/consultores"))).status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
