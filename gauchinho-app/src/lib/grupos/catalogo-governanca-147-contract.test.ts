import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("contrato de governança do catálogo global", () => {
  it("mantém UUID do tipo como fonte canônica e reajuste global auditado", () => {
    const sql = read("supabase/migrations/147_grupos_tipo_canonico_e_admin_site_readonly.sql");
    expect(sql).toContain("sync_grupo_modalidade_tipo_canonico");
    expect(sql).toContain("tipo_administradora_id");
    expect(sql).toContain("grupos_creditos_reajustes");
    expect(sql).toContain("rpc_platform_reajustar_creditos_grupo");
    expect(sql).toContain("public.is_platform_superadmin()");
  });

  it("admin do site expõe empresas, administradoras e grupos somente para consulta", () => {
    const empresa = read("gauchinho-app/src/app/admin/empresas/[id]/page.tsx");
    const administradora = read("gauchinho-app/src/app/admin/administradoras/[id]/page.tsx");
    const grupo = read("gauchinho-app/src/app/admin/grupos/[id]/page.tsx");
    expect(empresa).toContain("Consulta do cadastro SaaS");
    expect(administradora).toContain("Consulta da concessão ativa");
    expect(grupo).not.toMatch(/Salvar cota|Excluir|Inativar/);
    expect(empresa).not.toMatch(/<form|Salvar|Remover/);
    expect(administradora).not.toMatch(/<form|Salvar|Inativar/);
  });

  it("publicação aceita múltiplas categorias sem substituir o tipo oficial", () => {
    const service = read("gauchinho-app/src/lib/grupos/catalogo-autorizado-service.ts");
    const workspace = read("gauchinho-app/src/components/platform/grupo-operational-workspace.tsx");
    expect(service).toContain("categorias_publicacao");
    expect(service).not.toContain("modalidade: categoriaPrincipalByGrupo");
    expect(workspace).toContain("Um único grupo pode aparecer em Automóvel e Moto");
    expect(workspace).toContain('name="categoria_codigo"');
  });
});
