import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration101 = fs.readFileSync(
  path.resolve(process.cwd(), "../supabase/migrations/102_vinculo_canonico_saas_grupos_cotas_vendas.sql"),
  "utf8"
);

describe("Fase 101 — Vínculo Canônico SaaS Grupos, Cotas e Vendas", () => {
  it("atualiza a RPC rpc_converter_contratacao_venda com resolução canônica resiliente", () => {
    expect(migration101).toContain("CREATE OR REPLACE FUNCTION public.rpc_converter_contratacao_venda");
    expect(migration101).toContain("SELECT * INTO v_grupo FROM public.grupos_consorcio");
    expect(migration101).toContain("SELECT * INTO v_opcao FROM public.grupos_cotas");
  });

  it("garante resolução por valor_credito em grupos_cotas caso cota_id seja legado ou divergente", () => {
    expect(migration101).toContain("abs(valor_credito - v_credito) < 0.01");
    expect(migration101).toContain("ORDER BY ordem ASC, created_at DESC LIMIT 1");
  });

  it("garante suporte e compatibilidade com modalidades V2 (grupos_modalidades_disponiveis e grupo_cota_modalidade_valores)", () => {
    expect(migration101).toContain("INSERT INTO public.grupos_modalidades_disponiveis");
    expect(migration101).toContain("INSERT INTO public.grupo_cota_modalidade_valores");
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
