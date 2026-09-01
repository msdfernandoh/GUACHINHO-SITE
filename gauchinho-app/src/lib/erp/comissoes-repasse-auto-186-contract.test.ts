import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/186_baixa_automatica_itens_repasse_vinculados.sql"), "utf8");
const page = fs.readFileSync(path.join(root, "gauchinho-app/src/app/admin/comissoes/page.tsx"), "utf8");
const actions = fs.readFileSync(path.join(root, "gauchinho-app/src/app/erp/repasse-franquia/actions.ts"), "utf8");

describe("Fase 191 — conferência prática e baixa automática do repasse", () => {
  it("baixa linhas vinculadas de forma idempotente e confirma o relatório resolvido", () => {
    expect(migration).toContain("repasse_baixar_itens_vinculados");
    expect(migration).toContain("repasse-auto:item:");
    expect(migration).toContain("VINCULADO_AUTO");
    expect(migration).toContain("SET status = 'CONFIRMADO'");
  });

  it("libera somente o participante da mesma cota recebida", () => {
    expect(migration).toContain("p.cota_definitiva_id IS NOT DISTINCT FROM v_prev.cota_definitiva_id");
  });

  it("mantém o recebimento-base append-only e deriva a conciliação pelos lançamentos", () => {
    expect(migration).not.toContain("UPDATE public.financeiro_recebimentos SET");
    expect(migration).toContain("financeiro_recebimento_itens");
    expect(migration).toContain("financeiro_recebimento_classificacoes");
  });

  it("remove os seletores em massa e prioriza pendências que não vieram no relatório", () => {
    expect(page).not.toContain("CommissionBulkSelector");
    expect(page).toContain("Não veio no relatório");
    expect(page).toContain("Baixa automática");
    expect(page).toContain("Ajustar manualmente");
  });

  it("atualiza as telas de comissão assim que o PDF é importado ou vinculado", () => {
    expect(actions).toContain('revalidatePath("/erp/comissoes")');
    expect(actions).toContain("linhas vinculadas e baixadas automaticamente");
  });
});
