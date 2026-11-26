import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acesso: vi.fn(), permissao: vi.fn(), iniciar: vi.fn(),
  db: { from: vi.fn() },
}));
vi.mock("@/lib/erp/erp-acesso-server", () => ({ requireErpRouteAccess: mocks.acesso }));
vi.mock("@/lib/tenant/context", () => ({ requireTenantPermission: mocks.permissao }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.db }));
vi.mock("@/app/erp/clientes/actions", () => ({ iniciarNovaCotaClienteAction: mocks.iniciar }));
vi.mock("@/app/erp/clientes/novo/page", () => ({ default: () => React.createElement("div", null, "Novo cadastro") }));
vi.mock("@/app/erp/contratacoes/nova/iniciar-form", () => ({
  IniciarContratacaoForm: ({ clienteId }: { clienteId: string }) => React.createElement("div", null, `Continuar cliente ${clienteId}`),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: (error: unknown) => {
  if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
} }));
import NovaContratacaoPage from "@/app/erp/contratacoes/nova/page";
import { iniciarContratacaoAction } from "@/app/erp/contratacoes/nova/actions";

function consulta(resultado: Record<string, unknown>) {
  const builder = {
    select: vi.fn(), eq: vi.fn(), ilike: vi.fn(), order: vi.fn(),
    maybeSingle: vi.fn(async () => resultado), range: vi.fn(async () => resultado),
  };
  for (const metodo of [builder.select, builder.eq, builder.ilike, builder.order]) metodo.mockReturnValue(builder);
  return builder;
}
const clienteId = "d3fd9b96-ff16-4108-b5e0-87409a4a6b78";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.acesso.mockResolvedValue({ empresaAtiva: { id: "empresa-atual" } });
  mocks.permissao.mockResolvedValue({});
});

describe("Nova contratação pelo ERP", () => {
  it("busca documento formatado, pagina e limita a empresa ativa", async () => {
    const lista = consulta({ data: [{ id: clienteId, nome: "Cliente existente", cpf_cnpj: "12345678900", telefone: null }], count: 45, error: null });
    mocks.db.from.mockReturnValue(lista);
    const html = renderToStaticMarkup(await NovaContratacaoPage({ searchParams: Promise.resolve({ busca: "123.456.789-00", pagina: "2" }) }));
    expect(lista.eq).toHaveBeenCalledWith("empresa_id", "empresa-atual");
    expect(lista.ilike).toHaveBeenCalledWith("documento_normalizado", "%12345678900%");
    expect(lista.range).toHaveBeenCalledWith(20, 39);
    expect(html).toContain("Cadastrar novo cliente");
    expect(html).toContain("Cliente existente");
    expect(html).toContain("Próxima");
  });

  it("não oferece continuar com cliente ausente no tenant", async () => {
    const selecionado = consulta({ data: null, error: null });
    const lista = consulta({ data: [], count: 0, error: null });
    mocks.db.from.mockReturnValueOnce(selecionado).mockReturnValueOnce(lista);
    const html = renderToStaticMarkup(await NovaContratacaoPage({ searchParams: Promise.resolve({ cliente: clienteId }) }));
    expect(selecionado.eq).toHaveBeenCalledWith("empresa_id", "empresa-atual");
    expect(html).toContain("Cliente indisponível");
    expect(html).not.toContain("Continuar cliente");
    expect(mocks.iniciar).not.toHaveBeenCalled();
  });

  it("revalida acesso no POST e preserva o redirecionamento do fluxo existente", async () => {
    const form = new FormData();
    form.set("cliente_id", clienteId);
    form.set("request_id", "8bcc2ae8-3a63-41e5-b5fd-036a912642f9");
    mocks.iniciar.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(iniciarContratacaoAction({ erro: "" }, form)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.acesso).toHaveBeenCalledWith("contratacoes");
    expect(mocks.iniciar).toHaveBeenCalledWith(form);
  });

  it("exibe falha sem iniciar contratação quando o acesso é recusado", async () => {
    mocks.acesso.mockRejectedValue(new Error("Acesso recusado"));
    const resultado = await iniciarContratacaoAction({ erro: "" }, new FormData());
    expect(resultado.erro).toBe("Acesso recusado");
    expect(mocks.iniciar).not.toHaveBeenCalled();
  });
});