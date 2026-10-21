import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
const db = new PGlite();
const empresa = "00000000-0000-0000-0000-000000000001";
const item = "00000000-0000-0000-0000-000000000002";
const previsao = "00000000-0000-0000-0000-000000000003";
const recebimento = "00000000-0000-0000-0000-000000000004";
beforeAll(async () => {
  await db.exec(`
    CREATE TABLE erp_repasse_importacao_itens(id uuid PRIMARY KEY,empresa_id uuid,importacao_id uuid,previsao_franquia_id uuid,valor_comissao numeric);
    CREATE TABLE erp_repasse_importacoes(id uuid PRIMARY KEY,empresa_id uuid,recebimento_id uuid);
    CREATE TABLE financeiro_recebimentos(id uuid PRIMARY KEY,empresa_id uuid,valor_total numeric);
    CREATE TABLE financeiro_recebimento_classificacoes(recebimento_id uuid,empresa_id uuid,valor numeric);
    CREATE TABLE financeiro_recebimento_itens(recebimento_id uuid,previsao_franquia_id uuid,valor_liquidado numeric);
    CREATE TABLE erp_repasse_item_baixas(empresa_id uuid,item_importacao_id uuid,recebimento_id uuid,previsao_franquia_id uuid,valor_liquidado numeric,evento text,idempotency_key text,criado_por uuid,UNIQUE(empresa_id,idempotency_key));
    CREATE TABLE comissao_previsoes_franquia(id uuid PRIMARY KEY,empresa_id uuid,valor_bruto numeric,valor_previsto numeric,valor_liquido numeric,valor_imposto numeric,percentual_imposto numeric,base_calculo_valor numeric,snapshot_regra jsonb,updated_at timestamptz);
    CREATE TABLE comissao_previsoes_participantes(id uuid PRIMARY KEY,empresa_id uuid,previsao_franquia_id uuid,valor_previsto numeric,valor_elegivel numeric,valor_pago numeric,base_calculo_valor numeric,snapshot_regra jsonb,updated_at timestamptz,CHECK(valor_pago<=valor_elegivel AND valor_elegivel<=valor_previsto));
    CREATE FUNCTION recalcular_liquidacao_previsao_repasse_203(uuid,uuid) RETURNS void LANGUAGE sql AS $$ UPDATE comissao_previsoes_participantes SET valor_elegivel=valor_previsto WHERE empresa_id=$1 AND previsao_franquia_id=$2 $$;
  `);
  await db.exec(readFileSync(resolve(process.cwd(), "../supabase/migrations/326_repasse_ajuste_rateio_idempotente.sql"), "utf8"));
});
afterAll(async () => db.close());
beforeEach(async () => {
  await db.exec(`TRUNCATE erp_repasse_importacao_itens,erp_repasse_importacoes,financeiro_recebimentos,financeiro_recebimento_classificacoes,financeiro_recebimento_itens,erp_repasse_item_baixas,comissao_previsoes_franquia,comissao_previsoes_participantes;
  INSERT INTO erp_repasse_importacao_itens VALUES('${item}','${empresa}','${item}','${previsao}',1332.60);
  INSERT INTO erp_repasse_importacoes VALUES('${item}','${empresa}','${recebimento}');
  INSERT INTO financeiro_recebimentos VALUES('${recebimento}','${empresa}',2000);
  INSERT INTO comissao_previsoes_franquia(id,empresa_id,valor_bruto,valor_previsto,valor_liquido,percentual_imposto) VALUES('${previsao}','${empresa}',1250,1250,1031.25,17.5);
  INSERT INTO comissao_previsoes_participantes(id,empresa_id,previsao_franquia_id,valor_previsto,valor_elegivel,valor_pago,snapshot_regra) VALUES('${previsao}','${empresa}','${previsao}',1031.25,0,0,'{"fiscal_lote":{"valor_bruto":1250}}');`);
});
const sincronizar = () => db.query(`SELECT sincronizar_item_repasse_canonico_203('${empresa}','${item}',NULL)`);
it("preserva o centavo e a razão original mesmo após reconstrução fiscal do bruto", async () => {
  await sincronizar();
  await db.exec(`UPDATE comissao_previsoes_participantes SET snapshot_regra=jsonb_set(snapshot_regra,'{fiscal_lote,valor_bruto}',to_jsonb(round(valor_previsto/0.825,2)));`);
  await sincronizar(); await sincronizar();
  const p = await db.query<{ valor_previsto: string; valor_elegivel: string }>("SELECT valor_previsto,valor_elegivel FROM comissao_previsoes_participantes");
  expect(Number(p.rows[0].valor_previsto)).toBe(1099.39); expect(Number(p.rows[0].valor_elegivel)).toBe(1099.39);
  expect((await db.query<{ n: number }>("SELECT count(*)::int n FROM financeiro_recebimento_itens")).rows[0].n).toBe(1);
});
it("reduz previsão e elegibilidade juntas quando o relatório paga menos", async () => {
  await db.exec(`UPDATE erp_repasse_importacao_itens SET valor_comissao=318; UPDATE comissao_previsoes_participantes SET valor_elegivel=1031.25;`);
  await sincronizar();
  const p = await db.query<{ valor_previsto: string; valor_elegivel: string }>("SELECT valor_previsto,valor_elegivel FROM comissao_previsoes_participantes");
  expect(Number(p.rows[0].valor_previsto)).toBe(262.35); expect(Number(p.rows[0].valor_elegivel)).toBe(262.35);
});
it("não permite reduzir comissão já paga e reverte a alocação da tentativa", async () => {
  await db.exec(`UPDATE comissao_previsoes_participantes SET valor_previsto=1200,valor_elegivel=1100,valor_pago=1100;`);
  await expect(sincronizar()).rejects.toThrow("comissao ja paga");
  expect((await db.query<{ n: number }>("SELECT count(*)::int n FROM financeiro_recebimento_itens")).rows[0].n).toBe(0);
});
it("continua limitando a baixa ao saldo efetivamente recebido", async () => {
  await db.exec("UPDATE financeiro_recebimentos SET valor_total=100");
  await expect(sincronizar()).rejects.toThrow("Saldo do recebimento insuficiente");
  expect((await db.query<{ n: number }>("SELECT count(*)::int n FROM financeiro_recebimento_itens")).rows[0].n).toBe(0);
});
