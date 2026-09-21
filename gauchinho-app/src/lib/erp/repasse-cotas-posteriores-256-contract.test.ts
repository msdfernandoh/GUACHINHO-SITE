import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), "..", file), "utf8");

describe("fase 256: cotas posteriores ao PDF", () => {
  it("mostra grupo e cota ou ordem interna na seleção", () => {
    const ui = read("gauchinho-app/src/components/erp/repasse-pdf-conciliacao.tsx");
    expect(ui).toContain("Grupo ${p.numero_grupo");
    expect(ui).toContain("Cota não cadastrada");
    expect(ui).toContain("p.ordem_cota");
  });

  it("só identifica automaticamente uma cota não ambígua e preserva vínculos", () => {
    const sql = read("supabase/migrations/242_repasse_identificacao_cotas_apos_upload.sql");
    expect(sql).toContain("v_quantidade = 1");
    expect(sql).toContain("f.competencia = imp.competencia");
    expect(sql).toContain("f.ordem_etapa = v_item.parcela_numero");
    expect(sql).toContain("x.previsao_franquia_id = f.id");
    expect(sql).toContain("rpc_corrigir_vinculo_item_repasse");
  });
});
