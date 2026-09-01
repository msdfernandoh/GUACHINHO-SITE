import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root=process.cwd();
const dashboard=fs.readFileSync(path.join(root,"src/components/erp/comissoes/company-commissions-dashboard.tsx"),"utf8");
const page=fs.readFileSync(path.join(root,"src/app/admin/comissoes/page.tsx"),"utf8");
const actions=fs.readFileSync(path.join(root,"src/app/admin/comissoes/actions.ts"),"utf8");
const minhas=fs.readFileSync(path.join(root,"src/components/erp/comissoes/minhas-comissoes-client.tsx"),"utf8");
describe("Fase 197 — painel mensal de comissões da empresa",()=>{
 it("oferece mês de referência e todos nas seções",()=>{expect(dashboard).toContain("Mês de referência");expect(dashboard).toContain('<option value="todos">Todos</option>');expect(dashboard).toContain("futureMonth");expect(dashboard).toContain("historyMonth");expect(dashboard).toContain("paymentMonth")});
 it("mostra cards de totais ao abrir as seções",()=>{expect(dashboard).toContain("Total previsto");expect(dashboard).toContain("Total recebido");expect(dashboard).toContain("Gerado no período");expect(dashboard).toContain("Gerado para a empresa");expect(minhas).toContain("Comissões geradas no mês")});
 it("agrupa participante, inclui ativos sem geração e paga seleção",()=>{expect(page).toContain('from("participantes_comerciais")');expect(dashboard).toContain("Consultor como agrupador e comissões como subitens");expect(dashboard).toContain("Pagar selecionadas");expect(dashboard).toContain("Pagar esta");expect(actions).toContain("const grupos = new Map");expect(actions).toContain("itens,")});
});
