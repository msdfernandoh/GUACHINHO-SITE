import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(process.cwd(), "../supabase/migrations/134_socios_empresa_fechamento_imutavel.sql"),
  "utf8",
);

describe("Fase 136 — quadro societário e fechamento imutável", () => {
  it("mantém o quadro por empresa, usuário, percentual e vigência", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.empresa_socios");
    expect(migration).toContain("percentual_participacao");
    expect(migration).toContain("vigencia_inicio");
    expect(migration).toContain("vigencia_fim");
  });

  it("exige exatamente 100 por cento e vínculo ativo no tenant", () => {
    expect(migration).toContain("v_total <> 100");
    expect(migration).toContain("FROM public.empresa_usuarios eu");
    expect(migration).toContain("eu.empresa_id = p_empresa_id");
  });

  it("congela itens, percentuais, contas e instruções de transferência", () => {
    expect(migration).toContain("public.financeiro_fechamento_socios_itens");
    expect(migration).toContain("percentual_snapshot");
    expect(migration).toContain("conta_recebimento_snapshot");
    expect(migration).toContain("public.financeiro_fechamento_socios_instrucoes");
    expect(migration).toContain("bloquear_mutacao_fechamento_socios");
  });

  it("não permite execução anônima ou por service role", () => {
    expect(migration).toContain("FROM PUBLIC, anon, service_role");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.rpc_fechar_socios");
    expect(migration).toContain("TO authenticated");
  });
});
