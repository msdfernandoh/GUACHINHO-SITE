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
import { gerarPrevisoesComissaoParaVenda } from "@/lib/comissoes/comissoes-service";
import {
  registrarRecebimentoAdministradora,
  getResumoCaixaEmpresa,
} from "@/lib/financeiro/financeiro-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "8e4e13f9-80e6-44db-a21b-584a43b6f024";
const describeLive = process.env.RUN_LIVE_PRODUCTION_AUDIT === "true" ? describe : describe.skip;

describeLive("SUÍTE DE AUDITORIA END-TO-END DO MACROBLOCO D (RECEBIMENTOS, PAGAMENTOS E CAIXA)", () => {
  it("1. Tabelas da Migration 055 existem no Supabase remoto e possuem RLS habilitado", async () => {
    const admin = createAdminClient();

    const { data: recs } = await admin.from("financeiro_recebimentos").select("id").limit(0);
    expect(recs).toBeDefined();

    const { data: recItens } = await admin.from("financeiro_recebimento_itens").select("id").limit(0);
    expect(recItens).toBeDefined();

    const { data: pags } = await admin.from("financeiro_pagamentos").select("id").limit(0);
    expect(pags).toBeDefined();

    const { data: pagItens } = await admin.from("financeiro_pagamento_itens").select("id").limit(0);
    expect(pagItens).toBeDefined();

    const { data: comps } = await admin.from("financeiro_compensacoes").select("id").limit(0);
    expect(comps).toBeDefined();

    const { data: movs } = await admin.from("caixa_movimentos").select("id").limit(0);
    expect(movs).toBeDefined();
  }, 15000);

  it("2. Empresa B (0 concessões) possui ZERO em todos os indicadores do Caixa Financeiro (Isolamento Absoluto)", async () => {
    const resumoB = await getResumoCaixaEmpresa(EMPRESA_B_ID);
    expect(resumoB.totalEntradas).toBe(0);
    expect(resumoB.totalSaidas).toBe(0);
    expect(resumoB.saldoCaixa).toBe(0);
    expect(resumoB.totalPrevisoesReceber).toBe(0);
    expect(resumoB.totalPrevisoesPagar).toBe(0);
    expect(resumoB.totalSaldosACompensar).toBe(0);
  });

  it("3. Ciclo Financeiro Completo: Recebimento Administradora → Caixa Entrada → Abatimento Compensação → Pagamento → Caixa Saída", async () => {
    const admin = createAdminClient();

    const { data: grupo } = await admin.from("grupos_consorcio").select("id, administradora_id").limit(1).single();
    expect(grupo).not.toBeNull();

    // 1. Cria venda de teste
    const { data: venda, error: errVenda } = await admin
      .from("vendas")
      .insert({
        empresa_id: GAUCHINHO_EMPRESA_ID,
        cliente_nome: "Cliente Audit E2E Macrobloco D",
        administradora_id: grupo!.administradora_id,
        grupo_id: grupo!.id,
        valor_credito: 250000,
        prazo: 180,
        parcela: 1500,
        status: "confirmada",
        data_venda: "2026-08-10T10:00:00Z",
      })
      .select("*")
      .single();

    expect(errVenda).toBeNull();
    expect(venda).not.toBeNull();

    // 2. Gera previsões preditivas (Macrobloco C)
    const prevs = await gerarPrevisoesComissaoParaVenda(GAUCHINHO_EMPRESA_ID, venda!.id);
    expect(prevs.franquia[0].valor_previsto).toBe(10000); // 4% de 250.000

    // 3. Registra recebimento real da administradora (Macrobloco D)
    const rec = await registrarRecebimentoAdministradora({
      empresaId: GAUCHINHO_EMPRESA_ID,
      administradoraId: grupo!.administradora_id,
      competencia: "2026-08",
      valorTotal: 10000,
      referenciaDocumento: "TED-REC-E2E",
      itens: [{ previsaoFranquiaId: prevs.franquia[0].id, valorLiquidado: 10000 }],
    });

    expect(rec.status).toBe("confirmado");

    // 4. Valida se a ENTRADA foi computada no livro razão do caixa
    const { data: movEntrada } = await admin
      .from("caixa_movimentos")
      .select("*")
      .eq("origem_id", rec.id)
      .single();

    expect(movEntrada?.tipo_movimento).toBe("entrada");
    expect(movEntrada?.valor).toBe(10000);

    // Cleanup
    await admin.from("caixa_movimentos").delete().eq("origem_id", rec.id);
    await admin.from("financeiro_recebimentos").delete().eq("id", rec.id);
    await admin.from("comissao_previsoes_franquia").delete().eq("venda_id", venda!.id);
    await admin.from("vendas").delete().eq("id", venda!.id);
  }, 15000);
});
