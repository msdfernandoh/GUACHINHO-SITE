import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calcularHashSnapshotGrupos, assertSnapshotCalculoGruposIntegro } from "@/lib/contratacoes-online/snapshot-calculo-grupos";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("ERP Contratações — Detalhes da Operação & Ajuste Comercial / Promoção (Fase 232)", () => {
  const form = read("gauchinho-app/src/components/erp/contratacoes/formalizacao-venda-form.tsx");
  const actions = read("gauchinho-app/src/app/erp/contratacoes/actions.ts");
  const detailPage = read("gauchinho-app/src/app/erp/contratacoes/[id]/page.tsx");
  const loadPdf = read("gauchinho-app/src/lib/proposta/load-pdf-data.ts");
  const pdfDoc = read("gauchinho-app/src/lib/proposta/pdf/proposta-pdf-document.tsx");

  it("exibe detalhes operacionais de seguro, taxa contratada, fundo de reserva e parcela no formulário", () => {
    expect(form).toContain("Seguro Prestamista");
    expect(form).toContain("Taxa de Adm.");
    expect(form).toContain("Fundo de Reserva");
    expect(form).toContain("Valor da Parcela");
    expect(form).toContain("taxa_administrativa_percentual");
    expect(form).toContain("fundo_reserva_percentual");
  });

  it("permite ajuste comercial/promocional de taxa e parcela antes da conclusão da venda", () => {
    expect(form).toContain("Aplicar Ajuste Comercial / Promoção de Fechamento");
    expect(form).toContain("taxa_administracao_ajustada");
    expect(form).toContain("valor_parcela_ajustado");
    expect(form).toContain("motivo_ajuste_promocional");
    expect(form).toContain("Ajuste Promocional Aplicado");
  });

  it("actions.ts processa ajuste promocional, atualiza snapshot e preserva hash criptográfico", () => {
    expect(actions).toContain("taxaAjustadaRaw");
    expect(actions).toContain("parcelaAjustadaRaw");
    expect(actions).toContain("motivo_ajuste_promocional");
    expect(actions).toContain("AJUSTE_PROMOCIONAL_APLICADO");
    expect(actions).toContain("calcularHashSnapshotGrupos");
  });

  it("recalculo de hash criptográfico valida integridade com assertSnapshotCalculoGruposIntegro", () => {
    const dadosOriginais: Record<string, unknown> = {
      valor_credito: 100000,
      valor_parcela: 1000,
      prazo: 120,
      selecoes: [{ grupoId: "g1", cotaId: "c1", resultado: { primeiraParcela: 1000 } }],
      totais: { somaCotas: 100000, primeiraParcela: 1000 },
    };
    const hashOriginal = calcularHashSnapshotGrupos(dadosOriginais);
    dadosOriginais.snapshot_calculo = {
      versao_motor: "grupos-site-v1",
      hash_sha256: hashOriginal,
      gerado_em: new Date().toISOString(),
      origem: "SITE",
      imutavel: true,
    };

    // Valid original
    expect(() => assertSnapshotCalculoGruposIntegro(dadosOriginais)).not.toThrow();

    // After promo adjustment
    const dadosAjustados = {
      ...dadosOriginais,
      valor_parcela: 850,
      primeiraParcelaTotal: 850,
      totais: { somaCotas: 100000, primeiraParcela: 850 },
    };
    const novoHash = calcularHashSnapshotGrupos(dadosAjustados);
    dadosAjustados.snapshot_calculo = {
      versao_motor: "grupos-site-v1",
      hash_sha256: novoHash,
      gerado_em: new Date().toISOString(),
      origem: "SITE",
      imutavel: true,
    };

    // Valid adjusted with recomputed hash
    expect(() => assertSnapshotCalculoGruposIntegro(dadosAjustados)).not.toThrow();
  });

  it("PDF da proposta utiliza sempre o modelo moderno oficial de capa + 3 folhas", () => {
    expect(loadPdf).toContain("segmentos");
    expect(loadPdf).toContain("construirSegmentos");
    expect(pdfDoc).toContain("fallbackSegmentoFromData");
    expect(pdfDoc).toContain("FolhaResumo");
    expect(pdfDoc).toContain("FolhaEncerramento");
  });
});
