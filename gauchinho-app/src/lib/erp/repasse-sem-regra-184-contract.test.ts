import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repo = path.resolve(process.cwd(), "..");
const view = fs.readFileSync(path.join(process.cwd(), "src/components/erp/repasse-pdf-conciliacao.tsx"), "utf8");
const actions = fs.readFileSync(path.join(process.cwd(), "src/app/erp/repasse-franquia/actions.ts"), "utf8");
const migration = fs.readFileSync(path.join(repo, "supabase/migrations/184_repasse_manual_sempre_sem_regra.sql"), "utf8");

describe("Fase 187 — lançamento manual do repasse sem regra", () => {
  it("não apresenta nem exige regra no cadastro mínimo", () => {
    expect(view).not.toContain('name="regra_participante_id"');
    expect(view).toContain('name="sem_regra" value="true"');
    expect(view).toContain("Comissão direta");
  });

  it("ação sempre solicita o valor exato sem regra", () => {
    expect(actions).toContain("p_regra_participante_id: null");
    expect(actions).toContain("p_sem_regra: true");
    expect(actions).not.toContain("Selecione a regra ou marque");
  });

  it("banco ignora regra até para clientes antigos", () => {
    expect(migration).toContain("rpc_lancar_item_repasse_legado_antes_184");
    expect(migration).toContain("NULL,\n    true,");
  });
});
