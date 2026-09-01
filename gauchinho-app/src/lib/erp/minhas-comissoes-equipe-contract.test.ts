import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "src/app/erp/minhas-comissoes/page.tsx"), "utf8");
const actions = readFileSync(resolve(process.cwd(), "src/app/erp/minhas-comissoes/actions.ts"), "utf8");
const client = readFileSync(resolve(process.cwd(), "src/components/erp/comissoes/minhas-comissoes-client.tsx"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/174_pagamento_comissao_equipe_permissao_financeira.sql"), "utf8");

describe("Minhas comissões — visão e pagamento da equipe", () => {
  it("libera a seleção para super_admin e para admin/gestor com permissão de comissões", () => {
    expect(page).toContain('papelCodigo === "super_admin"');
    expect(page).toContain('["admin_empresa", "gestor"].includes(papelCodigo)');
    expect(page).toContain('permissoes.has("gerenciar_comissoes")');
    expect(page).toContain('.eq("empresa_id", empresaAtiva.id)');
    expect(page).toContain('.ilike("status", "ativo")');
    expect(page).toContain("participanteSelecionado ?? participanteProprio");
    expect(client).toContain("Consultor da equipe");
    expect(client).toContain("Minhas comissões");
  });

  it("valida tenant, participante e permissão financeira antes de pagar", () => {
    expect(actions).toContain('access.vinculo.papel?.codigo === "super_admin"');
    expect(actions).toContain('access.permissoes.has("gerenciar_financeiro")');
    expect(actions).toContain('.eq("empresa_id", access.empresaAtiva.id)');
    expect(actions).toContain('.eq("participante_comercial_id", participanteId)');
    expect(actions).toContain("registrarPagamentoParticipante");
    expect(client).toContain("Pagamento agrupado");
    expect(client).toContain("Pagar selecionadas");
    expect(migration).toContain("has_company_permission(p_empresa_id, 'gerenciar_financeiro')");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("Pagamento excede valor elegível");
  });
});
