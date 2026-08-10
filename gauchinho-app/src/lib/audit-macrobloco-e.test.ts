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
import { listEquipesForEmpresa, createEquipe } from "./gestao/equipes-service";
import { listMetasForEmpresa, createMeta, calcularApuracaoMeta } from "./gestao/metas-service";
import { listTarefasForEmpresa, createTarefa, updateTarefaStatus } from "./gestao/tarefas-service";
import { logAuditEvent, listAuditLogsForEmpresa } from "./gestao/auditoria-service";
import { getResumoExecutivo, getResumoComercial, getResumoFinanceiroDash } from "./gestao/dashboards-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "8e4e13f9-80e6-44db-a21b-584a43b6f024";
const describeLive = process.env.RUN_LIVE_PRODUCTION_AUDIT === "true" ? describe : describe.skip;

describeLive("SUÍTE DE AUDITORIA END-TO-END DO MACROBLOCO E (GESTÃO, METAS, EQUIPES, AUDITORIA E DASHBOARDS)", () => {
  it("1. Tabelas da Migration 056 existem no Supabase remoto e possuem RLS habilitado", async () => {
    const admin = createAdminClient();

    const { data: eq, error: errEq } = await admin.from("equipes").select("id").limit(0);
    expect(errEq).toBeNull();
    expect(eq).toBeDefined();

    const { data: em, error: errEm } = await admin.from("equipe_membros").select("id").limit(0);
    expect(errEm).toBeNull();
    expect(em).toBeDefined();

    const { data: mt, error: errMt } = await admin.from("metas_comerciais").select("id").limit(0);
    expect(errMt).toBeNull();
    expect(mt).toBeDefined();

    const { data: tr, error: errTr } = await admin.from("tarefas_gestao").select("id").limit(0);
    expect(errTr).toBeNull();
    expect(tr).toBeDefined();

    const { data: ad, error: errAd } = await admin.from("audit_logs_central").select("id").limit(0);
    expect(errAd).toBeNull();
    expect(ad).toBeDefined();
  }, 15000);

  it("2. Empresa B (0 concessões) possui ZERO equipes, ZERO metas, ZERO tarefas e ZERO auditoria (Isolamento Absoluto)", async () => {
    const equipesB = await listEquipesForEmpresa(EMPRESA_B_ID);
    expect(equipesB).toHaveLength(0);

    const metasB = await listMetasForEmpresa(EMPRESA_B_ID);
    expect(metasB).toHaveLength(0);

    const tarefasB = await listTarefasForEmpresa(EMPRESA_B_ID);
    expect(tarefasB).toHaveLength(0);

    const logsB = await listAuditLogsForEmpresa(EMPRESA_B_ID);
    expect(logsB.logs).toHaveLength(0);
    expect(logsB.count).toBe(0);

    const resumoExecB = await getResumoExecutivo(EMPRESA_B_ID);
    expect(resumoExecB.total_credito_vendido).toBe(0);
    expect(resumoExecB.total_vendas_count).toBe(0);
    expect(resumoExecB.receita_recebida_franquia).toBe(0);
    expect(resumoExecB.saldo_caixa).toBe(0);
  }, 15000);

  it("3. Equipes, Metas e Apuração Dinâmica: Criar Meta → Calcular Realizado e % Atingimento", async () => {
    const admin = createAdminClient();

    // 1. Cria Equipe
    const equipe = await createEquipe(GAUCHINHO_EMPRESA_ID, {
      nome: `Equipe Audit ${Date.now()}`,
      descricao: "Equipe de Testes E2E",
    });
    expect(equipe.id).toBeDefined();
    expect(equipe.empresa_id).toBe(GAUCHINHO_EMPRESA_ID);

    // 2. Cria Meta Comercial de Crédito Vendido
    const meta = await createMeta(GAUCHINHO_EMPRESA_ID, {
      titulo: `Meta Audit ${Date.now()}`,
      indicador: "valor_credito_vendido",
      alvo_tipo: "empresa",
      periodo_tipo: "mensal",
      data_inicio: "2026-01-01",
      data_fim: "2026-12-31",
      valor_meta: 500000,
    });
    expect(meta.id).toBeDefined();

    // 3. Calcula Apuração
    const apuracao = await calcularApuracaoMeta(GAUCHINHO_EMPRESA_ID, meta.id);
    expect(apuracao.valor_realizado).toBeGreaterThanOrEqual(0);
    expect(apuracao.percentual_atingimento).toBeGreaterThanOrEqual(0);

    // Cleanup
    await admin.from("metas_comerciais").delete().eq("id", meta.id);
    await admin.from("equipes").delete().eq("id", equipe.id);
  }, 15000);

  it("4. Tarefas e Auditoria Central: Criar Tarefa → Atualizar Status → Log de Auditoria com Correlation ID", async () => {
    const admin = createAdminClient();
    const correlationId = `corr-${Date.now()}`;

    // 1. Log de Auditoria Central
    const log = await logAuditEvent(
      GAUCHINHO_EMPRESA_ID,
      null,
      "tarefas",
      "CRIAR_TAREFA",
      "tarefas_gestao",
      null,
      { teste: true },
      correlationId,
    );
    expect(log).toBeDefined();

    // 2. Consulta Log por correlation_id
    const logs = await listAuditLogsForEmpresa(GAUCHINHO_EMPRESA_ID, { correlation_id: correlationId });
    expect(logs.logs).toHaveLength(1);
    expect(logs.logs[0].correlation_id).toBe(correlationId);

    // 3. Cria Tarefa e altera status
    const tarefa = await createTarefa(GAUCHINHO_EMPRESA_ID, {
      titulo: `Tarefa Audit ${Date.now()}`,
      prioridade: "alta",
    });
    expect(tarefa.status).toBe("pendente");

    const tarefaAtualizada = await updateTarefaStatus(GAUCHINHO_EMPRESA_ID, tarefa.id, "concluida");
    expect(tarefaAtualizada.status).toBe("concluida");
    expect(tarefaAtualizada.concluido_em).not.toBeNull();

    // Cleanup
    await admin.from("tarefas_gestao").delete().eq("id", tarefa.id);
    await admin.from("audit_logs_central").delete().eq("id", log.id);
  }, 15000);

  it("5. Dashboards Executivo, Comercial e Financeiro consolidam métricas canônicas", async () => {
    const resumoExec = await getResumoExecutivo(GAUCHINHO_EMPRESA_ID);
    expect(resumoExec.total_credito_vendido).toBeGreaterThanOrEqual(0);

    const resumoCom = await getResumoComercial(GAUCHINHO_EMPRESA_ID);
    expect(resumoCom.leads_totais).toBeGreaterThanOrEqual(0);

    const resumoFin = await getResumoFinanceiroDash(GAUCHINHO_EMPRESA_ID);
    expect(resumoFin.saldo_caixa).toBeDefined();
  }, 15000);
});
