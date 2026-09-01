import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repo = path.resolve(process.cwd(), "..");
const migration = fs.readFileSync(path.join(repo, "supabase/migrations/182_repasse_vinculo_aberto_cadastro_minimo.sql"), "utf8");
const view = fs.readFileSync(path.join(process.cwd(), "src/components/erp/repasse-pdf-conciliacao.tsx"), "utf8");
const page = fs.readFileSync(path.join(process.cwd(), "src/components/erp/erp-operational-pages.tsx"), "utf8");

describe("Fase 185 — repasse com cadastro mínimo", () => {
  it("lista qualquer competência da mesma administradora", () => {
    expect(view).toContain("p.administradora_id === atual.administradora_id");
    expect(view).toContain("qualquer competência");
    expect(view).not.toContain("previsoes.filter((p) => p.competencia === atual.competencia)");
  });

  it("usa o valor exato do relatório sem exigir regra", () => {
    expect(migration).toContain("CASE WHEN p_sem_regra THEN v_item.valor_comissao");
    expect(migration).toContain("regra_participante_id");
    expect(view).toContain("sem regra de comissão");
  });

  it("cria cadastro pendente e grupo local inativo", () => {
    expect(migration).toContain("PENDENTE_CPF_CNPJ");
    expect(migration).toContain("PENDENTE_TELEFONE");
    expect(migration).toContain("p_empresa_id,'LOCAL','LOCAL'");
    expect(migration).toContain("'Inativo',false");
  });

  it("remove o motor duplicado da página de repasse", () => {
    expect(page).not.toContain('import Comissoes from "@/app/admin/comissoes/page"');
    expect(page).not.toContain("<Comissoes />");
  });
});
