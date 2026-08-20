import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql079 = readFileSync(resolve(process.cwd(), "../supabase/migrations/079_financeiro_contas_pagar_governanca.sql"), "utf8");
const sql101 = readFileSync(resolve(process.cwd(), "../supabase/migrations/101_contas_pagar_governanca_permissoes_estorno.sql"), "utf8");

describe("governança de contas a pagar 079", () => {
  it("restringe operações e logs ao master do tenant", () => {
    expect(sql079).toContain("lower(u.perfil)='master'");
    expect(sql079).toContain("p.codigo='admin_empresa'");
    expect(sql079).toContain("eu.empresa_id=p_empresa_id");
  });
  it("exige motivo e preserva caixa com evento inverso", () => {
    expect(sql079).toContain("O motivo da exclusão é obrigatório");
    expect(sql079).toContain("'entrada','estorno_conta_pagar'");
    expect(sql079).not.toMatch(/delete\s+from\s+public\.caixa_movimentos/i);
  });
  it("mantém exclusão lógica e log detalhado", () => {
    expect(sql079).toContain("status='cancelada'");
    expect(sql079).toContain("financeiro_contas_pagar_logs");
    expect(sql079).toContain("fornecedor text");
    expect(sql079).toContain("valor numeric(15,2)");
  });
});

describe("governança de contas a pagar 101 — permissões de estorno e exclusão", () => {
  it("adiciona coluna pode_estornar_contas em empresa_usuarios", () => {
    expect(sql101).toContain("pode_estornar_contas boolean not null default false");
  });
  it("valida permissão de estorno para master e consultores autorizados", () => {
    expect(sql101).toContain("create or replace function public.pode_estornar_conta_pagar");
    expect(sql101).toContain("eu.pode_estornar_contas = true");
  });
  it("bloqueia exclusão de contas pagas para não-masters", () => {
    expect(sql101).toContain("Apenas o usuário Master pode excluir uma despesa que já foi paga");
  });
  it("permite visualização de logs de auditoria por todos os operadores ativos", () => {
    expect(sql101).toContain("financeiro_cp_logs_select");
    expect(sql101).toContain("public.empresa_usuarios eu");
  });
});

