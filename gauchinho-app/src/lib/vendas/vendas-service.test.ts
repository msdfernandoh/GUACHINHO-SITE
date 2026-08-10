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
  converterContratacaoEmVenda,
  listVendasForEmpresa,
  listCotasDefinitivasForEmpresa,
} from "./vendas-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "e2000000-0000-0000-0000-000000000002";

describe("SUÍTE DE TESTES MACROBLOCO B — VENDAS E COTAS DEFINITIVAS", () => {
  it("1. Empresa B (0 concessões) possui ZERO vendas e ZERO cotas definitivas", async () => {
    const vendasB = await listVendasForEmpresa(EMPRESA_B_ID);
    expect(vendasB).toHaveLength(0);

    const cotasB = await listCotasDefinitivasForEmpresa(EMPRESA_B_ID);
    expect(cotasB).toHaveLength(0);
  });

  it("2. Conversão de contratação em venda é IDEMPOTENTE e imutável", async () => {
    const admin = createAdminClient();

    // 1. Busca um grupo real ativo
    const { data: grupo } = await admin
      .from("grupos_consorcio")
      .select("id, codigo_grupo, administradora_id, prazo_total")
      .limit(1)
      .single();

    expect(grupo).not.toBeNull();

    // 2. Insere contratação simulada no banco
    const token = `test-token-${Date.now()}`;
    const protocolo = `PROT-${Date.now()}`;
    const { data: contratacao, error: errContr } = await admin
      .from("contratacoes_online")
      .insert({
        empresa_id: GAUCHINHO_EMPRESA_ID,
        public_token: token,
        protocolo: protocolo,
        origem: "grupos",
        nome: "Cliente Teste Idempotência",
        cpf: "000.000.000-00",
        email: "cliente.idempotencia@teste.com",
        telefone: "(51) 99999-9999",
        grupo_id: grupo!.id,
        credito_selecionado: 100000,
        prazo: grupo!.prazo_total ?? 180,
        parcela_estimada: 650,
        status: "link_gerado",
        dados_simulacao: {
          grupoId: grupo!.id,
          valor_credito: 100000,
          prazo: grupo!.prazo_total ?? 180,
          valor_parcela: 650,
        },
      })
      .select("*")
      .single();

    expect(errContr).toBeNull();
    expect(contratacao).not.toBeNull();

    // 3. Primeira conversão em Venda
    const res1 = await converterContratacaoEmVenda(GAUCHINHO_EMPRESA_ID, contratacao!.id);
    expect(res1.venda).toBeDefined();
    expect(res1.venda.cliente_nome).toBe("Cliente Teste Idempotência");
    expect(res1.cotaDefinitiva).toBeDefined();
    expect(res1.cotaDefinitiva.numero_grupo).toBe(grupo!.codigo_grupo);

    // 4. Segunda conversão (Double Click Simulation): DEVE RETORNAR A MESMA VENDA SEM DUPLICAR
    const res2 = await converterContratacaoEmVenda(GAUCHINHO_EMPRESA_ID, contratacao!.id);
    expect(res2.venda.id).toBe(res1.venda.id);
    expect(res2.cotaDefinitiva.id).toBe(res1.cotaDefinitiva.id);

    // 5. Cleanup da contratação e venda de teste
    await admin.from("cotas_definitivas").delete().eq("id", res1.cotaDefinitiva.id);
    await admin.from("vendas").delete().eq("id", res1.venda.id);
    await admin.from("contratacoes_online").delete().eq("id", contratacao!.id);
  });

  it("3. Bloqueia conversão de contratação pertencente a outro tenant (Cross-tenant Isolation)", async () => {
    const admin = createAdminClient();

    const { data: grupo } = await admin.from("grupos_consorcio").select("id").limit(1).single();
    expect(grupo).not.toBeNull();

    const token = `test-token-cross-${Date.now()}`;
    const protocolo = `PROT-CROSS-${Date.now()}`;

    const { data: contratacao, error: errContr } = await admin
      .from("contratacoes_online")
      .insert({
        empresa_id: GAUCHINHO_EMPRESA_ID,
        public_token: token,
        protocolo: protocolo,
        origem: "grupos",
        nome: "Cliente Cross Tenant Test",
        grupo_id: grupo!.id,
        status: "link_gerado",
      })
      .select("*")
      .single();

    expect(errContr).toBeNull();
    expect(contratacao).not.toBeNull();

    // Tentar converter informando EMPRESA_B_ID deve LANÇAR ERRO DE ACESSO NEGADO
    await expect(converterContratacaoEmVenda(EMPRESA_B_ID, contratacao!.id)).rejects.toThrow(
      "Acesso negado: a contratação pertence a outro tenant.",
    );

    // Cleanup
    await admin.from("contratacoes_online").delete().eq("id", contratacao!.id);
  });
});
