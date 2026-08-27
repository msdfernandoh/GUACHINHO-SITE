import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("fase 152 — tabela canônica e múltiplos lances", () => {
  const migration = read("supabase/migrations/152_grupos_tabela_canonica_e_multiplos_lances.sql");
  const storage = read("gauchinho-app/src/lib/grupos/grupo-tabela.server.ts");
  const platform = read("gauchinho-app/src/app/platform/grupos-actions.ts");
  const siteDetail = read("gauchinho-app/src/app/admin/grupos/[id]/page.tsx");
  const erpDetail = read("gauchinho-app/src/app/erp/grupos/[id]/page.tsx");

  it("mantém um documento privado atual por UUID e registra auditoria", () => {
    expect(migration).toContain("grupo_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("'grupos-tabelas'");
    expect(migration).toContain("public = false");
    expect(migration).toContain("grupos_tabelas_historico");
    expect(storage).toContain("createSignedUrl");
    expect(storage).toContain('requireTenantPermission("gerenciar_grupos")');
    expect(storage).toContain("getGrupoAutorizadoForEmpresa");
  });

  it("substitui atomicamente os vários lances e preserva campos de cálculo do site", () => {
    expect(migration).toContain("rpc_platform_salvar_lances_embutidos_grupo");
    expect(migration).toContain("DELETE FROM public.grupos_modalidades_lance");
    expect(migration).toContain("tipo_parcela, percentual_parcela_reduzida");
    expect(platform).toContain('rpc("rpc_platform_salvar_lances_embutidos_grupo"');
  });

  it("expõe detalhes, observações, lances e a mesma tabela no Site e ERP", () => {
    for (const page of [siteDetail, erpDetail]) {
      expect(page).toContain("GrupoTabelaActions");
      expect(page).toContain("Observações operacionais");
      expect(page).toContain("percentual_lance_embutido");
    }
    expect(siteDetail).toContain("Assembleias / prazo");
    expect(erpDetail).toContain("Participantes / capacidade");
  });
});
