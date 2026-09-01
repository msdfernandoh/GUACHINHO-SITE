import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("repasse — correção de vínculo já baixado", () => {
  const migration = read("../supabase/migrations/198_corrigir_vinculo_repasse_com_baixa.sql");
  const action = read("src/app/erp/repasse-franquia/actions.ts");
  const ui = read("src/components/erp/repasse-pdf-conciliacao.tsx");

  it("usa uma operação transacional e auditada para corrigir", () => {
    expect(action).toContain('rpc("rpc_corrigir_vinculo_item_repasse"');
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.erp_repasse_vinculo_correcoes");
    expect(migration).toContain("UNIQUE (empresa_id, idempotency_key)");
    expect(migration).toContain("public.has_company_permission(p_empresa_id,'gerenciar_financeiro')");
  });

  it("transfere somente a classificação e recalcula os dois lados", () => {
    expect(migration).toContain("UPDATE public.financeiro_recebimento_itens SET previsao_franquia_id=v_nova.id");
    expect(migration).toContain("v_liquidado_anterior:=v_anterior.valor_liquidado-v_baixa");
    expect(migration).toContain("v_liquidado_novo:=v_nova.valor_liquidado+v_baixa");
    expect(migration).toContain("valor_elegivel=round");
    expect(migration).not.toContain("UPDATE public.financeiro_recebimentos");
  });

  it("protege comissão paga e mostra o resultado perto da conferência", () => {
    expect(migration).toContain("Estorne o pagamento antes de corrigir o vínculo");
    expect(ui).toContain('role="alert"');
    expect(action).toContain("Vínculo corrigido. Baixa de");
  });
});
