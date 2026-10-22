import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { it, expect } from "vitest";
it("preserva snapshots e restringe leitura à concessão e empresa", async () => {
 const db = new PGlite();
 try {
 await db.exec(`
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE public.grupos_consorcio(id uuid PRIMARY KEY, administradora_id uuid, origem_governanca text, empresa_origem_id uuid);
 CREATE TABLE public.empresa_administradoras(empresa_id uuid, administradora_id uuid, status text);
 CREATE TABLE public.robo_execucoes(id uuid PRIMARY KEY);
 CREATE FUNCTION public.can_read_tenant_internal(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1::text = current_setting('app.empresa', true) $$;
 ALTER TABLE public.empresa_administradoras ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON public.grupos_consorcio, public.empresa_administradoras TO authenticated;
 INSERT INTO public.grupos_consorcio VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','GLOBAL',null);
 INSERT INTO public.empresa_administradoras VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','ATIVA');
 INSERT INTO public.robo_execucoes VALUES ('00000000-0000-0000-0000-000000000004');
 `);
 await db.exec(readFileSync(resolve(process.cwd(),"../supabase/migrations/329_assembleias_resultados_verificados.sql"),"utf8"));
 await db.exec(readFileSync(resolve(process.cwd(),"../supabase/migrations/330_assembleias_leitura_concessao.sql"),"utf8"));
 await db.exec(`SET ROLE service_role; INSERT INTO public.grupo_assembleias_resultados(grupo_id,assembleia_numero,assembleia_data,execucao_id,cotas) VALUES ('00000000-0000-0000-0000-000000000001',1,'2026-10-15','00000000-0000-0000-0000-000000000004','[]'); RESET ROLE;`);
 await db.exec(`SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false); SET ROLE authenticated; SELECT set_config('app.empresa','00000000-0000-0000-0000-000000000003',false);`);
 expect((await db.query("SELECT * FROM public.grupo_assembleias_resultados")).rows).toHaveLength(1);
 await db.exec("SELECT set_config('app.empresa','outro',false)");
 expect((await db.query("SELECT * FROM public.grupo_assembleias_resultados")).rows).toHaveLength(0);
 await expect(db.exec("INSERT INTO public.grupo_assembleias_resultados DEFAULT VALUES")).rejects.toThrow();
 await db.exec("RESET ROLE; SET ROLE anon");
 await expect(db.query("SELECT * FROM public.grupo_assembleias_resultados")).rejects.toThrow();
 await db.exec("RESET ROLE");
 await expect(db.exec("DELETE FROM public.grupo_assembleias_resultados")).rejects.toThrow(/imutáveis/);
 } finally {await db.close();}
}, 30000);
