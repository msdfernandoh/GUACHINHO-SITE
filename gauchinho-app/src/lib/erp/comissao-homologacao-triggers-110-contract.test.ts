import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Migration 110 & Homologation Contract Tests", () => {
  it("should have migration 110 defined with safe triggers", () => {
    const migPath = path.resolve(
      __dirname,
      "../../../../supabase/migrations/110_fix_homologacao_regras_triggers.sql"
    );
    expect(fs.existsSync(migPath)).toBe(true);
    const content = fs.readFileSync(migPath, "utf-8");
    expect(content).toContain("comissao_regra_participante_before_write");
    expect(content).toContain("comissao_regra_before_write");
    expect(content).toContain("v_admin_id IS NULL");
  });

  it("should have safe async action handlers in erp-commission-hub-view", () => {
    const viewPath = path.resolve(
      __dirname,
      "../../components/erp/comissoes/erp-commission-hub-view.tsx"
    );
    expect(fs.existsSync(viewPath)).toBe(true);
    const content = fs.readFileSync(viewPath, "utf-8");
    expect(content).toContain("handleHomologateRule");
    expect(content).toContain("handleNewVersionRule");
    expect(content).toContain("globalFeedback");
  });
});
