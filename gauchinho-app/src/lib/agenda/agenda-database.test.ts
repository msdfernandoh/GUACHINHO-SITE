import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// PostgreSQL real em WASM, fixture mínima: não acessa banco nem contas de produção.
const db = new PGlite();
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = uid(1), B = uid(2), manager = uid(11), member = uid(12), outsider = uid(13), event = uid(40);
const sqlFile = (name: string) => readFileSync(resolve(process.cwd(), "../supabase/migrations", name), "utf8");
async function login(user: string, role = "authenticated") {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${user}', true); SELECT set_config('request.jwt.claim.role', '${role}', true); SET LOCAL ROLE ${role};`);
}
async function insertEvent(scope = "EQUIPE", owner = manager, company = A, id = event) {
  return db.exec(`INSERT INTO agenda_compromissos(id,empresa_id,consultor_id,titulo,tipo,data_inicio,data_fim,escopo)
    VALUES('${id}','${company}','${owner}','Inauguração','Outro','2026-09-16 19:00Z','2026-09-16 20:30Z','${scope}');`);
}
async function count(table: string) { return Number((await db.query<{ n: number }>(`SELECT count(*) n FROM ${table}`)).rows[0].n); }
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
    CREATE TABLE empresas(id uuid PRIMARY KEY, ativo boolean DEFAULT true);
    CREATE TABLE usuarios(id uuid PRIMARY KEY, auth_user_id uuid, ativo boolean DEFAULT true, google_calendar_email text, google_calendar_connected_at timestamptz);
    CREATE TABLE papeis(id uuid PRIMARY KEY, codigo text, escopo text DEFAULT 'COMPANY', empresa_id uuid, ativo boolean DEFAULT true);
    CREATE TABLE permissoes(id uuid PRIMARY KEY, codigo text);
    CREATE TABLE papel_permissoes(papel_id uuid, permissao_id uuid);
    CREATE TABLE empresa_usuarios(id uuid DEFAULT gen_random_uuid(),empresa_id uuid,usuario_id uuid,papel_id uuid,ativo boolean DEFAULT true,agenda_acesso_todos boolean DEFAULT false,google_agenda_sync boolean DEFAULT true,PRIMARY KEY(empresa_id,usuario_id));
    CREATE TABLE leads(id uuid PRIMARY KEY,empresa_id uuid);
    CREATE TABLE agenda_compromissos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid NOT NULL,consultor_id uuid,
      lead_id uuid,titulo text NOT NULL,tipo text NOT NULL,descricao text,local text,data_inicio timestamptz NOT NULL,data_fim timestamptz,
      duracao_minutos integer,status text DEFAULT 'agendado',resultado text,google_calendar_event_id text,criado_por_usuario_id uuid,
      concluido_por_usuario_id uuid,concluido_at timestamptz);
    CREATE TABLE audit_logs_central(id uuid DEFAULT gen_random_uuid(),empresa_id uuid,usuario_id uuid,modulo text,acao text,entidade_tipo text,entidade_id uuid,detalhes jsonb,correlation_id text);
    CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
    GRANT SELECT,INSERT,UPDATE ON agenda_compromissos TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    ALTER TABLE agenda_compromissos ENABLE ROW LEVEL SECURITY;
    INSERT INTO empresas(id) VALUES('${A}'),('${B}');
    INSERT INTO usuarios(id,auth_user_id,google_calendar_email,google_calendar_connected_at) VALUES
      ('${manager}','${manager}','manager@gmail.com',now()),('${member}','${member}','member@gmail.com',now()),('${outsider}','${outsider}','other@gmail.com',now());
    INSERT INTO papeis(id,codigo) VALUES('${uid(21)}','gestor'),('${uid(22)}','consultor');
    INSERT INTO permissoes VALUES('${uid(30)}','acessar_agenda');
    INSERT INTO papel_permissoes VALUES('${uid(21)}','${uid(30)}'),('${uid(22)}','${uid(30)}');
    INSERT INTO empresa_usuarios(empresa_id,usuario_id,papel_id) VALUES('${A}','${manager}','${uid(21)}'),('${A}','${member}','${uid(22)}'),('${B}','${outsider}','${uid(21)}');
  `);
  await db.exec(sqlFile("057_hardening_identidade_autorizacao_helpers.sql"));
  const previous = sqlFile("162_agenda_comercial_tenant_ux_permissoes.sql");
  await db.exec(previous.slice(previous.indexOf("CREATE OR REPLACE FUNCTION public.agenda_pode_ver_todos"), previous.indexOf("DROP POLICY IF EXISTS agenda_disp_select")));
  await db.exec(previous.slice(previous.indexOf("CREATE OR REPLACE FUNCTION public.validar_agenda_compromisso_tenant"), previous.indexOf("CREATE OR REPLACE FUNCTION public.rpc_concluir_compromisso_agenda")));
  await db.exec(sqlFile("172_agenda_equipe_dia_inteiro_google_bidirecional.sql"));
}, 60000);
beforeEach(async () => { await db.exec("BEGIN"); await login(manager); });
afterEach(async () => { await db.exec("ROLLBACK; RESET ROLE"); });
afterAll(async () => db.close());

describe("Agenda: migration 170, RLS e transações", () => {
  it("cria um compromisso coletivo e os participantes atomicamente", async () => {
    await insertEvent(); expect(await count("agenda_compromissos")).toBe(1);
    expect(await count("agenda_compromisso_participantes")).toBe(2);
    const row = (await db.query<{ duracao_minutos: number }>("SELECT duracao_minutos FROM agenda_compromissos")).rows[0];
    expect(row.duracao_minutos).toBe(90);
  });
  it("participante enxerga evento coletivo, mas não pode alterá-lo", async () => {
    await insertEvent(); await login(member);
    expect(await count("agenda_compromissos")).toBe(1);
    expect(await count("agenda_compromisso_participantes")).toBe(2);
    const result = await db.query(`UPDATE agenda_compromissos SET titulo='Inválido' WHERE id='${event}' RETURNING id`);
    expect(result.rows).toHaveLength(0);
  });
  it("outro tenant não enxerga compromissos nem participantes", async () => {
    await insertEvent(); await login(outsider);
    expect(await count("agenda_compromissos")).toBe(0); expect(await count("agenda_compromisso_participantes")).toBe(0);
  });
  it("vínculo revogado perde acesso ao coletivo", async () => {
    await insertEvent(); await db.exec(`RESET ROLE; UPDATE empresa_usuarios SET ativo=false WHERE usuario_id='${member}'`);
    await login(member); expect(await count("agenda_compromissos")).toBe(0);
  });
  it("consultor não cria evento para todos", async () => {
    await login(member); await expect(insertEvent("EQUIPE", member)).rejects.toThrow("Sem permissão");
  });
  it("impede autoinscrição para obter acesso a evento privado", async () => {
    await insertEvent("INDIVIDUAL"); await login(member);
    await expect(db.exec(`INSERT INTO agenda_compromisso_participantes(empresa_id,compromisso_id,usuario_id) VALUES('${A}','${event}','${member}')`)).rejects.toThrow(/permission denied/);
  });
  it("bloqueia conflito de membro da equipe", async () => {
    await insertEvent(); await login(member);
    await expect(insertEvent("INDIVIDUAL", member, A, uid(41))).rejects.toThrow("Conflito");
  });
  it("não permite mudar tenant do compromisso", async () => {
    await insertEvent(); await expect(db.exec(`UPDATE agenda_compromissos SET empresa_id='${B}' WHERE id='${event}'`)).rejects.toThrow();
  });
  it("dia todo deve usar meia-noite em Cuiabá", async () => {
    await insertEvent(); await expect(db.exec(`UPDATE agenda_compromissos SET dia_inteiro=true WHERE id='${event}'`)).rejects.toThrow("meia-noite");
  });
  it("marca evento sem lead como realizado com auditoria", async () => {
    await insertEvent("INDIVIDUAL"); await db.query("SELECT rpc_agenda_marcar_realizado($1,$2)",[A,event]);
    expect((await db.query<{ status: string; resultado: string }>("SELECT status,resultado FROM agenda_compromissos")).rows[0])
      .toMatchObject({ status: "concluido", resultado: "Realizado" });
    await db.exec("RESET ROLE");
    expect((await db.query<{ acao: string }>("SELECT acao FROM audit_logs_central WHERE entidade_id=$1",[event])).rows[0].acao).toBe("MARCAR_REALIZADO");
  });
  it("aceita dia todo com término exclusivo", async () => {
    await insertEvent(); await db.exec(`UPDATE agenda_compromissos SET dia_inteiro=true,data_inicio='2026-09-16 04:00Z',data_fim='2026-09-17 04:00Z' WHERE id='${event}'`);
    expect((await db.query<{ duracao_minutos: number }>("SELECT duracao_minutos FROM agenda_compromissos")).rows[0].duracao_minutos).toBe(1440);
  });
  it("usuário não chama importador privilegiado", async () => {
    await expect(db.query("SELECT rpc_agenda_importar_google($1,$2,$3,$4)",[A,manager,"manager@gmail.com","[]"])).rejects.toThrow(/permission denied/);
  });
  it("anônimo não recebe acesso às funções", async () => {
    await login("", "anon"); await expect(db.query("SELECT agenda_usuario_participa($1)",[event])).rejects.toThrow(/permission denied/);
  });
  it("Google exige consentimento mesmo para service_role", async () => {
    await login("", "service_role");
    await expect(db.query("SELECT rpc_agenda_importar_google($1,$2,$3,$4)",[A,manager,"manager@gmail.com","[]"])).rejects.toThrow("não autorizada");
  });
  it("importação repetida não duplica e versão antiga não sobrescreve", async () => {
    await db.query("SELECT rpc_agenda_google_consentimento($1,true)",[A]);
    await login("", "service_role");
    const payload = [{ id: "g1", updated: "2026-09-01T12:00:00Z", titulo: "Google", inicio: "2026-09-16T19:00:00Z", fim: "2026-09-16T20:30:00Z", diaInteiro: false }];
    const run = () => db.query<{ result: { imported: number; updated: number; cancelled: number } }>("SELECT rpc_agenda_importar_google($1,$2,$3,$4) result",[A,manager,"manager@gmail.com",JSON.stringify(payload)]);
    expect((await run()).rows[0].result.imported).toBe(1);
    expect((await run()).rows[0].result.imported).toBe(0);
    expect(await count("agenda_compromissos")).toBe(1); expect(await count("agenda_compromisso_participantes")).toBe(1);
    payload[0].updated="2026-08-01T12:00:00Z"; payload[0].titulo="Antigo"; await run();
    expect((await db.query<{ titulo: string }>("SELECT titulo FROM agenda_compromissos")).rows[0].titulo).toBe("Google");
  });
  it("rejeita importação de conta diferente", async () => {
    await db.query("SELECT rpc_agenda_google_consentimento($1,true)",[A]); await login("", "service_role");
    await expect(db.query("SELECT rpc_agenda_importar_google($1,$2,$3,$4)",[A,manager,"other@gmail.com","[]"])).rejects.toThrow("não autorizada");
  });
});
