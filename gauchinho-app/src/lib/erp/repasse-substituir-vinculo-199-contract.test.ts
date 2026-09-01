import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("repasse — substituir vínculo divergente com reversão", () => {
  const migration = read("../supabase/migrations/199_substituir_vinculo_repasse_append_only.sql");
  const ui = read("src/components/erp/repasse-pdf-conciliacao.tsx");

  it("não atualiza item financeiro append-only", () => {
    expect(migration).not.toContain("UPDATE public.financeiro_recebimento_itens");
    expect(migration).toContain("VALUES(v_importacao.recebimento_id,v_anterior.id,-v_baixa)");
    expect(migration).toContain("(v_importacao.recebimento_id,v_nova.id,v_baixa)");
  });

  it("oferece substituição dentro da divergência", () => {
    expect(ui).toContain("Substituir vínculo pela parcela correta");
    expect(ui).toContain("Substituir vínculo e resolver");
    expect(ui).toContain("correctionAction={linkAction}");
  });

  it("recalcula vínculo, liquidação e elegibilidade atomicamente", () => {
    expect(migration).toContain("v_liquidado_anterior:=v_anterior.valor_liquidado-v_baixa");
    expect(migration).toContain("v_liquidado_novo:=v_nova.valor_liquidado+v_baixa");
    expect(migration).toContain("valor_elegivel=round");
    expect(migration).toContain("erp_repasse_vinculo_correcoes");
  });
});
