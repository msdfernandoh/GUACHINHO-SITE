import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),"utf8");

describe("filtros financeiros, vendas e navegação do painel",()=>{
  const financeiro=read("src/app/erp/financeiro/page.tsx");
  const vendas=read("src/components/erp/vendas/erp-vendas-hub-view.tsx");
  const dashboard=read("src/components/erp/erp-dashboard-view.tsx");
  const comissoes=read("src/components/erp/comissoes/company-commissions-dashboard.tsx");
  const migration=read("../supabase/migrations/196_comissao_conta_destino_opcional_e_transferencia_particular.sql");

  it("financeiro oferece mês e todo o histórico",()=>{
    expect(financeiro).toContain("Mês de referência");
    expect(financeiro).toContain("/erp/financeiro?mes=todos");
    expect(financeiro).toContain("Saldo ao fim de");
  });

  it("vendas filtra pela competência canônica e mostra os cinco indicadores",()=>{
    expect(vendas).toContain('(v.data_primeira_parcela||v.data_venda).slice(0,7)');
    for(const label of ["Valor vendido","Meta","Falta para meta","Comissões geradas","Valor para empresa"]) expect(vendas).toContain(label);
    expect(vendas).toContain('<option value="todos">Todos</option>');
  });

  it("cards do painel navegam para os módulos operacionais",()=>{
    expect(dashboard).toContain('<Link href="/erp/vendas"');
    expect(dashboard).toContain('<Link href="/erp/comissoes"');
    expect(dashboard).toContain('<Link href="/erp/minhas-comissoes"');
  });

  it("pagamento aceita destino opcional e a correção é append-only",()=>{
    expect(comissoes).toContain('name="conta_destino_id"');
    expect(migration).toContain("p_conta_destino_id uuid DEFAULT NULL");
    expect(migration).toContain("financeiro_transferencias_contas");
    expect(migration).toContain("correcao-destino-comissao:871098fa-555f-4081-b67b-60000b608785");
  });
});
