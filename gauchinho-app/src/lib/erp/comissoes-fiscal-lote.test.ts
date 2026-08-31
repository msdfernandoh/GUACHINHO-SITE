import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { lerFiscalParticipante } from "./comissoes-fiscal-extrato";

const empresa = "00000000-0000-4000-8000-000000000001";
const outraEmpresa = "00000000-0000-4000-8000-000000000002";
const config = "00000000-0000-4000-8000-000000000010";
const configOutra = "00000000-0000-4000-8000-000000000011";
const venda = "00000000-0000-4000-8000-000000000020";
const franquia = "00000000-0000-4000-8000-000000000030";
const participante = "00000000-0000-4000-8000-000000000040";
const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/170_comissoes_aplicacao_fiscal_lote.sql"), "utf8");

describe("aplicação fiscal em PostgreSQL isolado", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
        SELECT nullif(current_setting('test.usuario', true), '')::uuid $$;
      CREATE FUNCTION public.current_usuario_id() RETURNS uuid LANGUAGE sql AS $$ SELECT auth.uid() $$;
      CREATE FUNCTION public.can_write_tenant_internal(p_empresa_id uuid) RETURNS boolean LANGUAGE sql AS $$
        SELECT p_empresa_id::text = current_setting('test.empresa', true)
          AND current_setting('test.admin', true) = 'true' $$;
      CREATE TABLE empresa_configuracoes_fiscais (
        id uuid PRIMARY KEY, empresa_id uuid, ativo boolean DEFAULT true, percentual_imposto numeric
      );
      CREATE TABLE vendas (id uuid PRIMARY KEY, empresa_id uuid, status text DEFAULT 'confirmada');
      CREATE TABLE comissao_previsoes_franquia (
        id uuid PRIMARY KEY, empresa_id uuid, venda_id uuid, status text DEFAULT 'prevista',
        valor_liquidado numeric DEFAULT 0, valor_bruto numeric, valor_previsto numeric,
        percentual_imposto numeric, valor_imposto numeric, valor_liquido numeric,
        snapshot_regra jsonb DEFAULT '{}', updated_at timestamptz
      );
      CREATE TABLE comissao_previsoes_participantes (
        id uuid PRIMARY KEY, empresa_id uuid, venda_id uuid, previsao_franquia_id uuid,
        status text DEFAULT 'prevista', valor_pago numeric DEFAULT 0, valor_elegivel numeric DEFAULT 0,
        conferido_por_participante boolean DEFAULT false, valor_previsto numeric,
        snapshot_regra jsonb DEFAULT '{}', updated_at timestamptz
      );
      CREATE TABLE financeiro_recebimento_itens (previsao_franquia_id uuid);
      CREATE TABLE financeiro_pagamento_itens (previsao_participante_id uuid);
      CREATE TABLE audit_logs_central (
        empresa_id uuid, usuario_id uuid, modulo text, acao text, entidade_tipo text, entidade_id uuid, detalhes jsonb
      );
    `);
    await db.exec(migration);
  }, 30000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec(`TRUNCATE empresa_configuracoes_fiscais, vendas, comissao_previsoes_franquia,
      comissao_previsoes_participantes, financeiro_recebimento_itens, financeiro_pagamento_itens, audit_logs_central;
      SET test.usuario = '${empresa}'; SET test.empresa = '${empresa}'; SET test.admin = 'true';
      INSERT INTO empresa_configuracoes_fiscais VALUES ('${config}', '${empresa}', true, 10), ('${configOutra}', '${outraEmpresa}', true, 20);
      INSERT INTO vendas (id, empresa_id) VALUES ('${venda}', '${empresa}');
      INSERT INTO comissao_previsoes_franquia (id, empresa_id, venda_id, valor_previsto, snapshot_regra)
        VALUES ('${franquia}', '${empresa}', '${venda}', 1000, '{"imposto_aliquota":10,"valor_liquido":900}');
      INSERT INTO comissao_previsoes_participantes (id, empresa_id, venda_id, previsao_franquia_id, valor_previsto, snapshot_regra)
        VALUES ('${participante}', '${empresa}', '${venda}', '${franquia}', 500, '{"reparticao_comercial":"aplicada"}');
    `);
  });
  async function rpc(confirmar: boolean, configuracao = config) {
    const result = await db.query<{ resultado: Record<string, number | boolean> }>(
      "SELECT public.rpc_aplicar_imposto_comissoes_lote($1, $2, $3) AS resultado", [empresa, configuracao, confirmar]);
    return result.rows[0].resultado;
  }
  async function valor() {
    return Number((await db.query<{ valor_previsto: string }>("SELECT valor_previsto FROM comissao_previsoes_participantes")).rows[0].valor_previsto);
  }
  it("gera prévia sem gravar e aplica o imposto com auditoria somente na confirmação", async () => {
    const previa = await rpc(false);
    expect(previa).toMatchObject({ participantes: 1, franquia: 1, liquido_anterior: 500, liquido_novo: 450, imposto_participantes: 50 });
    expect(await valor()).toBe(500);
    expect((await db.query("SELECT * FROM audit_logs_central")).rows).toHaveLength(0);
    await rpc(true);
    expect(await valor()).toBe(450);
    expect((await db.query("SELECT * FROM audit_logs_central")).rows).toHaveLength(1);
    const f = (await db.query("SELECT valor_previsto,valor_bruto,valor_imposto,valor_liquido FROM comissao_previsoes_franquia")).rows[0];
    expect(Number(f.valor_previsto)).toBe(1000); // recebível da franquia permanece bruto
    expect(Number(f.valor_imposto)).toBe(100);
    expect(Number(f.valor_liquido)).toBe(900);
  });
  it("reaplica sem desconto cumulativo e usa o bruto ao mudar a alíquota", async () => {
    await rpc(true); await rpc(true);
    expect(await valor()).toBe(450);
    await db.exec(`UPDATE empresa_configuracoes_fiscais SET percentual_imposto = 20 WHERE id = '${config}'`);
    await rpc(true);
    expect(await valor()).toBe(400);
  });
  it("atualiza comissões importadas sem vínculo com a franquia, respeitando o bruto do snapshot", async () => {
    await db.exec(`DELETE FROM comissao_previsoes_franquia;
      UPDATE comissao_previsoes_participantes SET previsao_franquia_id = NULL, valor_previsto = 400,
      snapshot_regra = '{"origem":"IMPORTACAO_LEGADO","valor_bruto":500,"imposto_aliquota":20,"imposto_valor":100,"valor_liquido":400}';`);
    await rpc(true);
    expect(await valor()).toBe(450);
    const row = (await db.query<{ snapshot_regra: Record<string, unknown> }>("SELECT snapshot_regra FROM comissao_previsoes_participantes")).rows[0];
    expect(lerFiscalParticipante(row.snapshot_regra)).toEqual({ bruto: 500, imposto: 50, aliquota: 10, liquido: 450 });
  });
  it("reconhece as previsões V2 que já foram calculadas sobre o líquido", async () => {
    await db.exec(`UPDATE comissao_previsoes_participantes SET valor_previsto = 450, snapshot_regra = '{"fonte_liquida":true}';`);
    await rpc(true);
    expect(await valor()).toBe(450);
  });
  it.each([
    "UPDATE comissao_previsoes_participantes SET valor_pago = 1",
    "UPDATE comissao_previsoes_participantes SET valor_elegivel = 1",
    "UPDATE comissao_previsoes_participantes SET status = 'cancelada'",
    "UPDATE comissao_previsoes_participantes SET conferido_por_participante = true",
    "UPDATE comissao_previsoes_franquia SET valor_liquidado = 1",
    `INSERT INTO financeiro_recebimento_itens VALUES ('${franquia}')`,
    `INSERT INTO financeiro_pagamento_itens VALUES ('${participante}')`,
    "UPDATE vendas SET status = 'cancelada'",
  ])("preserva a venda com movimento ou status protegido: %s", async (sql) => {
    await db.exec(sql);
    expect(await rpc(true)).toMatchObject({ participantes: 0, franquia: 0, vendas_protegidas: 1 });
    expect(await valor()).toBe(500);
  });
  it("não adivinha a base tributável de comissões sem origem reconhecida", async () => {
    await db.exec("UPDATE comissao_previsoes_participantes SET snapshot_regra = '{}'::jsonb");
    expect(await rpc(true)).toMatchObject({ participantes: 0, franquia: 0, vendas_sem_base_segura: 1 });
    expect(await valor()).toBe(500);
  });
  it("rejeita consultor, chamada anônima e configuração de outro tenant", async () => {
    await expect(rpc(true, configOutra)).rejects.toThrow("não encontrada nesta empresa");
    await db.exec("SET test.admin = 'false'");
    await expect(rpc(true)).rejects.toThrow("Somente o administrador");
    await db.exec("SET test.admin = 'true'; SET test.usuario = ''");
    await expect(rpc(true)).rejects.toThrow("Somente o administrador");
    expect(await valor()).toBe(500);
  });
  it("não altera vendas de outra empresa", async () => {
    await db.exec(`UPDATE vendas SET empresa_id = '${outraEmpresa}';
      UPDATE comissao_previsoes_participantes SET empresa_id = '${outraEmpresa}';
      UPDATE comissao_previsoes_franquia SET empresa_id = '${outraEmpresa}';`);
    expect(await rpc(true)).toMatchObject({ participantes: 0, franquia: 0 });
    expect(await valor()).toBe(500);
  });
  it("preserva o rateio entre consultor e SDR sem recalcular percentuais comerciais", async () => {
    await db.exec(`UPDATE comissao_previsoes_participantes SET valor_previsto = 400;
      INSERT INTO comissao_previsoes_participantes (id, empresa_id, venda_id, previsao_franquia_id, valor_previsto, snapshot_regra)
      VALUES ('00000000-0000-4000-8000-000000000041', '${empresa}', '${venda}', '${franquia}', 100, '{"reparticao_comercial":"aplicada"}');`);
    expect(await rpc(true)).toMatchObject({ participantes: 2, liquido_novo: 450 });
    const rows = (await db.query<{ valor_previsto: string }>("SELECT valor_previsto FROM comissao_previsoes_participantes ORDER BY id")).rows;
    expect(rows.map((row) => Number(row.valor_previsto))).toEqual([360, 90]);
  });
  it("reverte a transação inteira se a auditoria não puder ser registrada", async () => {
    await db.exec("ALTER TABLE audit_logs_central ADD CONSTRAINT teste_falha_auditoria CHECK (acao <> 'APLICAR_IMPOSTO_LOTE')");
    try {
      await expect(rpc(true)).rejects.toThrow("teste_falha_auditoria");
      expect(await valor()).toBe(500);
      expect((await db.query("SELECT valor_bruto FROM comissao_previsoes_franquia")).rows[0].valor_bruto).toBeNull();
    } finally {
      await db.exec("ALTER TABLE audit_logs_central DROP CONSTRAINT teste_falha_auditoria");
    }
  });
  it("não concede execução ao público, anônimo ou service role", async () => {
    const rows = (await db.query<{ papel: string; permitido: boolean }>(`SELECT papel,
      has_function_privilege(papel, 'public.rpc_aplicar_imposto_comissoes_lote(uuid,uuid,boolean)', 'EXECUTE') AS permitido
      FROM unnest(ARRAY['anon','service_role','authenticated']) papel`)).rows;
    expect(rows).toEqual([{ papel: "anon", permitido: false }, { papel: "service_role", permitido: false }, { papel: "authenticated", permitido: true }]);
  });
});

describe("leitura fiscal de importações", () => {
  it("lê alíquota zero sem inventar imposto e rejeita snapshot incompleto", () => {
    expect(lerFiscalParticipante({ origem: "IMPORTACAO_LEGADO", valor_bruto: 100, imposto_valor: 0, imposto_aliquota: 0, valor_liquido: 100 }))
      .toEqual({ bruto: 100, imposto: 0, aliquota: 0, liquido: 100 });
    expect(lerFiscalParticipante({ fiscal_lote: { valor_bruto: 100 } })).toBeNull();
  });
});
