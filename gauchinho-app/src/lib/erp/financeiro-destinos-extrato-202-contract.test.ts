import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(process.cwd(), "..");
const migration = fs.readFileSync(path.join(raiz, "supabase/migrations/202_corrigir_destino_comissoes_e_extrato_contas.sql"), "utf8");
const page = fs.readFileSync(path.join(process.cwd(), "src/app/erp/financeiro/page.tsx"), "utf8");

describe("Migration 202 - destinos de comissões e extrato bancário", () => {
  it("preserva o livro append-only e corrige os beneficiários", () => {
    expect(migration).toContain("Reversão da transferência indevida da comissão de Fernando");
    expect(migration).toContain("pagamento-entrada:");
    expect(migration).toContain("participante_comercial_id = 'd32ca86d-e5e5-4355-8449-c31ee3586d13'");
    expect(migration).not.toMatch(/DELETE FROM public\.financeiro_/i);
  });

  it("oferece filtro e extrato explícito por conta", () => {
    expect(page).toContain("Conta para extrato");
    expect(page).toContain("Ver extrato desta conta");
    expect(page).toContain("Extrato de entradas e saídas");
    expect(page).toContain("movimentosExibidos");
  });
});
