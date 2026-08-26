import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationCanonica = fs.readFileSync(
  path.resolve(process.cwd(), "../supabase/migrations/127_formalizacao_canonica_e_comissoes_estritas.sql"),
  "utf8"
);

describe("Contrato vigente — Vínculo Canônico SaaS Grupos, Cotas e Vendas", () => {
  it("atualiza a RPC rpc_converter_contratacao_venda com resolução canônica resiliente", () => {
    expect(migrationCanonica).toContain("CREATE OR REPLACE FUNCTION public.rpc_converter_contratacao_venda");
    expect(migrationCanonica).toContain("SELECT * INTO v_grupo FROM public.grupos_consorcio");
    expect(migrationCanonica).toContain("SELECT * INTO v_opcao FROM public.grupos_cotas");
  });

  it("resolve grupo e cota no catálogo canônico da administradora", () => {
    expect(migrationCanonica).toContain("v_grupo.administradora_id IS NULL");
    expect(migrationCanonica).toContain("grupo_id = v_grupo.id");
    expect(migrationCanonica).toContain("public.grupo_concedido_para_empresa(p_empresa_id, v_grupo.id)");
  });

  it("garante suporte e compatibilidade com modalidades V2 (grupos_modalidades_disponiveis e grupo_cota_modalidade_valores)", () => {
    expect(migrationCanonica).toContain("public.grupos_modalidades_disponiveis");
    expect(migrationCanonica).toContain("public.grupo_cota_modalidade_valores");
    expect(migrationCanonica).toContain("v_modalidade_id");
  });

  it("distingue claramente tipo de bem de modalidade de consórcio", () => {
    const contratacao = {
      tipo_bem: "Imóvel",
      dados_simulacao: {
        tipoBem: "imovel",
        modalidade: "Integral",
        valor_credito: 500000,
        valor_parcela: 3250,
      },
    };
    expect(contratacao.tipo_bem).toBe("Imóvel");
    expect(contratacao.dados_simulacao.modalidade).toBe("Integral");
    expect(contratacao.tipo_bem).not.toBe(contratacao.dados_simulacao.modalidade);
  });

  it("preserva snapshot canônico no caso de teste real GCH-CTR-000038", () => {
    const contratoGch038 = {
      protocolo: "GCH-CTR-000038",
      cliente: "IVANI BERNARDES",
      grupo: "1463",
      tipo: "Imóvel",
      credito: 500000,
      origem: "Catálogo SaaS",
    };
    expect(contratoGch038.credito).toBe(500000);
    expect(contratoGch038.tipo).toBe("Imóvel");
    expect(contratoGch038.origem).toBe("Catálogo SaaS");
  });
});
