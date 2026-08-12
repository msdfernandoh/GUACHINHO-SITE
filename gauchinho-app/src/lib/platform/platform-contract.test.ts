import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decidePlatformHostAccess } from "@/lib/tenant/platform-host";

const migration=readFileSync(resolve(process.cwd(),"../supabase/migrations/070_plataforma_saas_master_governanca.sql"),"utf8");
describe("Plataforma SaaS Master",()=>{
 it("aceita somente rotas Platform para superadmin",()=>{expect(decidePlatformHostAccess({pathname:"/platform",authenticated:true,platformSuperadmin:true})).toBe("allow_master");expect(decidePlatformHostAccess({pathname:"/admin/leads",authenticated:true,platformSuperadmin:true})).toBe("unavailable");expect(decidePlatformHostAccess({pathname:"/platform",authenticated:true,platformSuperadmin:false})).toBe("deny");});
 it("mantém PLATFORM fora de empresa_dominios",()=>{expect(migration).not.toContain("admin.gauchinhoconsorcios.com.br");expect(migration).not.toMatch(/INSERT INTO public\.empresas/i);});
 it("protege governança por is_platform_superadmin",()=>{expect(migration).toContain("public.is_platform_superadmin()");expect(migration).toContain("FROM PUBLIC, anon, authenticated");});
 it("não presume preços nem cria template Racon",()=>{expect(migration).not.toMatch(/racon_unidade/i);expect(migration).not.toMatch(/valor_mensal[^;]*VALUES\s*\([^)]*\d/i);});
 it("separa produto comercial de cota definitiva",()=>{expect(migration).not.toMatch(/ALTER TABLE public\.cotas_definitivas/i);expect(migration).not.toMatch(/ALTER TABLE public\.grupos_cotas/i);});
});
