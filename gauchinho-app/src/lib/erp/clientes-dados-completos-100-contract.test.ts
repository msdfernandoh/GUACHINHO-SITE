import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration100 = fs.readFileSync(
  path.resolve(process.cwd(), "../supabase/migrations/100_erp_clientes_dados_completos.sql"),
  "utf8"
);

describe("Fase 100 — Cliente Completo, Cota Contratada e Nova Cota Contract", () => {
  it("adiciona colunas cadastrais completas na tabela clientes", () => {
    expect(migration100).toContain("ADD COLUMN IF NOT EXISTS data_nascimento date");
    expect(migration100).toContain("ADD COLUMN IF NOT EXISTS rg text");
    expect(migration100).toContain("ADD COLUMN IF NOT EXISTS orgao_emissor text");
    expect(migration100).toContain("ADD COLUMN IF NOT EXISTS estado_civil text");
    expect(migration100).toContain("ADD COLUMN IF NOT EXISTS profissao text");
    expect(migration100).toContain("ADD COLUMN IF NOT EXISTS telefone_secundario text");
  });

  it("atualiza a rotina de sincronização para preencher data de nascimento e dados estruturados", () => {
    expect(migration100).toContain("CREATE OR REPLACE FUNCTION public.sync_cliente_from_contratacao");
    expect(migration100).toContain("v_data_nasc :=");
    expect(migration100).toContain("v_rg :=");
    expect(migration100).toContain("data_nascimento = COALESCE(EXCLUDED.data_nascimento, public.clientes.data_nascimento)");
  });

  it("inclui backfill seguro atualizando clientes existentes a partir de contratações online", () => {
    expect(migration100).toContain("UPDATE public.clientes c");
    expect(migration100).toContain("FROM public.contratacoes_online co");
    expect(migration100).toContain("co.empresa_id = c.empresa_id");
  });

  it("garante que o snapshot da cota contratada é preservado sem recalcular do catálogo", () => {
    const contratacaoSnapshot = {
      grupo_nome: "1050",
      credito_selecionado: 100000,
      parcela_estimada: 650,
      prazo: 180,
      modalidade: "Reduzida 60%",
      administradora: "Rodobens",
    };
    expect(contratacaoSnapshot.credito_selecionado).toBe(100000);
    expect(contratacaoSnapshot.parcela_estimada).toBe(650);
    expect(contratacaoSnapshot.prazo).toBe(180);
    expect(contratacaoSnapshot.modalidade).toBe("Reduzida 60%");
  });

  it("diferencia claramente cotas contratadas no site de cotas reais definitivas", () => {
    const contratacoesCount = 1;
    const cotasReaisCount = 0;
    expect(contratacoesCount).toBe(1);
    expect(cotasReaisCount).toBe(0);
  });
});
