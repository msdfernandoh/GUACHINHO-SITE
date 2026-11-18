import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const repo = vi.hoisted(() => ({
  imobiliariaPorToken: vi.fn(),
  listarVendedores: vi.fn(),
  cadastrarVendedor: vi.fn(),
}));
vi.mock("@/lib/spl/repo", () => repo);
vi.mock("@/lib/security/public-ingress", () => ({
  authorizePublicIngress: async () => ({ ok: true, empresaId: "empresa" }),
}));

const imobiliaria = { id: "imob", nome: "Imobiliária Teste", responsavel: "Pessoa Responsável", telefone: "66999999999", status: "APROVADA" };
const abrir = () => POST(new Request("https://spl.exemplo.test/api/public/spl/imobiliaria/portfolio", {
  method: "POST",
  body: JSON.stringify({ token: "exemplo" }),
}));

describe("painel de vendas da imobiliária", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.imobiliariaPorToken.mockResolvedValue(imobiliaria);
  });

  it("abre o portfólio do responsável, mesmo que outro vendedor venha primeiro", async () => {
    repo.listarVendedores.mockResolvedValue([
      { codigo: "OUTRO123", telefone: "66988888888", ativo: true },
      { codigo: "RESP1234", telefone: "5566999999999", ativo: true },
    ]);
    const resposta = await abrir();
    expect(await resposta.json()).toEqual({ caminho: "/spl/v/imobiliaria-teste-RESP1234" });
    expect(repo.cadastrarVendedor).not.toHaveBeenCalled();
  });

  it("cria o vendedor responsável quando falta o registro", async () => {
    repo.listarVendedores.mockResolvedValue([]);
    repo.cadastrarVendedor.mockResolvedValue({ codigo: "RESP1234", ativo: true });
    expect((await abrir()).status).toBe(200);
    expect(repo.cadastrarVendedor).toHaveBeenCalledWith(imobiliaria, expect.objectContaining({
      nome: imobiliaria.responsavel, telefone: imobiliaria.telefone,
    }), "PROPRIO");
  });

  it("pede os dados do responsável em um pré-cadastro incompleto", async () => {
    repo.imobiliariaPorToken.mockResolvedValue({ ...imobiliaria, responsavel: null });
    expect((await abrir()).status).toBe(400);
    expect(repo.cadastrarVendedor).not.toHaveBeenCalled();
  });
});
