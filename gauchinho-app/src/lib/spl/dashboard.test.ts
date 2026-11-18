import { describe, expect, it, vi } from "vitest";
import { acessoDashboardVendedorValido, caminhoDashboardVendedor } from "./acesso-dashboard-vendedor";
import { resumirDashboardSpl } from "./dashboard";
import type { ClienteSpl, VendedorSpl } from "./types";

vi.mock("server-only", () => ({}));

function cliente(id: string, status: ClienteSpl["status"], valor_chaves: number | null): ClienteSpl {
  return {
    id, status, valor_chaves, imobiliaria_id: "imob", vendedor_id: "v1", nome: id,
    telefone: "", email: null, empreendimento_slug: null, unidade: null, situacao: null,
    solucao: "CONSORCIO_SPL", origem: "PAINEL", proposta_expira_em: null, created_at: "",
  };
}

const vendedor: VendedorSpl = {
  id: "v1", imobiliaria_id: "imob", nome: "Vendedor Um", telefone: "",
  email: null, cpf: null, chave_pix: null, chave_pix_tipo: null,
  modelo: "GERADOR_OPORTUNIDADES", codigo: "EXEMPLO1", ativo: true, created_at: "",
};

describe("dashboard SPL", () => {
  it("separa previstos e fechados e divide a comissão pelo modelo", () => {
    const resumo = resumirDashboardSpl([
      cliente("novo", "NOVO", 100_000),
      cliente("fechado", "FECHADO", 200_000),
      cliente("perdido", "PERDIDO", 500_000),
    ], [vendedor], "GERADOR_NEGOCIOS");
    expect(resumo.previsto).toBe(100_000);
    expect(resumo.fechado).toBe(200_000);
    expect(resumo.comissaoImobiliaria).toBe(1_237.50);
    expect(resumo.comissaoVendedores).toBe(1_237.50);
    expect(resumo.vendedores).toEqual([{ id: "v1", nome: "Vendedor Um", indicacoes: 3, comissao: 1_237.50 }]);
    expect(resumo.indicacoes[0].vendedor).toBe("Vendedor Um");
  });

  it("mantém ausência de valores e de modelo de recebimento", () => {
    const resumo = resumirDashboardSpl([cliente("novo", "NOVO", null)], [vendedor], "SOMENTE_LIBERAR_CARTEIRA");
    expect(resumo.previsto).toBeNull();
    expect(resumo.fechado).toBeNull();
    expect(resumo.comissaoImobiliaria).toBeNull();
    expect(resumo.vendedores[0].comissao).toBeNull();
  });

  it("aceita a assinatura apenas para o vendedor e painel que a emitiram", () => {
    const caminho = caminhoDashboardVendedor("Imobiliária", "EXEMPLO1", "v1", "chave-ficticia");
    const acesso = new URL(caminho, "https://exemplo.invalid").searchParams.get("acesso");
    expect(acessoDashboardVendedorValido("chave-ficticia", "v1", acesso)).toBe(true);
    expect(acessoDashboardVendedorValido("chave-ficticia", "v2", acesso)).toBe(false);
    expect(acessoDashboardVendedorValido("outra-chave", "v1", acesso)).toBe(false);
    expect(acessoDashboardVendedorValido("chave-ficticia", "v1", null)).toBe(false);
  });
});
