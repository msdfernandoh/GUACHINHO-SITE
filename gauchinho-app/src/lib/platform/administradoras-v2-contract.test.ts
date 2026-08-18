import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/083_platform_administradoras_hub_catalogo.sql"),
  "utf8",
);
const workspace = readFileSync(
  resolve(process.cwd(), "src/components/platform/administrator-workspace.tsx"),
  "utf8",
);
const actions = readFileSync(
  resolve(process.cwd(), "src/app/platform/administradoras-actions.ts"),
  "utf8",
);
const e2e = readFileSync(
  resolve(process.cwd(), "../supabase/tests/platform_administradoras_v2_083_e2e.sql"),
  "utf8",
);

describe("Platform Administradoras V2", () => {
  it("preserva o motor canônico e acrescenta governança Master por referência", () => {
    expect(migration).toContain("CREATE TABLE public.administradora_modelos_comissao");
    expect(migration).toContain("regra_franquia_origem_id uuid REFERENCES public.comissao_regras_franquia");
    expect(migration).toContain("CREATE TABLE public.administradora_modelo_modalidades");
    expect(migration).not.toMatch(/CREATE TABLE public\.(motor|calculo)_comissao/i);
  });

  it("modela Modalidade→Tipos e Curva→Tipos/Modalidades como N:N", () => {
    expect(migration).toContain("CREATE TABLE public.administradora_modalidade_tipos");
    expect(migration).toContain("CREATE TABLE public.administradora_curva_tipos");
    expect(migration).toContain("CREATE TABLE public.administradora_curva_modalidades");
    expect(migration).toContain("p_todos_tipos boolean");
    expect(migration).toContain("p_todas_modalidades boolean");
  });

  it("mantém curvas estruturadas, múltiplas, versionadas e com exclusão segura", () => {
    expect(migration).toContain("jsonb_array_elements(p_faixas)");
    expect(migration).toContain("Mês duplicado na curva");
    expect(migration).toContain("coalesce(max(versao),0)+1");
    expect(migration).toContain("Curva possui dependências; inative ou versione");
    expect(workspace).toContain("Faixas estruturadas");
    expect(workspace).not.toMatch(/1:80,2:70/);
  });

  it("permite curva opcional por regra canônica", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS curva_estorno_id");
    expect(migration).toContain("rpc_platform_configurar_curva_regra");
    expect(actions).toContain("p_curva_id: String(formData.get(\"curva_id\") ?? \"\") || null");
    expect(workspace).toContain("Nenhuma curva");
  });

  it("protege deleções contra fatos e snapshots históricos", () => {
    expect(migration).toContain("snapshot_venda->>'tipo_administradora_id'=p_id::text");
    expect(migration).toContain("snapshot_venda->>'modalidade_comissao_id'=p_id::text");
    expect(migration).toContain("comissao_previsoes_franquia");
    expect(migration).toContain("Programa possui dependências; inative ou crie Nova versão");
  });

  it("expõe ciclo Platform-native de Programas sem redirecionar ao ERP", () => {
    expect(migration).toContain("rpc_platform_status_programa");
    expect(migration).toContain("rpc_platform_nova_versao_programa");
    expect(workspace).toMatch(/\/platform\/administradoras\/\$\{administradora\.id\}\/programas\/\$\{[^}]+\}/);
    expect(workspace).not.toContain("/erp/regras-comissao");
  });

  it("aplica RBAC/RLS explícito para as novas tabelas", () => {
    expect(migration.match(/public\.is_platform_superadmin\(\)/g)?.length).toBeGreaterThan(20);
    expect(migration).toContain("FOR INSERT TO authenticated WITH CHECK");
    expect(migration).toContain("FOR UPDATE TO authenticated USING");
    expect(migration).toContain("FOR DELETE TO authenticated USING");
    expect(migration).not.toMatch(/CREATE POLICY[^;]+FOR ALL[^;]+administradora_(modalidade_tipos|curva_tipos|curva_modalidades|modelos_comissao|modelo_modalidades)/is);
  });

  it("separa prontidão do catálogo e pendências dos Grupos", () => {
    expect(workspace).toContain('"COMPLETA"');
    expect(workspace).toContain('"COM PENDÊNCIAS"');
    expect(workspace).toContain("gruposPendentes === 0");
  });

  it("mantém E2E isolado com persistência, Racon e deleções seguras", () => {
    expect(e2e).toContain("Administradora E2E 083");
    expect(e2e).toContain("jsonb_build_array");
    expect(e2e).toContain("Curva opcional por Regra");
    expect(e2e).toContain("Tipo usado excluído");
    expect(e2e).toContain("Racon não possui as três Modalidades canônicas esperadas");
  });
});
