import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const empresa = "00000000-0000-0000-0000-000000000001";
const importacao = "00000000-0000-0000-0000-000000000002";
const item1 = "00000000-0000-0000-0000-000000000003";
const item2 = "00000000-0000-0000-0000-000000000004";
const db = new PGlite();

describe("repasse divergente: persistência e limite da baixa automática", () => {
  beforeAll(async () => {
    // Contratos mínimos do banco; a rotina financeira simulada rejeita excesso,
    // grava parcialmente antes do erro e permite verificar rollback por linha.
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE erp_repasse_importacoes (
        id uuid PRIMARY KEY, empresa_id uuid, recebimento_id uuid,
        status text DEFAULT 'PRONTO', updated_at timestamptz, valor_total_bruto numeric
      );
      CREATE TABLE erp_repasse_importacao_itens (
        id uuid PRIMARY KEY, empresa_id uuid, importacao_id uuid, linha integer,
        previsao_franquia_id uuid, status_conciliacao text,
        valor_comissao numeric, alertas jsonb DEFAULT '[]', updated_at timestamptz
      );
      CREATE TABLE baixas (item_id uuid, valor numeric);
      CREATE TABLE tentativas (item_id uuid);
      CREATE FUNCTION sincronizar_item_repasse_canonico_203(uuid, uuid, uuid) RETURNS numeric
      LANGUAGE plpgsql SET search_path=public AS $$
      DECLARE v_item erp_repasse_importacao_itens%ROWTYPE; v_total numeric; v_atual numeric;
      BEGIN
        SELECT * INTO v_item FROM erp_repasse_importacao_itens WHERE id=$2 AND empresa_id=$1;
        IF NOT FOUND THEN RAISE EXCEPTION 'Item fora do tenant'; END IF;
        INSERT INTO tentativas VALUES ($2);
        SELECT valor_total_bruto INTO v_total FROM erp_repasse_importacoes WHERE id=v_item.importacao_id;
        SELECT coalesce(sum(valor),0) INTO v_atual FROM baixas;
        IF EXISTS (SELECT 1 FROM baixas WHERE item_id=$2) THEN RETURN 0; END IF;
        IF v_atual+v_item.valor_comissao>v_total THEN
          RAISE EXCEPTION 'Saldo do recebimento insuficiente para completar a linha do relatorio';
        END IF;
        INSERT INTO baixas VALUES ($2, v_item.valor_comissao);
        RETURN v_item.valor_comissao;
      END $$;
    `);
    await db.exec(readFileSync(path.resolve(process.cwd(), "../supabase/migrations/313_repasse_divergencia_total_nao_bloqueante.sql"), "utf8"));
    await db.exec(`
      CREATE TRIGGER sincronizar_item AFTER INSERT OR UPDATE OF previsao_franquia_id, status_conciliacao
        ON erp_repasse_importacao_itens FOR EACH ROW EXECUTE FUNCTION trg_sincronizar_item_repasse_282();
      CREATE FUNCTION teste_recebimento() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
        PERFORM sincronizar_importacao_repasse_canonica_282(NEW.empresa_id,NEW.id,NULL); RETURN NEW;
      END $$;
      CREATE TRIGGER recebimento AFTER UPDATE OF recebimento_id ON erp_repasse_importacoes
        FOR EACH ROW EXECUTE FUNCTION teste_recebimento();
      INSERT INTO erp_repasse_importacoes(id,empresa_id,valor_total_bruto) VALUES ('${importacao}','${empresa}',8352.58);
      INSERT INTO erp_repasse_importacao_itens(id,empresa_id,importacao_id,linha,previsao_franquia_id,status_conciliacao,valor_comissao)
      VALUES ('${item1}','${empresa}','${importacao}',1,'${item1}','VINCULADO_AUTO',8000),
        ('${item2}','${empresa}','${importacao}',2,'${item2}','VINCULADO_AUTO',1318);
    `);
  }, 30000);
  afterAll(async () => { await db.close(); });

  it("mantém relatório e todas as linhas quando o recebimento é registrado", async () => {
    await db.exec(`UPDATE erp_repasse_importacoes SET recebimento_id='${importacao}' WHERE id='${importacao}'`);
    const result = await db.query("SELECT status, valor_total_bruto::float AS total FROM erp_repasse_importacoes");
    expect(result.rows).toEqual([{ status: "PENDENTE", total: 8352.58 }]);
    expect((await db.query("SELECT count(*)::int AS n, sum(valor_comissao)::float AS total FROM erp_repasse_importacao_itens")).rows)
      .toEqual([{ n: 2, total: 9318 }]);
    expect((await db.query("SELECT sum(valor)::float AS total FROM baixas")).rows).toEqual([{ total: 8000 }]);
    expect((await db.query(`SELECT count(*)::int AS n FROM tentativas WHERE item_id='${item2}'`)).rows).toEqual([{ n: 0 }]);
  });

  it("permite releitura e novo vínculo sem duplicar baixa nem alertas", async () => {
    await db.exec(`SELECT sincronizar_importacao_repasse_canonica_282('${empresa}','${importacao}',NULL);
      UPDATE erp_repasse_importacao_itens SET status_conciliacao='VINCULADO_MANUAL' WHERE id='${item2}';`);
    expect((await db.query("SELECT count(*)::int AS n FROM baixas")).rows).toEqual([{ n: 1 }]);
    expect((await db.query(`SELECT jsonb_array_length(alertas) AS n FROM erp_repasse_importacao_itens WHERE id='${item2}'`)).rows).toEqual([{ n: 1 }]);
  });

  it("continua propagando erros distintos de saldo insuficiente", async () => {
    await expect(db.query(`SELECT tentar_sincronizar_item_repasse_313('${importacao}','${item1}',NULL)`))
      .rejects.toThrow("Item fora do tenant");
  });
});
