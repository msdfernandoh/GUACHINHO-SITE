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
import { converterContratacaoEmVenda, listVendasForEmpresa, listCotasDefinitivasForEmpresa } from "./vendas-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "e2000000-0000-0000-0000-000000000002";

describe("SUÍTE DE TESTES MACROBLOCO B — VENDAS E COTAS DEFINITIVAS", () => {
  it("1. Empresa B (0 concessões) possui ZERO vendas e ZERO cotas definitivas", async () => {
    const vendasB = await listVendasForEmpresa(EMPRESA_B_ID);
    expect(vendasB).toHaveLength(0);

    const cotasB = await listCotasDefinitivasForEmpresa(EMPRESA_B_ID);
    expect(cotasB).toHaveLength(0);
  }, 15000);

  it("2. Conversão de contratação em venda é IDEMPOTENTE e imutável", async () => {
    const admin = createAdminClient();
    const tokenStr = `t-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    const { data: grupo } = await admin.from("grupos_consorcio").select("id, administradora_id").limit(1).single();
    expect(grupo).not.toBeNull();

    const { data: lead } = await admin.from("leads").insert({
      empresa_id: GAUCHINHO_EMPRESA_ID,
      nome: "Cliente Teste Conversao Venda",
      email: `teste.${tokenStr}@gauchinho.com.br`,
      origem: "simulador",
    }).select("*").single();

    const { data: contratacao, error: errContr } = await admin.from("contratacoes_online").insert({
      empresa_id: GAUCHINHO_EMPRESA_ID,
      lead_id: lead!.id,
      grupo_id: grupo!.id,
      public_token: tokenStr,
      protocolo: `P-${tokenStr}`,
      origem: "simulador",
      nome: "Cliente Teste Conversao Venda",
      email: `teste.${tokenStr}@gauchinho.com.br`,
      status: "aprovada",
    }).select("*").single();

    expect(errContr).toBeNull();
    expect(contratacao).not.toBeNull();

    // 1. Primeira Conversão
    const res1 = await converterContratacaoEmVenda(GAUCHINHO_EMPRESA_ID, contratacao!.id);
    expect(res1.venda).not.toBeNull();
    expect(res1.cotaDefinitiva).not.toBeNull();
    expect(res1.venda.empresa_id).toBe(GAUCHINHO_EMPRESA_ID);

    // 2. Segunda Conversão (Idempotência check)
    const res2 = await converterContratacaoEmVenda(GAUCHINHO_EMPRESA_ID, contratacao!.id);
    expect(res2.venda.id).toBe(res1.venda.id);
    expect(res2.cotaDefinitiva.id).toBe(res1.cotaDefinitiva.id);

    // Cleanup
    await admin.from("cotas_definitivas").delete().eq("venda_id", res1.venda.id);
    await admin.from("vendas").delete().eq("id", res1.venda.id);
    await admin.from("contratacoes_online").delete().eq("id", contratacao!.id);
    await admin.from("leads").delete().eq("id", lead!.id);
  }, 15000);

  it("3. Bloqueia conversão de contratação pertencente a outro tenant (Cross-tenant Isolation)", async () => {
    const admin = createAdminClient();
    const tokenStr = `t-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    const { data: grupo } = await admin.from("grupos_consorcio").select("id, administradora_id").limit(1).single();

    const { data: lead } = await admin.from("leads").insert({
      empresa_id: GAUCHINHO_EMPRESA_ID,
      nome: "Cliente Cross Tenant",
      email: `cross.${tokenStr}@gauchinho.com.br`,
    }).select("*").single();

    const { data: contratacao, error: errContr } = await admin.from("contratacoes_online").insert({
      empresa_id: GAUCHINHO_EMPRESA_ID,
      lead_id: lead!.id,
      grupo_id: grupo!.id,
      public_token: tokenStr,
      protocolo: `P-${tokenStr}`,
      origem: "simulador",
      nome: "Cliente Cross Tenant",
      status: "aprovada",
    }).select("*").single();

    expect(errContr).toBeNull();
    expect(contratacao).not.toBeNull();

    // Tenta converter usando Empresa B (deve lançar erro de isolamento)
    await expect(converterContratacaoEmVenda(EMPRESA_B_ID, contratacao!.id)).rejects.toThrow(
      "Acesso negado: a contratação pertence a outro tenant.",
    );

    // Cleanup
    await admin.from("contratacoes_online").delete().eq("id", contratacao!.id);
    await admin.from("leads").delete().eq("id", lead!.id);
  }, 15000);
});
