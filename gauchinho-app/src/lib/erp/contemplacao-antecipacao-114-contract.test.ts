import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Contrato da Migration 114 - Contemplação de Cotas e Antecipação Integral de Comissões", () => {
  const root = path.resolve(process.cwd(), "..");
  const migrationPath = path.join(root, "supabase", "migrations", "114_contemplacao_antecipacao_comissoes.sql");
  const migrationContent = fs.readFileSync(migrationPath, "utf8");

  const vendasActionsPath = path.join(process.cwd(), "src", "app", "erp", "vendas", "actions.ts");
  const vendasActionsContent = fs.readFileSync(vendasActionsPath, "utf8");

  const vendasHubViewPath = path.join(process.cwd(), "src", "components", "erp", "vendas", "erp-vendas-hub-view.tsx");
  const vendasHubViewContent = fs.readFileSync(vendasHubViewPath, "utf8");

  it("garante RPC no banco com suporte a antecipação de comissões na contemplação", () => {
    expect(migrationContent).toContain("rpc_registrar_contemplacao_comissoes");
    expect(migrationContent).toContain("p_antecipar_comissoes boolean DEFAULT true");
    expect(migrationContent).toContain("tipo_gatilho = 'CONTEMPLACAO'");
  });

  it("garante action registrarContemplacaoAction com revalidação de caminhos", () => {
    expect(vendasActionsContent).toContain("registrarContemplacaoAction");
    expect(vendasActionsContent).toContain("rpc_registrar_contemplacao_comissoes");
    expect(vendasActionsContent).toContain('revalidatePath("/erp/minhas-comissoes")');
  });

  it("garante modal interativo com opções de antecipação e manutenção de cronograma", () => {
    expect(vendasHubViewContent).toContain("Registrar Contemplação da Cota");
    expect(vendasHubViewContent).toContain("Antecipar todas as parcelas restantes para o próximo pagamento");
    expect(vendasHubViewContent).toContain("Manter cronograma original mês a mês");
  });
});
