import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("financeiro — transferência de comissão e crédito fiscal", () => {
  const migration = read("../supabase/migrations/194_comissoes_transferencia_conta_beneficiario.sql");
  const page = read("src/app/erp/financeiro/page.tsx");
  const actions = read("src/app/admin/comissoes/actions.ts");

  it("registra saída e entrada da comissão com chaves idempotentes distintas", () => {
    expect(migration).toContain("'pagamento-saida:'||v_pag.id::text");
    expect(migration).toContain("'pagamento-entrada:'||v_pag.id::text");
    expect(migration).toContain("participante_comercial_id");
  });

  it("repara somente pagamentos confirmados sem movimento anterior", () => {
    expect(migration).toContain("p.status='confirmado'");
    expect(migration).toContain("NOT EXISTS(SELECT 1 FROM public.financeiro_conta_movimentos m WHERE m.pagamento_id=p.id)");
    expect(migration).toContain("ON CONFLICT (empresa_id,idempotency_key) DO NOTHING");
  });

  it("novos pagamentos exigem conta bancária de saída", () => {
    expect(actions).toContain('formData.get("conta_origem_id")');
    expect(actions).toContain("contaBancariaOrigemId: contaOrigemId");
  });

  it("mostra o imposto descontado no mês sem criar entrada bancária", () => {
    expect(page).toContain('from("comissao_previsoes_franquia").select("valor_imposto")');
    expect(page).toContain("Crédito para impostos");
    expect(page).toContain("creditoFiscalMes");
  });
});
