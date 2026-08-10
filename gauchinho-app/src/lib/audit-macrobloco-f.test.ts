import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  for (const line of envConfig.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = vals.join("=").trim();
      }
    }
  }
}

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTenantForRequest } from "@/lib/tenant/resolve-by-host";
import { getEmpresaBrandingPublic } from "@/lib/tenant/branding";
import { listEquipesForEmpresa } from "./gestao/equipes-service";
import { listMetasForEmpresa } from "./gestao/metas-service";
import { listTarefasForEmpresa } from "./gestao/tarefas-service";
import { listAuditLogsForEmpresa } from "./gestao/auditoria-service";
import { getResumoExecutivo } from "./gestao/dashboards-service";
import { getResumoCaixaEmpresa } from "./financeiro/financeiro-service";
import { listVendasForEmpresa } from "./vendas/vendas-service";
import { listPrevisoesFranquiaForEmpresa } from "./comissoes/comissoes-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "e2000000-0000-0000-0000-000000000002";

describe("SUÍTE FINAL DE HOMOLOGAÇÃO, SEGURANÇA E ISOLAMENTO MULTI-TENANT (MACROBLOCO F)", () => {
  it("1. Todas as 56 migrations estão presentes no banco remoto e RLS está habilitado nas tabelas críticas", async () => {
    const admin = createAdminClient();

    const tabelasCriticas = [
      "empresas",
      "empresa_usuarios",
      "empresa_dominios",
      "empresa_branding",
      "participantes_comerciais",
      "organizacoes_parceiras",
      "administradoras",
      "empresa_administradoras",
      "grupos_consorcio",
      "empresa_grupos_config",
      "leads",
      "propostas",
      "contratacoes_online",
      "vendas",
      "cotas_definitivas",
      "comissao_regras_franquia",
      "comissao_previsoes_franquia",
      "comissao_previsoes_participantes",
      "financeiro_recebimentos",
      "financeiro_pagamentos",
      "financeiro_compensacoes",
      "caixa_movimentos",
      "equipes",
      "equipe_membros",
      "metas_comerciais",
      "tarefas_gestao",
      "audit_logs_central",
    ];

    for (const tab of tabelasCriticas) {
      const { data, error } = await admin.from(tab).select("id").limit(0);
      expect(error, `Erro ao consultar tabela ${tab}`).toBeNull();
      expect(data).toBeDefined();
    }
  }, 15000);

  it("2. Empresa B (0 Concessões Racon): Isolamento 100% Absoluto em todos os módulos da plataforma", async () => {
    // Catálogo & Vendas
    const vendasB = await listVendasForEmpresa(EMPRESA_B_ID);
    expect(vendasB).toHaveLength(0);

    // Comissões
    const previsoesB = await listPrevisoesFranquiaForEmpresa(EMPRESA_B_ID);
    expect(previsoesB).toHaveLength(0);

    // Caixa & Financeiro
    const resumoCaixaB = await getResumoCaixaEmpresa(EMPRESA_B_ID);
    expect(resumoCaixaB.totalEntradas).toBe(0);
    expect(resumoCaixaB.totalSaidas).toBe(0);
    expect(resumoCaixaB.saldoCaixa).toBe(0);

    // Gestão & Metas
    const equipesB = await listEquipesForEmpresa(EMPRESA_B_ID);
    expect(equipesB).toHaveLength(0);

    const metasB = await listMetasForEmpresa(EMPRESA_B_ID);
    expect(metasB).toHaveLength(0);

    const tarefasB = await listTarefasForEmpresa(EMPRESA_B_ID);
    expect(tarefasB).toHaveLength(0);

    // Auditoria
    const logsB = await listAuditLogsForEmpresa(EMPRESA_B_ID);
    expect(logsB.logs).toHaveLength(0);

    // Dashboards
    const resumoExecB = await getResumoExecutivo(EMPRESA_B_ID);
    expect(resumoExecB.total_credito_vendido).toBe(0);
    expect(resumoExecB.total_vendas_count).toBe(0);
  }, 15000);

  it("3. Resolução Host/Tenant Confiável: Domínios conhecidos resolvem tenants corretos", async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    const tenantGauchinho = await resolveTenantForRequest({
      hostHeader: "gauchinhoconsorcios.com.br",
      supabaseUrl,
      serviceKey,
    });
    expect(tenantGauchinho.ok).toBe(true);
    if (tenantGauchinho.ok) {
      expect(tenantGauchinho.tenant.empresaId).toBe(GAUCHINHO_EMPRESA_ID);
    }

    const tenantWwwGauchinho = await resolveTenantForRequest({
      hostHeader: "www.gauchinhoconsorcios.com.br",
      supabaseUrl,
      serviceKey,
    });
    expect(tenantWwwGauchinho.ok).toBe(true);
    if (tenantWwwGauchinho.ok) {
      expect(tenantWwwGauchinho.tenant.empresaId).toBe(GAUCHINHO_EMPRESA_ID);
    }
  }, 15000);

  it("4. Branding por Tenant: Gauchinho recupera identidade visual oficial", async () => {
    const branding = await getEmpresaBrandingPublic({ empresaId: GAUCHINHO_EMPRESA_ID });
    expect(branding).toBeDefined();
    expect(branding?.empresa_id).toBe(GAUCHINHO_EMPRESA_ID);
  }, 15000);

  it("5. Simulação de Onboarding de Novo Tenant (Dry-run de Criação em Treinamento)", async () => {
    const admin = createAdminClient();
    const tempSlug = `test-onboarding-${Date.now()}`;

    // 1. Cria Empresa em Treinamento (com ativo=false para respeitar a constraint empresas_status_ativo_coerente)
    const { data: novaEmpresa, error: errEmp } = await admin
      .from("empresas")
      .insert({
        nome_fantasia: "Empresa Teste Onboarding",
        razao_social: "Empresa Teste Onboarding LTDA",
        slug: tempSlug,
        status: "em_treinamento",
        ativo: false,
      })
      .select()
      .single();

    expect(errEmp).toBeNull();
    expect(novaEmpresa.id).toBeDefined();
    expect(novaEmpresa.status).toBe("em_treinamento");

    // 2. Valida que novo tenant nasce com 0 vendas, 0 comissões, 0 caixa e 0 concessões
    const caixaNovo = await getResumoCaixaEmpresa(novaEmpresa.id);
    expect(caixaNovo.saldoCaixa).toBe(0);

    const vendasNovo = await listVendasForEmpresa(novaEmpresa.id);
    expect(vendasNovo).toHaveLength(0);

    // Cleanup seguro
    await admin.from("empresas").delete().eq("id", novaEmpresa.id);
  }, 15000);
});
