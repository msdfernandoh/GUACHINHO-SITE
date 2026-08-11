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
  registrarPagamentoParticipante,
  gerarCompensacaoParticipante,
  getResumoCaixaEmpresa,
} from "./financeiro-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "8e4e13f9-80e6-44db-a21b-584a43b6f024";
const describeLive = process.env.RUN_LIVE_PRODUCTION_AUDIT === "true" ? describe : describe.skip;

describeLive("SUÍTE DE TESTES MACROBLOCO D — MOTOR FINANCEIRO, LIQUIDAÇÃO E CAIXA", () => {
  it("1. Empresa B (0 concessões) possui ZERO em todos os indicadores do Caixa Financeiro", async () => {
    const resumoB = await getResumoCaixaEmpresa(EMPRESA_B_ID);
    expect(resumoB.totalEntradas).toBe(0);
    expect(resumoB.totalSaidas).toBe(0);
    expect(resumoB.saldoCaixa).toBe(0);
    expect(resumoB.totalPrevisoesReceber).toBe(0);
    expect(resumoB.totalPrevisoesPagar).toBe(0);
    expect(resumoB.totalSaldosACompensar).toBe(0);
  });

  it("2. Recebimento da Administradora liquida previsão da Franquia e lança ENTRADA no Caixa", async () => {
    const admin = createAdminClient();

    const { data: grupo } = await admin.from("grupos_consorcio").select("id, administradora_id").limit(1).single();

    // 1. Cria venda e gera previsões
    const { data: venda } = await admin
      .from("vendas")
      .insert({
        empresa_id: GAUCHINHO_EMPRESA_ID,
        cliente_nome: "Cliente Teste Recebimento Caixa",
        administradora_id: grupo!.administradora_id,
        grupo_id: grupo!.id,
        valor_credito: 100000,
        prazo: 180,
        parcela: 600,
      })
      .select("*")
      .single();

    const prevs = await gerarPrevisoesComissaoParaVenda(GAUCHINHO_EMPRESA_ID, venda!.id);
    const prevFranqId = prevs.franquia[0].id;

    // 2. Registra Recebimento Real
    const rec = await registrarRecebimentoAdministradora({
      empresaId: GAUCHINHO_EMPRESA_ID,
      administradoraId: grupo!.administradora_id,
      competencia: "2026-08",
      idempotencyKey: `teste-recebimento-${venda!.id}`,
      valorTotal: "4000.00",
      referenciaDocumento: "PIX-12345",
      itens: [{ previsaoFranquiaId: prevFranqId, valorLiquidado: "4000.00" }],
    });

    expect(rec).toBeDefined();
    expect(rec.status).toBe("confirmado");

    // 3. Verifica se lançou ENTRADA no caixa_movimentos
    const { data: movCaixa } = await admin
      .from("caixa_movimentos")
      .select("*")
      .eq("origem_id", rec.id)
      .single();

    expect(movCaixa).toBeDefined();
    expect(movCaixa?.tipo_movimento).toBe("entrada");
    expect(movCaixa?.valor).toBe(4000);

    // Cleanup
    await admin.from("caixa_movimentos").delete().eq("origem_id", rec.id);
    await admin.from("financeiro_recebimentos").delete().eq("id", rec.id);
    await admin.from("comissao_previsoes_franquia").delete().eq("venda_id", venda!.id);
    await admin.from("vendas").delete().eq("id", venda!.id);
  }, 15000);

  it("3. Pagamento de Participante abate Saldo a Compensar, calcula valor líquido e lança SAÍDA no Caixa", async () => {
    const admin = createAdminClient();

    const { data: grupo } = await admin.from("grupos_consorcio").select("id, administradora_id").limit(1).single();

    // 1. Cria participante fictício ou usa participante existente
    const { data: part } = await admin
      .from("participantes_comerciais")
      .select("id")
      .eq("empresa_id", GAUCHINHO_EMPRESA_ID)
      .limit(1)
      .maybeSingle();

    const partId = part?.id;

    if (!partId) {
      // Se não houver participante comercial na base de dev, pula graceful
      return;
    }

    // 2. Gera compensação pendente de R$ 500 para o participante
    const comp = await gerarCompensacaoParticipante(
      GAUCHINHO_EMPRESA_ID,
      "Estorno por cancelamento prévio",
      "500.00",
      partId,
      null,
      null,
      `teste-compensacao-${partId}`,
    );

    expect(comp).toBeDefined();
    expect(comp.status).toBe("pendente");

    // 3. Cria venda com o participante
    const { data: venda } = await admin
      .from("vendas")
      .insert({
        empresa_id: GAUCHINHO_EMPRESA_ID,
        participante_comercial_id: partId,
        cliente_nome: "Cliente Teste Pagamento Compensado",
        administradora_id: grupo!.administradora_id,
        grupo_id: grupo!.id,
        valor_credito: 100000,
        prazo: 180,
        parcela: 600,
      })
      .select("*")
      .single();

    const prevs = await gerarPrevisoesComissaoParaVenda(GAUCHINHO_EMPRESA_ID, venda!.id);
    expect(prevs.participantes).toHaveLength(1);
    const prevPartId = prevs.participantes[0].id; // R$ 1.500 previsto (1.5%)

    // 4. Executa pagamento bruto de R$ 1.500
    const pag = await registrarPagamentoParticipante({
      empresaId: GAUCHINHO_EMPRESA_ID,
      participanteComercialId: partId,
      competencia: "2026-08",
      idempotencyKey: `teste-pagamento-${venda!.id}`,
      valorBruto: "1500.00",
      itens: [{ previsaoParticipanteId: prevPartId, valorLiquidado: "1500.00" }],
    });

    // 5. Verifica se abateu R$ 500 de compensação e pagou líquido R$ 1.000
    expect(pag.valor_bruto).toBe(1500);
    expect(pag.valor_compensado).toBe(500);
    expect(pag.valor_liquido).toBe(1000);

    // 6. Verifica se a compensação ficou com status 'compensada' e saldo 0
    const { data: compAtualizada } = await admin
      .from("financeiro_compensacoes")
      .select("status, valor_saldo")
      .eq("id", comp.id)
      .single();

    expect(compAtualizada?.status).toBe("compensada");
    expect(compAtualizada?.valor_saldo).toBe(0);

    // 7. Verifica movimento de SAÍDA no Caixa no valor líquido de R$ 1.000
    const { data: movCaixa } = await admin
      .from("caixa_movimentos")
      .select("*")
      .eq("origem_id", pag.id)
      .single();

    expect(movCaixa).toBeDefined();
    expect(movCaixa?.tipo_movimento).toBe("saida");
    expect(movCaixa?.valor).toBe(1000);

    // Cleanup
    await admin.from("caixa_movimentos").delete().eq("origem_id", pag.id);
    await admin.from("financeiro_pagamentos").delete().eq("id", pag.id);
    await admin.from("financeiro_compensacoes").delete().eq("id", comp.id);
    await admin.from("comissao_previsoes_participantes").delete().eq("venda_id", venda!.id);
    await admin.from("comissao_previsoes_franquia").delete().eq("venda_id", venda!.id);
    await admin.from("vendas").delete().eq("id", venda!.id);
  }, 15000);
});
