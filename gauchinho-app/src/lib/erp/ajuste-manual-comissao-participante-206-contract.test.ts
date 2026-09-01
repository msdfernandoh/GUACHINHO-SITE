import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";
const sql=readFileSync(resolve(process.cwd(),"../supabase/migrations/206_ajuste_manual_previsao_participante_auditado.sql"),"utf8");
const ui=readFileSync(resolve(process.cwd(),"src/components/erp/comissoes/company-commissions-dashboard.tsx"),"utf8");
const actions=readFileSync(resolve(process.cwd(),"src/app/admin/comissoes/actions.ts"),"utf8");
describe("Fase 206 — ajuste manual de comissão do participante",()=>{
 it("expõe edição de gerado e disponível com motivo",()=>{expect(ui).toContain("Editar manualmente");expect(ui).toContain("Valor gerado");expect(ui).toContain("Valor disponível");expect(actions).toContain("rpc_ajustar_previsao_participante_manual")});
 it("protege pagamentos e limites monetários",()=>{expect(sql).toContain("p_valor_elegivel > p_valor_previsto");expect(sql).toContain("p_valor_elegivel < v_previsao.valor_pago");expect(sql).toContain("valor_pago_preservado")});
 it("registra valores anteriores, novos, usuário e motivo",()=>{expect(sql).toContain("audit_logs_central");expect(sql).toContain("valor_elegivel_anterior");expect(sql).toContain("usuario_auth_id");expect(sql).toContain("v_motivo")});
});
