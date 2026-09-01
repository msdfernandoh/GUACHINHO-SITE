import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "..", "supabase", "migrations", "192_imposto_automatico_comissoes_incrementais.sql"),
  "utf8",
);

describe("Fase 196 — imposto automático e incremental", () => {
  it("aplica a configuração fiscal durante a geração de novas previsões", () => {
    expect(migration).toContain("a_comissao_fiscal_franquia_automatico_192");
    expect(migration).toContain("a_comissao_fiscal_participante_automatico_192");
    expect(migration).toContain("'AUTOMATICA_NA_GERACAO'");
    expect(migration).toContain("NEW.valor_previsto:=v_liquido");
  });

  it("reprocessa somente previsões sem imposto e sem pagamento", () => {
    expect(migration).toContain("p.snapshot_regra->'fiscal_lote' IS NULL");
    expect(migration).toContain("COALESCE(p.valor_pago,0)=0");
    expect(migration).toContain("financeiro_pagamento_itens");
    expect(migration).toContain("valor_elegivel=v_elegivel");
    expect(migration).toContain("'RECONCILIACAO_INCREMENTAL'");
  });

  it("faz o lote sempre procurar novas linhas sem recalcular as anteriores", () => {
    expect(migration).toContain("rpc_aplicar_imposto_comissoes_lote_antes_192");
    expect(migration).toContain("comissao_reconciliar_fiscal_pendente_192");
    expect(migration).toContain("'incremental',v_incremental");
    expect(migration).toContain("APLICAR_IMPOSTO_INCREMENTAL");
  });
});

describe("migration 192 em PostgreSQL isolado", () => {
  const empresa = "00000000-0000-4000-8000-000000000001";
  const config = "00000000-0000-4000-8000-000000000002";
  const venda = "00000000-0000-4000-8000-000000000003";
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${empresa}'::uuid $$;
      CREATE FUNCTION public.current_usuario_id() RETURNS uuid LANGUAGE sql AS $$ SELECT auth.uid() $$;
      CREATE FUNCTION public.can_write_tenant_internal(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      CREATE TABLE empresa_configuracoes_fiscais(id uuid PRIMARY KEY,empresa_id uuid,percentual_imposto numeric,
        vigencia_inicio date,vigencia_fim date,ativo boolean);
      CREATE TABLE vendas(id uuid PRIMARY KEY,empresa_id uuid,data_venda timestamptz);
      CREATE TABLE comissao_previsoes_franquia(id uuid PRIMARY KEY,empresa_id uuid,venda_id uuid,
        valor_previsto numeric,valor_bruto numeric,percentual_imposto numeric,valor_imposto numeric,
        valor_liquido numeric,snapshot_regra jsonb DEFAULT '{}',updated_at timestamptz);
      CREATE TABLE comissao_previsoes_participantes(id uuid PRIMARY KEY,empresa_id uuid,venda_id uuid,
        valor_previsto numeric,valor_elegivel numeric DEFAULT 0,valor_pago numeric DEFAULT 0,
        conferido_por_participante boolean DEFAULT false,status text DEFAULT 'prevista',
        snapshot_regra jsonb DEFAULT '{}',updated_at timestamptz);
      CREATE TABLE financeiro_pagamento_itens(previsao_participante_id uuid);
      CREATE TABLE audit_logs_central(empresa_id uuid,usuario_id uuid,modulo text,acao text,
        entidade_tipo text,entidade_id uuid,detalhes jsonb);
      CREATE FUNCTION public.rpc_aplicar_imposto_comissoes_lote(uuid,uuid,boolean DEFAULT false)
        RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
      INSERT INTO empresa_configuracoes_fiscais VALUES('${config}','${empresa}',17.5,'2026-07-01','2027-07-01',true);
      INSERT INTO vendas VALUES('${venda}','${empresa}','2026-09-01');
    `);
    await db.exec(migration);
  }, 30_000);

  afterAll(async () => { await db?.close(); });

  it("grava e desconta os fatos fiscais automaticamente na inserção", async () => {
    await db.exec(`
      INSERT INTO comissao_previsoes_franquia(id,empresa_id,venda_id,valor_previsto,snapshot_regra)
      VALUES('00000000-0000-4000-8000-000000000010','${empresa}','${venda}',1000,'{"imposto_aliquota":17.5}');
      INSERT INTO comissao_previsoes_participantes(id,empresa_id,venda_id,valor_previsto,snapshot_regra)
      VALUES('00000000-0000-4000-8000-000000000011','${empresa}','${venda}',500,'{"reparticao_comercial":"aplicada"}');
    `);
    const franquia = (await db.query<Record<string, string>>(
      "SELECT valor_bruto,valor_imposto,valor_liquido FROM comissao_previsoes_franquia",
    )).rows[0];
    const participante = (await db.query<{ valor_previsto: string; snapshot_regra: { fiscal_lote: { imposto_valor: number } } }>(
      "SELECT valor_previsto,snapshot_regra FROM comissao_previsoes_participantes",
    )).rows[0];
    expect([Number(franquia.valor_bruto), Number(franquia.valor_imposto), Number(franquia.valor_liquido)])
      .toEqual([1000, 175, 825]);
    expect(Number(participante.valor_previsto)).toBe(412.5);
    expect(Number(participante.snapshot_regra.fiscal_lote.imposto_valor)).toBe(87.5);
  });

  it("o lote incremental alcança uma linha elegível antiga, mas nunca uma paga", async () => {
    await db.exec(`
      ALTER TABLE comissao_previsoes_participantes DISABLE TRIGGER a_comissao_fiscal_participante_automatico_192;
      INSERT INTO comissao_previsoes_participantes(id,empresa_id,venda_id,valor_previsto,valor_elegivel,status,snapshot_regra)
      VALUES('00000000-0000-4000-8000-000000000012','${empresa}','${venda}',200,200,'elegivel','{"reparticao_comercial":"aplicada"}'),
            ('00000000-0000-4000-8000-000000000013','${empresa}','${venda}',300,300,'elegivel','{"reparticao_comercial":"aplicada"}');
      UPDATE comissao_previsoes_participantes SET valor_pago=1 WHERE id='00000000-0000-4000-8000-000000000013';
      ALTER TABLE comissao_previsoes_participantes ENABLE TRIGGER a_comissao_fiscal_participante_automatico_192;
      SELECT public.rpc_aplicar_imposto_comissoes_lote('${empresa}','${config}',true);
    `);
    const rows = (await db.query<{ id: string; valor_previsto: string; valor_elegivel: string; snapshot_regra: Record<string, unknown> }>(
      "SELECT id,valor_previsto,valor_elegivel,snapshot_regra FROM comissao_previsoes_participantes WHERE id IN ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000013') ORDER BY id",
    )).rows;
    expect([Number(rows[0].valor_previsto), Number(rows[0].valor_elegivel)]).toEqual([165, 165]);
    expect(rows[0].snapshot_regra).toHaveProperty("fiscal_lote");
    expect([Number(rows[1].valor_previsto), Number(rows[1].valor_elegivel)]).toEqual([300, 300]);
    expect(rows[1].snapshot_regra).not.toHaveProperty("fiscal_lote");
  });
});
