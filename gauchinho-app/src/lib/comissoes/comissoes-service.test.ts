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
  calcularCompetencia,
} from "./comissoes-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "e2000000-0000-0000-0000-000000000002";

describe("SUÍTE DE TESTES MACROBLOCO C — MOTOR DE COMISSÕES, PREVISÕES E COMPETÊNCIAS", () => {
  it("1. Função auxiliar calcularCompetencia calcula corretamente o formato YYYY-MM", () => {
    expect(calcularCompetencia("2026-08-10T10:00:00Z", 0)).toBe("2026-08");
    expect(calcularCompetencia("2026-08-10T10:00:00Z", 1)).toBe("2026-09");
    expect(calcularCompetencia("2026-08-10T10:00:00Z", 12)).toBe("2027-08");
  });

  it("2. Empresa B (0 concessões e 0 vendas) possui ZERO previsões de comissão", async () => {
    const franqB = await listPrevisoesFranquiaForEmpresa(EMPRESA_B_ID);
    expect(franqB).toHaveLength(0);

    const partB = await listPrevisoesParticipantesForEmpresa(EMPRESA_B_ID);
    expect(partB).toHaveLength(0);
  });

  it("3. Geração de previsões de comissão é IDEMPOTENTE, calcula etapas e suporta suspensão/reativação", async () => {
    const admin = createAdminClient();

    const { data: grupo } = await admin.from("grupos_consorcio").select("id, administradora_id").limit(1).single();
    expect(grupo).not.toBeNull();

    // 1. Cria venda de teste
    const { data: venda, error: errVenda } = await admin
      .from("vendas")
      .insert({
        empresa_id: GAUCHINHO_EMPRESA_ID,
        cliente_nome: "Cliente Teste Motor Comissões",
        administradora_id: grupo!.administradora_id,
        grupo_id: grupo!.id,
        valor_credito: 200000,
        prazo: 180,
        parcela: 1200,
        status: "confirmada",
        data_venda: "2026-08-10T10:00:00Z",
      })
      .select("*")
      .single();

    expect(errVenda).toBeNull();
    expect(venda).not.toBeNull();

    // 2. Primeira geração de previsões
    const prevs1 = await gerarPrevisoesComissaoParaVenda(GAUCHINHO_EMPRESA_ID, venda!.id);
    expect(prevs1.franquia).toHaveLength(1);
    expect(prevs1.franquia[0].valor_previsto).toBe(8000); // 4% de 200.000
    expect(prevs1.franquia[0].competencia).toBe("2026-08");

    // 3. Segunda geração (Idempotência check)
    const prevs2 = await gerarPrevisoesComissaoParaVenda(GAUCHINHO_EMPRESA_ID, venda!.id);
    expect(prevs2.franquia[0].id).toBe(prevs1.franquia[0].id);

    // 4. Teste de Suspensão de Previsões (Inadimplência)
    await suspenderPrevisoesComissao(GAUCHINHO_EMPRESA_ID, venda!.id);
    const { data: franqSusp } = await admin
      .from("comissao_previsoes_franquia")
      .select("status")
      .eq("venda_id", venda!.id)
      .single();
    expect(franqSusp?.status).toBe("suspensa");

    // 5. Teste de Reativação de Previsões
    await reativarPrevisoesComissao(GAUCHINHO_EMPRESA_ID, venda!.id);
    const { data: franqReat } = await admin
      .from("comissao_previsoes_franquia")
      .select("status")
      .eq("venda_id", venda!.id)
      .single();
    expect(franqReat?.status).toBe("prevista");

    // Cleanup
    await admin.from("comissao_previsoes_franquia").delete().eq("venda_id", venda!.id);
    await admin.from("vendas").delete().eq("id", venda!.id);
  }, 15000);

  it("4. Bloqueia geração de previsões de venda pertencente a outro tenant", async () => {
    const admin = createAdminClient();

    const { data: grupo } = await admin.from("grupos_consorcio").select("id, administradora_id").limit(1).single();

    const { data: venda } = await admin
      .from("vendas")
      .insert({
        empresa_id: GAUCHINHO_EMPRESA_ID,
        cliente_nome: "Cliente Tenant Cross Test",
        administradora_id: grupo!.administradora_id,
        grupo_id: grupo!.id,
        valor_credito: 100000,
        prazo: 180,
        parcela: 600,
      })
      .select("*")
      .single();

    await expect(gerarPrevisoesComissaoParaVenda(EMPRESA_B_ID, venda!.id)).rejects.toThrow(
      "Acesso negado: a venda pertence a outro tenant.",
    );

    // Cleanup
    await admin.from("vendas").delete().eq("id", venda!.id);
  }, 15000);
});
