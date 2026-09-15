import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const action = readFileSync("src/app/erp/contratacoes/actions.ts", "utf8");
const detalhe = readFileSync("src/app/erp/contratacoes/[id]/page.tsx", "utf8");
const lista = readFileSync("src/app/erp/contratacoes/page.tsx", "utf8");
const formulario = readFileSync("src/components/erp/contratacoes/formalizacao-venda-form.tsx", "utf8");
const botao = readFileSync("src/components/erp/contratacoes/marcar-contrato-assinado-button.tsx", "utf8");

describe("FASE-231 — Marcar Contrato como Assinado no ERP", () => {
  it("exporta e implementa alternarContratoAssinadoAction com tenant e auditoria", () => {
    expect(action).toContain("export async function alternarContratoAssinadoAction");
    expect(action).toContain('requireCurrentTenantContext()');
    expect(action).toContain('.eq("empresa_id", context.empresaAtiva.id)');
    expect(action).toContain("contratacoes_formalizacao_historico");
    expect(action).toContain("CONTRATO_ASSINADO");
    expect(action).toContain("CONTRATO_NAO_ASSINADO");
    expect(action).toContain("revalidatePath");
  });

  it("impede desmarcar assinatura de contratações já formalizadas", () => {
    expect(action).toContain("Não é possível desmarcar assinatura de uma contratação já formalizada");
  });

  it("disponibiliza botão de ação no cabeçalho e banner de aviso no detalhe", () => {
    expect(detalhe).toContain("MarcarContratoAssinadoButton");
    expect(detalhe).toContain('variant="hero"');
    expect(detalhe).toContain('variant="banner"');
    expect(detalhe).toContain("Contrato aguardando assinatura");
  });

  it("bloqueia formalização no formulário se contrato não estiver assinado e exibe ação inline", () => {
    expect(formulario).toContain("contratoAssinado");
    expect(formulario).toContain("O contrato precisa ser marcado como assinado antes de formalizar a venda");
    expect(formulario).toContain("MarcarContratoAssinadoButton");
    expect(formulario).toContain('variant="inline"');
    expect(formulario).toContain("Aguardando assinatura do contrato");
  });

  it("adiciona botão rápido na tabela da lista de contratações", () => {
    expect(lista).toContain("MarcarContratoAssinadoButton");
    expect(lista).toContain('variant="table"');
  });

  it("componente MarcarContratoAssinadoButton gerencia loading, transição e confirmação", () => {
    expect(botao).toContain("alternarContratoAssinadoAction");
    expect(botao).toContain("useTransition");
    expect(botao).toContain("router.refresh()");
    expect(botao).toContain("Marcar como assinada");
    expect(botao).toContain("Desmarcar assinatura");
  });
});
