import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const empresa = "00000000-0000-4000-8000-000000000001";
const contratacao = "00000000-0000-4000-8000-000000000002";
const grupo = "00000000-0000-4000-8000-000000000003";
const produto = "00000000-0000-4000-8000-000000000004";
const venda = "00000000-0000-4000-8000-000000000005";

beforeAll(async () => {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
      $$ SELECT '${empresa}'::uuid $$;
    CREATE FUNCTION public.has_company_permission(uuid,text) RETURNS boolean
      LANGUAGE sql AS $$ SELECT $1 = '${empresa}'::uuid $$;
    CREATE TABLE public.contratacoes_online (
      id uuid PRIMARY KEY, empresa_id uuid, dados_simulacao jsonb,
      cota_id text, grupo_id uuid, credito_selecionado numeric,
      parcela_estimada numeric, quantidade_cotas integer, updated_at timestamptz
    );
    CREATE TABLE public.grupos_cotas (
      id uuid PRIMARY KEY, grupo_id uuid, ativo boolean, valor_credito numeric
    );
    CREATE TABLE public.vendas (
      id uuid PRIMARY KEY, empresa_id uuid, contratacao_id uuid,
      quantidade_cotas integer, valor_credito numeric, parcela numeric,
      snapshot_venda jsonb, updated_at timestamptz
    );
    CREATE TABLE public.cotas_definitivas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid,
      venda_id uuid, administradora_id uuid, grupo_id uuid, numero_grupo text,
      numero_cota text, ordem_cota integer, valor_credito numeric, prazo integer,
      parcela numeric, status text, participante_comercial_id uuid,
      organizacao_parceira_id uuid, snapshot_cota jsonb, prazo_original_grupo integer,
      parcelas_restantes_venda integer, prazo_referencia_em date,
      created_at timestamptz DEFAULT now(), updated_at timestamptz,
      UNIQUE(venda_id, ordem_cota)
    );
    CREATE TABLE public.contratacoes_formalizacao_historico (
      empresa_id uuid, contratacao_id uuid, evento text, descricao text, dados jsonb
    );
    CREATE TABLE public.previsoes_teste (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), venda_id uuid, valor numeric
    );
    CREATE TABLE public.recebimentos_teste (
      previsao_id uuid REFERENCES public.previsoes_teste(id), valor numeric
    );
    -- Simula o núcleo append-only: a resposta original conserva reused=false.
    CREATE FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text)
    RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM public.vendas WHERE contratacao_id=$2) THEN
        INSERT INTO public.vendas(id,empresa_id,contratacao_id,snapshot_venda)
          VALUES('${venda}',$1,$2,'{}');
        INSERT INTO public.cotas_definitivas(empresa_id,venda_id,ordem_cota)
          VALUES($1,'${venda}',1);
      END IF;
      RETURN '{"reused":false,"previsoes":{}}'::jsonb;
    END $$;
    CREATE FUNCTION public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text)
    RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
      DELETE FROM public.previsoes_teste WHERE venda_id=$2;
      INSERT INTO public.previsoes_teste(venda_id,valor) VALUES($2,4500);
      RETURN '{}'::jsonb;
    END $$;
    INSERT INTO public.grupos_cotas VALUES('${produto}','${grupo}',true,200000);
    INSERT INTO public.contratacoes_online
      (id,empresa_id,cota_id,grupo_id,credito_selecionado,parcela_estimada,dados_simulacao)
      VALUES('${contratacao}','${empresa}','${produto}','${grupo}',600000,3228.75,'{}');
  `);
  await db.exec(fs.readFileSync(path.resolve(process.cwd(),
    "../supabase/migrations/327_formalizacao_multicotas_repeticao_segura.sql"), "utf8"));
}, 30000);

afterAll(async () => { await db.close(); });

it("cria três cotas e preserva a previsão recebida ao repetir com resposta antiga", async () => {
  const call = `SELECT public.rpc_converter_contratacao_venda_multicotas(
    '${empresa}','${contratacao}',3,'mesma-operacao') AS resultado`;
  const first = await db.query<{ resultado: { reused: boolean } }>(call);
  expect(first.rows[0].resultado.reused).toBe(false);
  await db.exec(`
    INSERT INTO public.recebimentos_teste SELECT id,4500 FROM public.previsoes_teste;
    UPDATE public.cotas_definitivas SET numero_cota='0467' WHERE ordem_cota=1;
  `);
  const before = await db.query("SELECT * FROM public.previsoes_teste ORDER BY id");
  const second = await db.query<{ resultado: { reused: boolean } }>(call);
  expect(second.rows[0].resultado.reused).toBe(true);
  expect((await db.query("SELECT * FROM public.previsoes_teste ORDER BY id")).rows).toEqual(before.rows);
  const totals = await db.query(`SELECT count(*)::int AS cotas,
    sum(valor_credito)::text AS credito, sum(parcela)::text AS parcela,
    max(numero_cota) AS numero FROM public.cotas_definitivas`);
  expect(totals.rows[0]).toEqual({ cotas: 3, credito: "600000", parcela: "3228.75", numero: "0467" });
  expect((await db.query("SELECT count(*)::int AS n FROM public.recebimentos_teste")).rows[0].n).toBe(1);
  await expect(db.query(`SELECT public.rpc_converter_contratacao_venda_multicotas(
    '${empresa}','${contratacao}',2,'outra-quantidade')`)).rejects.toThrow(/outra quantidade/);
  await expect(db.query(`SELECT public.rpc_converter_contratacao_venda_multicotas(
    '00000000-0000-4000-8000-000000000099','${contratacao}',3,'outro-tenant')`)).rejects.toThrow(/Sem permissão/);
}, 30000);
