import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), "..", relative), "utf8");

describe("fase 265 - evento ativo e perfil inicial do parceiro", () => {
  it("usa automaticamente um único evento ativo ou guarda o convite pendente", () => {
    const action = source("gauchinho-app/src/app/app-indicador/indicar/actions.ts");
    const query = source("gauchinho-app/src/lib/parceiros/eventos-indicador.ts");
    expect(query).toContain('.limit(1)');
    expect(action).toContain('.from("programa_convites_eventos_pendentes")');
    expect(action).toContain('status: "PENDENTE"');
  });

  it("reutiliza o perfil existente de 12,5% e mantém a troca manual", () => {
    const route = source("gauchinho-app/src/app/api/public/programa-indicacao/route.ts");
    const migration = source("supabase/migrations/249_parceiros_perfil_125_e_revisao.sql");
    expect(route).toContain('.eq("nome", "Gerador de Oportunidades")');
    expect(migration).toContain("v_regra.percentual_comissao <> 12.5");
    expect(migration).toContain("programa_indicacao_sinalizar_revisao_perfil");
    expect(migration).toContain("Racon Veiculo — Comissão");
  });

  it("exibe no ERP o modelo escolhido, o perfil atual e a revisão do gestor", () => {
    const list = source("gauchinho-app/src/components/admin/participantes/participantes-manager-view.tsx");
    expect(list).toContain("Modelo escolhido:");
    expect(list).toContain("Comissão atual:");
    expect(list).toContain("Alterar perfil manualmente");
    expect(list).toContain("Concluir revisão");
  });
});
