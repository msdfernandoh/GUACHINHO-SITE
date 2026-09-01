import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const migration = readFileSync(resolve(root, "supabase/migrations/189_master_para_parceiro_modelos_site.sql"), "utf8");
const actions = readFileSync(resolve(process.cwd(), "src/app/platform/empresas/actions.ts"), "utf8");
const hub = readFileSync(resolve(process.cwd(), "src/components/platform/master-franquia-hub.tsx"), "utf8");
const partnerPage = readFileSync(resolve(process.cwd(), "src/app/(parceiro-site)/parceiro/[slug]/page.tsx"), "utf8");

describe("Fase 193 — Master para parceiro e modelos publicados", () => {
  it("bloqueia conversão automática quando a origem possui fatos operacionais", () => {
    expect(migration).toContain("Conversao automatica bloqueada");
    for (const table of ["public.leads", "public.propostas", "public.contratacoes_online", "public.vendas", "public.caixa_movimentos"]) {
      expect(migration).toContain(table);
    }
  });

  it("preserva a Master suspensa e registra a conversão na auditoria", () => {
    expect(migration).toContain("status='suspenso', ativo=false");
    expect(migration).toContain("CONVERTER_MASTER_EM_PARCEIRA");
    expect(migration).toContain("conversao_parceiro");
  });

  it("permite criar organização no mesmo fluxo e exige modelo publicado na personalização", () => {
    expect(actions).toContain("rpc_platform_criar_organizacao_site_parceiro");
    expect(hub).toContain("Cadastrar nova");
    expect(hub).toContain("Modelo publicado");
    expect(migration).toContain("status = 'PUBLICADO'");
  });

  it("renderiza a família Racon sem retirar o renderer institucional", () => {
    expect(partnerPage).toContain('template_codigo === "racon_inspired"');
    expect(partnerPage).toContain("RaconInspiredHome");
    expect(partnerPage).toContain('template_codigo === "institucional_v1"');
  });
});
