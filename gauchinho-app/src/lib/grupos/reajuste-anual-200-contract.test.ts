import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const sql = fs.readFileSync(path.join(root, "supabase/migrations/193_grupos_reajuste_anual_canonico.sql"), "utf8");
const form = fs.readFileSync(path.join(root, "gauchinho-app/src/components/erp/group-catalog-form.tsx"), "utf8");
const platform = fs.readFileSync(path.join(root, "gauchinho-app/src/components/platform/grupo-operational-workspace.tsx"), "utf8");
const row = fs.readFileSync(path.join(root, "gauchinho-app/src/components/public/grupos/grupo-row.tsx"), "utf8");
const mobile = fs.readFileSync(path.join(root, "gauchinho-app/src/components/public/grupos/grupo-mobile-card.tsx"), "utf8");

describe("Fase 200 — reajuste anual canônico dos grupos", () => {
  it("persiste regra exclusiva fixa ou variável", () => {
    expect(sql).toContain("tipo_reajuste_anual = 'FIXO'");
    expect(sql).toContain("tipo_reajuste_anual = 'VARIAVEL'");
    expect(sql).toContain("grupos_consorcio_reajuste_anual_check");
    expect(sql).toContain("trg_aplicar_reajuste_anual_solicitacao_aprovada");
  });
  it("edita no ERP e no SaaS", () => {
    for (const source of [form, platform]) {
      expect(source).toContain("tipo_reajuste_anual");
      expect(source).toContain("Percentual anual");
      expect(source).toContain("Nome do índice / alíquota");
    }
  });
  it("exibe no catálogo desktop e móvel", () => {
    expect(row).toContain("descricaoReajusteAnual");
    expect(mobile).toContain("descricaoReajusteAnual");
  });
});
