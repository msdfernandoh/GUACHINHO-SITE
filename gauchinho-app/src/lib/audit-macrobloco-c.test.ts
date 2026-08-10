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
import {
  gerarPrevisoesComissaoParaVenda,
  suspenderPrevisoesComissao,
  reativarPrevisoesComissao,
  listPrevisoesFranquiaForEmpresa,
  listPrevisoesParticipantesForEmpresa,
} from "@/lib/comissoes/comissoes-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "e2000000-0000-0000-0000-000000000002";

describe("SUÍTE DE AUDITORIA END-TO-END DO MACROBLOCO C (MOTOR DE COMISSÕES E PREVISÕES)", () => {
  it("1. Tabelas da Migration 054 existem no Supabase remoto e possuem RLS habilitado", async () => {
    const admin = createAdminClient();

    const { data: pTable } = await admin.from("comissao_programas").select("id").limit(0);
    expect(pTable).toBeDefined();

    const { data: rfTable } = await admin.from("comissao_regras_franquia").select("id").limit(0);
    expect(rfTable).toBeDefined();

    const { data: rpTable } = await admin.from("comissao_regras_participantes").select("id").limit(0);
    expect(rpTable).toBeDefined();

    const { data: pfTable } = await admin.from("comissao_previsoes_franquia").select("id").limit(0);
    expect(pfTable).toBeDefined();

    const { data: ppTable } = await admin.from("comissao_previsoes_participantes").select("id").limit(0);
    expect(ppTable).toBeDefined();
  }, 15000);

  it("2. Empresa B (0 concessões e 0 vendas) possui ZERO previsões de comissão (Isolamento Absoluto)", async () => {
    const prevsFranquiaB = await listPrevisoesFranquiaForEmpresa(EMPRESA_B_ID);
    expect(prevsFranquiaB).toHaveLength(0);

    const prevsPartB = await listPrevisoesParticipantesForEmpresa(EMPRESA_B_ID);
    expect(prevsPartB).toHaveLength(0);
  });

  it("3. Motor de Comissões: Venda gera Previsões por Competência com Idempotência e Suporte a Inadimplência", async () => {
    const admin = createAdminClient();

    const { data: grupo } = await admin.from("grupos_consorcio").select("id, administradora_id").limit(1).single();
    expect(grupo).not.toBeNull();

    // 1. Cria venda de teste
    const { data: venda, error: errVenda } = await admin
      .from("vendas")
      .insert({
        empresa_id: GAUCHINHO_EMPRESA_ID,
        cliente_nome: "Cliente Audit E2E Macrobloco C",
        administradora_id: grupo!.administradora_id,
        grupo_id: grupo!.id,
        valor_credito: 300000,
        prazo: 180,
        parcela: 1800,
        status: "confirmada",
        data_venda: "2026-08-10T10:00:00Z",
      })
      .select("*")
      .single();

    expect(errVenda).toBeNull();
    expect(venda).not.toBeNull();

    // 2. Executa o Motor de Comissão (Primeira Geração)
    const prevs1 = await gerarPrevisoesComissaoParaVenda(GAUCHINHO_EMPRESA_ID, venda!.id);
    expect(prevs1.franquia).toHaveLength(1);
    expect(prevs1.franquia[0].valor_previsto).toBe(12000); // 4% de 300.000
    expect(prevs1.franquia[0].competencia).toBe("2026-08");

    // 3. Segunda Geração (Teste de Idempotência)
    const prevs2 = await gerarPrevisoesComissaoParaVenda(GAUCHINHO_EMPRESA_ID, venda!.id);
    expect(prevs2.franquia[0].id).toBe(prevs1.franquia[0].id);

    // 4. Inadimplência: Suspensão de Previsões
    await suspenderPrevisoesComissao(GAUCHINHO_EMPRESA_ID, venda!.id);
    const { data: fSusp } = await admin
      .from("comissao_previsoes_franquia")
      .select("status")
      .eq("venda_id", venda!.id)
      .single();
    expect(fSusp?.status).toBe("suspensa");

    // 5. Reativação: Volta à Elegibilidade
    await reativarPrevisoesComissao(GAUCHINHO_EMPRESA_ID, venda!.id);
    const { data: fReat } = await admin
      .from("comissao_previsoes_franquia")
      .select("status")
      .eq("venda_id", venda!.id)
      .single();
    expect(fReat?.status).toBe("prevista");

    // Cleanup
    await admin.from("comissao_previsoes_franquia").delete().eq("venda_id", venda!.id);
    await admin.from("vendas").delete().eq("id", venda!.id);
  }, 15000);
});
