import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "../supabase/migrations/079_financeiro_contas_pagar_governanca.sql"), "utf8");

describe("governança de contas a pagar 079", () => {
  it("restringe operações e logs ao master do tenant", () => {
    expect(sql).toContain("lower(u.perfil)='master'");
    expect(sql).toContain("p.codigo='admin_empresa'");
    expect(sql).toContain("eu.empresa_id=p_empresa_id");
    expect(sql).toContain("using(public.is_financeiro_tenant_master(empresa_id))");
  });
  it("exige motivo e preserva caixa com evento inverso", () => {
    expect(sql).toContain("O motivo da exclusão é obrigatório");
    expect(sql).toContain("'entrada','estorno_conta_pagar'");
    expect(sql).not.toMatch(/delete\s+from\s+public\.caixa_movimentos/i);
  });
  it("mantém exclusão lógica e log detalhado", () => {
    expect(sql).toContain("status='cancelada'");
    expect(sql).toContain("financeiro_contas_pagar_logs");
    expect(sql).toContain("fornecedor text");
    expect(sql).toContain("valor numeric(15,2)");
  });
});
