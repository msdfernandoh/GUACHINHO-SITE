import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("Aba Controle de Boletos em Vendas & Cotas", () => {
  const vendasView = read("src/components/erp/vendas/erp-vendas-hub-view.tsx");
  const actions = read("src/app/erp/vendas/actions.ts");
  const migration = read("../supabase/migrations/301_vendas_boletos_envios.sql");

  it("oferece seletor de abas entre Vendas & Cotas e Controle de Boletos", () => {
    expect(vendasView).toContain('setAbaAtiva("vendas")');
    expect(vendasView).toContain('setAbaAtiva("boletos")');
    expect(vendasView).toContain("Controle de Boletos");
  });

  it("possui filtros por status de boleto (aguardando, baixado, enviado) e os mesmos filtros operacionais", () => {
    expect(vendasView).toContain("filtroStatusBoleto");
    expect(vendasView).toContain("Aguardando Baixa");
    expect(vendasView).toContain("Baixado (Aguardando Envio)");
    expect(vendasView).toContain("Boleto Enviado");
  });

  it("disponibiliza botões de ação com 1 clique (Baixar, Enviar, WhatsApp, Histórico)", () => {
    expect(vendasView).toContain('handleRegistrarBoleto(v.id, cota?.id || null, competenciaBoletoAtual, "BAIXAR")');
    expect(vendasView).toContain('handleRegistrarBoleto(v.id, cota?.id || null, competenciaBoletoAtual, "ENVIAR")');
    expect(vendasView).toContain("gerarLinkWhatsAppBoleto");
    expect(vendasView).toContain("setCotaHistoricoBoleto");
  });

  it("possui modal de histórico geral de boletos por cota", () => {
    expect(vendasView).toContain("Histórico Geral de Boletos");
    expect(vendasView).toContain("formatarDataHoraBR");
  });

  it("exporta server action registrarStatusBoletoAction e migration 301 com schema multiempresa", () => {
    expect(actions).toContain("export async function registrarStatusBoletoAction");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.vendas_boletos_envios");
    expect(migration).toContain("status_boleto TEXT NOT NULL DEFAULT 'enviado'");
    expect(migration).toContain("baixado_em TIMESTAMPTZ");
    expect(migration).toContain("enviado_em TIMESTAMPTZ");
  });
});
