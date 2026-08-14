import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.cwd(), "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
describe("correção operacional 077", () => {
  const migration = read(
    "supabase/migrations/077_fix_076_fluxo_administradora_operacional.sql",
  );
  it("mantém 076 imutável e implementa a correção na migration seguinte", () => {
    expect(migration).toContain("077: correções forward-only");
    expect(migration).toContain("administradora_tipo_aliases");
    expect(migration).toContain("AUTOMOVEIS");
  });
  it("separa recebimento real de conciliação sem novo caixa", () => {
    const conciliation = migration.slice(
      migration.indexOf("rpc_conciliar_recebimento_manual"),
      migration.indexOf("CREATE TABLE public.cota_estrategias_lance"),
    );
    expect(conciliation).not.toContain("INSERT INTO public.caixa_movimentos");
    expect(migration).toContain("rpc_registrar_recebimento_manual");
  });
  it("permite cronograma vazio somente para regra automática", () => {
    expect(migration).toContain(
      "modo_regra='AUTOMATICA' AND jsonb_array_length(etapas_cronograma)=0",
    );
    expect(migration).toContain(
      "modo_regra='MANUAL' AND jsonb_array_length(etapas_cronograma)>0",
    );
  });
  it("lances pertencem à cota e preservam histórico", () => {
    expect(migration).toContain("CREATE TABLE public.cota_estrategias_lance (");
    expect(migration).toContain(
      "CREATE TABLE public.cota_estrategias_lance_historico",
    );
    expect(migration).toContain(
      "Lance embutido excede o limite permitido pelo Grupo",
    );
  });
  it("ERP Grupos e Lances não reutilizam editor legado", () => {
    const operational = read(
      "gauchinho-app/src/components/erp/erp-operational-pages.tsx",
    );
    const groups = read("gauchinho-app/src/app/erp/grupos/page.tsx");
    expect(operational).not.toContain(
      'import Grupos from "@/app/admin/grupos/page"',
    );
    expect(groups).toContain("Novo Grupo Local");
    expect(operational).not.toContain("Abra um grupo para editar estrategias");
  });
  it("UI automática oculta cronograma próprio", () => {
    const manager = read(
      "gauchinho-app/src/components/erp/commission-rule-manager.tsx",
    );
    expect(manager).toMatch(
      /participantMode\s*===\s*"AUTOMATICA"\s*\?\s*"\[\]"/,
    );
    expect(manager).toMatch(
      /Esta regra acompanha automaticamente o cronograma da comissão da\s+Franqueadora/,
    );
  });
});
