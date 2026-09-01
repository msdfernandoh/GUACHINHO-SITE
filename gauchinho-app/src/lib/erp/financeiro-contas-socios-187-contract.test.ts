import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/187_financeiro_contas_socios_transferencias.sql"), "utf8");
const financeiro = fs.readFileSync(path.join(root, "gauchinho-app/src/app/erp/financeiro/page.tsx"), "utf8");
const comissoes = fs.readFileSync(path.join(root, "gauchinho-app/src/components/erp/comissoes/minhas-comissoes-client.tsx"), "utf8");
const actions = fs.readFileSync(path.join(root, "gauchinho-app/src/app/erp/minhas-comissoes/actions.ts"), "utf8");

describe("Fase 192 — financeiro por conta e equalização dos sócios", () => {
  it("mantém os novos livros append-only e tenant-aware", () => {
    expect(migration).toContain("financeiro_conta_movimentos");
    expect(migration).toContain("financeiro_transferencias_socios");
    expect(migration).toContain("bloquear_mutacao_financeira_187");
    expect(migration).toContain("can_read_tenant_internal(empresa_id)");
  });

  it("registra repasses e estornos na mesma conta da empresa", () => {
    expect(migration).toContain("registrar_recebimento_em_conta_187");
    expect(migration).toContain("registrar_estorno_em_conta_187");
    expect(migration).toContain("REPASSE_ADMINISTRADORA");
  });

  it("paga comissões agrupadas a partir de uma conta bancária", () => {
    expect(migration).toContain("rpc_registrar_pagamento_bancario");
    expect(actions).toContain("pagarComissoesAgrupadasAction");
    expect(actions).toContain("contaBancariaOrigemId");
    expect(comissoes).toContain("Pagamento agrupado");
    expect(comissoes).toContain("conta_origem_id");
  });

  it("separa transferência bancária da equalização entre sócios", () => {
    expect(migration).toContain("rpc_transferir_entre_contas");
    expect(migration).toContain("rpc_registrar_transferencia_socios");
    expect(financeiro).toContain("Transferir entre contas da empresa");
    expect(financeiro).toContain("Transferências pendentes entre sócios");
    expect(financeiro).toContain("Saldo interno, não saldo bancário pessoal");
  });
});
