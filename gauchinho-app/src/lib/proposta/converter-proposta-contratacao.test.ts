import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { PROPOSTA_STATUS } from "@/lib/types";

describe("Fase 218 — Conversão de Proposta em Contratação (Contrato)", () => {
  it("deve conter o status 'Contratada' em PROPOSTA_STATUS", () => {
    expect(PROPOSTA_STATUS).toContain("Contratada");
  });

  it("deve possuir migration 218 com rpc_converter_proposta_em_contratacao atômica e segura", () => {
    const migrationPath = resolve(
      __dirname,
      "../../../../supabase/migrations/218_converter_proposta_em_contratacao.sql"
    );
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.rpc_converter_proposta_em_contratacao");
    expect(sql).toContain("contratacao_protocolo_seq");
    expect(sql).toContain("public.contratacoes_online");
    expect(sql).toContain("public.contratacoes_documentos");
    expect(sql).toContain("SET status = 'Contratada'");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.rpc_converter_proposta_em_contratacao");
  });

  it("deve possuir action marcarPropostaContratadaAction em admin/propostas/actions.ts", () => {
    const actionsPath = resolve(
      __dirname,
      "../../app/admin/propostas/actions.ts"
    );
    const code = readFileSync(actionsPath, "utf-8");

    expect(code).toContain("export async function marcarPropostaContratadaAction");
    expect(code).toContain("rpc_converter_proposta_em_contratacao");
    expect(code).toContain("revalidatePath(\"/admin/propostas\")");
    expect(code).toContain("revalidatePath(\"/erp/propostas\")");
    expect(code).toContain("revalidatePath(\"/erp/contratacoes\")");
    expect(code).toContain("/erp/contratacoes/");
    expect(code).toContain("/admin/contratacoes/");
  });

  it("deve conter a opção de escolha (Apenas Proposta vs Contratação) no wizard do site após documentos", () => {
    const wizardPath = resolve(
      __dirname,
      "../../components/contratacao/contratacao-wizard.tsx"
    );
    const code = readFileSync(wizardPath, "utf-8");

    expect(code).toContain("Apenas Proposta");
    expect(code).toContain("Contratação");
    expect(code).toContain("concluirComoApenasProposta");
    expect(code).toContain("Proposta salva com sucesso!");
  });

  it("deve possuir as rotas de Propostas no ERP (/erp/propostas e /erp/propostas/[id])", () => {
    const erpListPage = resolve(
      __dirname,
      "../../app/erp/propostas/page.tsx"
    );
    const erpDetailPage = resolve(
      __dirname,
      "../../app/erp/propostas/[id]/page.tsx"
    );

    const listCode = readFileSync(erpListPage, "utf-8");
    const detailCode = readFileSync(erpDetailPage, "utf-8");

    expect(listCode).toContain("ErpPropostasPage");
    expect(listCode).toContain("MarcarPropostaContratadaButton");
    expect(listCode).toContain("requireErpRouteAccess");

    expect(detailCode).toContain("ErpPropostaDetailPage");
    expect(detailCode).toContain("MarcarPropostaContratadaButton");
    expect(detailCode).toContain("requireErpRouteAccess");
  });
});
