import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve(process.cwd(), "..");
const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222", u = "33333333-3333-4333-8333-333333333333", i = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;
CREATE FUNCTION public.can_read_tenant_internal(p uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT p::text=current_setting('test.tenant',true) $$;
CREATE FUNCTION public.can_write_tenant_internal(p uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT p::text=current_setting('test.tenant',true) $$;
CREATE FUNCTION public.is_platform_superadmin() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.platform',true),'false')='true' $$;
CREATE FUNCTION public.current_usuario_id() RETURNS uuid LANGUAGE sql AS $$ SELECT auth.uid() $$;
CREATE FUNCTION public.registrar_auditoria_platform() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN coalesce(NEW,OLD); END $$;
CREATE TABLE empresas(id uuid PRIMARY KEY,configuracoes jsonb,updated_at timestamptz);
CREATE TABLE usuarios(id uuid PRIMARY KEY,ativo boolean DEFAULT true);
CREATE TABLE empresa_usuarios(empresa_id uuid,usuario_id uuid,ativo boolean DEFAULT true);
CREATE TABLE erp_modulos_catalogo(codigo text PRIMARY KEY,nome text,descricao text,status text,estado_produto text,categoria text);
CREATE TABLE plataforma_auditoria(usuario_id uuid,acao text,entidade_tipo text,entidade_id uuid,campos_alterados jsonb);
INSERT INTO empresas VALUES ('${a}','{"outro":"preservar","erp_sistema":{"habilitado":true,"modulos":["leads","vendas"]}}',now()),('${b}','{}',now());
INSERT INTO usuarios(id) VALUES ('${u}');INSERT INTO empresa_usuarios VALUES('${a}','${u}',true);
`);
    await db.exec(readFileSync(path.join(root, "supabase/migrations/310_whatsapp_cloud_api_multiempresa.sql"), "utf8"));
    await db.exec(`INSERT INTO empresa_whatsapp_conexoes(id,empresa_id,waba_id,phone_number_id,numero_exibicao,token_cifrado) VALUES('${i}','${a}','123456','234567','+55 66 99999-1234','segredo-cifrado');INSERT INTO whatsapp_mensagens(empresa_id,conexao_id,direcao,contato_numero,wa_message_id) VALUES('${a}','${i}','recebida','5566999991234','legado');`);
    await db.exec(readFileSync(path.join(root, "supabase/migrations/332_whatsapp_instancias.sql"), "utf8"));
    await db.exec('GRANT USAGE ON SCHEMA auth TO authenticated,service_role;');
}, 30000);
afterAll(async () => { await db.close(); });
describe.sequential("migration WhatsApp 332 com banco real em memória", () => {
    it("executa asserts de grants e preservação do legado", async () => { await db.exec(readFileSync(path.join(root, "supabase/tests/332_whatsapp_rollback.sql"), "utf8")); const r = await db.query<{
        numero_celular: string;
    }>(`select numero_celular from whatsapp_instancias where id='${i}'`); expect(r.rows[0].numero_celular).toBe('+5566999991234'); });
    it("membro lê apenas a própria instância e nunca o token", async () => { await db.exec(`SET ROLE authenticated;SELECT set_config('test.tenant','${b}',false);`); expect((await db.query('SELECT id FROM whatsapp_instancias')).rows).toHaveLength(0); await db.exec(`SELECT set_config('test.tenant','${a}',false)`); expect((await db.query('SELECT id FROM whatsapp_instancias')).rows).toHaveLength(1); await expect(db.query('SELECT token_cifrado FROM whatsapp_instancias')).rejects.toThrow(/permission denied/); await expect(db.query('SELECT token_cifrado FROM empresa_whatsapp_conexoes')).rejects.toThrow(/permission denied/); await expect(db.query('SELECT app_secret_cifrado FROM whatsapp_apps_meta')).rejects.toThrow(/permission denied/); await db.exec('RESET ROLE'); });
    it("impede vínculo de mensagem com instância de outro tenant", async () => { await expect(db.exec(`INSERT INTO whatsapp_mensagens(empresa_id,instancia_id,direcao,contato_numero) VALUES('${b}','${i}','recebida','123')`)).rejects.toThrow(/foreign key/); });
    it("permite N instâncias por empresa e nega Phone Number ID duplicado", async () => { await db.exec(`INSERT INTO whatsapp_instancias(empresa_id,modelo_id,nome,numero_celular) SELECT '${a}',id,'Outra instância','+5566999999876' FROM whatsapp_instancia_modelos WHERE codigo='meta_teste'`); expect((await db.query(`SELECT id FROM whatsapp_instancias WHERE empresa_id='${a}'`)).rows).toHaveLength(2); await expect(db.exec(`INSERT INTO whatsapp_instancias(empresa_id,modelo_id,nome,phone_number_id) SELECT '${b}',id,'Duplicada','234567' FROM whatsapp_instancia_modelos LIMIT 1`)).rejects.toThrow(/unique/); });
    it("reserva uma vez e respeita limite mensal da instância", async () => { await db.exec(`UPDATE whatsapp_instancia_modelos SET limite_mensagens_mes=1 WHERE codigo='atendimento_campanhas'`); const args = `'55555555-5555-4555-8555-555555555555','${a}','${i}','${u}','5566999991234','text','Teste',null`; const q = `SELECT whatsapp_reservar_envio(${args}) as ok`; expect((await db.query<{
        ok: boolean;
    }>(q)).rows[0].ok).toBe(true); expect((await db.query<{
        ok: boolean;
    }>(q)).rows[0].ok).toBe(false); await expect(db.query(q.replace('55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666'))).rejects.toThrow(/Limite/); });
    it("impede envio com instância suspensa", async () => { await db.exec(`UPDATE whatsapp_instancias SET status='suspenso' WHERE id='${i}'`); await expect(db.query(`SELECT whatsapp_reservar_envio('77777777-7777-4777-8777-777777777777','${a}','${i}','${u}','5566999991234','text','Teste',null)`)).rejects.toThrow(/indisponível/); await db.exec(`UPDATE whatsapp_instancias SET status='conectado' WHERE id='${i}'`); });
    it("status fora de ordem nunca regride leitura para enviado", async () => { await db.exec(`UPDATE whatsapp_mensagens SET wa_message_id='wamid-teste',status='accepted' WHERE id='55555555-5555-4555-8555-555555555555';SELECT whatsapp_atualizar_status('${a}','${i}','wamid-teste','read',null);SELECT whatsapp_atualizar_status('${a}','${i}','wamid-teste','sent',null);`); expect((await db.query<{
        status: string;
    }>("SELECT status FROM whatsapp_mensagens WHERE wa_message_id='wamid-teste'")).rows[0].status).toBe('read'); });
    it("módulo exige Platform e preserva configurações/módulos anteriores", async () => { await db.exec(`SELECT set_config('test.uid','${u}',false)`); await expect(db.exec(`SELECT rpc_platform_whatsapp_modulo('${a}',true)`)).rejects.toThrow(/Platform/); await db.exec(`SELECT set_config('test.platform','true',false);SELECT rpc_platform_whatsapp_modulo('${a}',true);SELECT rpc_platform_whatsapp_modulo('${a}',true);`); const r = await db.query<{
        configuracoes: {
            outro: string;
            erp_sistema: {
                modulos: string[];
            };
        };
    }>(`SELECT configuracoes FROM empresas WHERE id='${a}'`); expect(r.rows[0].configuracoes.outro).toBe('preservar'); expect(r.rows[0].configuracoes.erp_sistema.modulos).toEqual(['leads', 'vendas', 'whatsapp']); });
});
