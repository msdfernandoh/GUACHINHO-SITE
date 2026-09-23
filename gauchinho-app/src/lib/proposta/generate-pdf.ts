import "server-only";
import { renderPropostaPdfBuffer } from "@/lib/proposta/pdf/proposta-pdf-document";
import { buildPropostaPdfData } from "@/lib/proposta/load-pdf-data";
import {
  createPropostaPdfSignedUrl,
  PROPOSTAS_PDF_BUCKET,
  tryUploadPropostaPdf,
  uploadPropostaPdfAtPath,
} from "@/lib/proposta/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import { gerarProjecaoAnoAno } from "@/lib/simulador/projecao";
import type { EntradaConsorcio } from "@/lib/simulador/consorcio";
import type { GrupoPdfBlock, PropostaPdfData, SegmentoPdf } from "@/lib/proposta/pdf/types";
import { randomUUID } from "node:crypto";

export type GeneratePdfOverrides = {
  consultor_nome?: string;
  consultor_telefone?: string;
  consultor_email?: string;
  parceiro_nome?: string;
  validade_dias?: number;
  validade_data?: string;
  observacao?: string;
  origem?: string;
  pagina?: string;
  usuario_id?: string;
  visualizacao?: "completa" | "resumida";
};

function totaisDosGrupos(grupos: GrupoPdfBlock[]): SegmentoPdf["totais"] {
  return grupos.reduce(
    (totais, grupo) => ({
      credito: totais.credito + grupo.credito,
      primeiraParcela: totais.primeiraParcela + grupo.primeiraParcela,
      lanceEmbutido: totais.lanceEmbutido + grupo.lanceEmbutido,
      recursoProprio: totais.recursoProprio + grupo.recursoProprio,
      lanceTotal: totais.lanceTotal + grupo.lanceTotal,
      creditoLiquido: totais.creditoLiquido + grupo.creditoLiquido,
      parcelaPosContemplacao: totais.parcelaPosContemplacao + grupo.parcelaPosContemplacao,
    }),
    { credito: 0, primeiraParcela: 0, lanceEmbutido: 0, recursoProprio: 0, lanceTotal: 0, creditoLiquido: 0, parcelaPosContemplacao: 0 },
  );
}

function dadosPdfDeGrupo(data: PropostaPdfData, segmentoOriginal: SegmentoPdf, codigoGrupo: string): PropostaPdfData {
  // Duas ou mais cotas do mesmo grupo continuam no mesmo arquivo independente.
  const grupos = segmentoOriginal.grupos.filter((grupo) => grupo.codigoGrupo === codigoGrupo);
  const totais = totaisDosGrupos(grupos);
  const segmento: SegmentoPdf = { ...segmentoOriginal, grupos, totais };
  const totalCotas = grupos.reduce((total, grupo) => total + grupo.quantidadeCotas, 0);

  return {
    ...data,
    tipoProposta: `${segmento.label} · Grupo ${codigoGrupo}`,
    tipoBem: segmento.label,
    resumo: {
      valorCredito: totais.credito,
      prazo: grupos[0]?.prazoTotal ?? data.resumo.prazo,
      parcela: totais.primeiraParcela,
      entrada: totais.recursoProprio,
      lanceEmbutido: totais.lanceEmbutido,
      valorTotal: grupos.reduce((total, grupo) => total + grupo.saldoDevedor, 0),
      creditoLiquido: totais.creditoLiquido,
    },
    gruposCotas: data.gruposCotas.filter((grupo) => grupo.codigoGrupo === codigoGrupo),
    gruposTotais: {
      creditoTotal: totais.credito,
      lanceTotal: totais.lanceTotal,
      lanceEmbutido: totais.lanceEmbutido,
      recursoProprio: totais.recursoProprio,
      primeiraParcela: totais.primeiraParcela,
      creditoLiquido: totais.creditoLiquido,
    },
    segmentos: [segmento],
    consolidado: {
      totalGrupos: 1,
      totalCotas,
      credito: totais.credito,
      primeiraParcela: totais.primeiraParcela,
      lanceEmbutido: totais.lanceEmbutido,
      recursoProprio: totais.recursoProprio,
      lanceTotal: totais.lanceTotal,
      creditoLiquido: totais.creditoLiquido,
      parcelaPosContemplacaoMedia: totais.parcelaPosContemplacao,
    },
    modoAgrupamentoGrupos: "unificado",
    visualizacao: "completa",
  };
}

function slugArquivo(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "grupo";
}

/**
 * Emite um PDF completo por grupo. Cotas do mesmo grupo permanecem reunidas
 * no mesmo arquivo, mas nunca mistura prazo ou condição entre grupos distintos.
 */
export async function generateAndStorePropostaPdfsIndependentes(
  propostaId: string,
  overrides?: GeneratePdfOverrides,
) {
  const data = await buildPropostaPdfData(propostaId, overrides);
  const arquivosBase = data.segmentos.flatMap((segmento) =>
    [...new Set(segmento.grupos.map((grupo) => grupo.codigoGrupo))].map((codigoGrupo) => ({ segmento, codigoGrupo })),
  );
  if (arquivosBase.length < 2) throw new Error("São necessários ao menos dois grupos para gerar arquivos independentes.");

  const admin = createAdminClient();
  const { data: proposta, error: propostaError } = await admin
    .from("propostas")
    .select("empresa_id")
    .eq("id", propostaId)
    .single();
  if (propostaError || !proposta?.empresa_id) throw new Error(propostaError?.message ?? "Proposta não encontrada.");
  const lote = randomUUID();
  const arquivos = [] as Array<{ arquivoNome: string; storagePath: string; signedUrl: string | null }>;

  for (const [indice, item] of arquivosBase.entries()) {
    const arquivoNome = `proposta-${slugArquivo(item.codigoGrupo)}.pdf`;
    const storagePath = `${propostaId}/independentes/${lote}-${String(indice + 1).padStart(2, "0")}-${slugArquivo(item.codigoGrupo)}.pdf`;
    const buffer = await renderPropostaPdfBuffer(dadosPdfDeGrupo(data, item.segmento, item.codigoGrupo));
    await uploadPropostaPdfAtPath(storagePath, Buffer.from(buffer));

    const { error: metadataError } = await admin.from("propostas_arquivos").insert({
      empresa_id: proposta.empresa_id,
      proposta_id: propostaId,
      categoria: "pdf_gerado",
      storage_path: storagePath,
      arquivo_nome: arquivoNome,
      mime_type: "application/pdf",
      tamanho_bytes: buffer.length,
    });
    if (metadataError) {
      await admin.storage.from(PROPOSTAS_PDF_BUCKET).remove([storagePath]);
      throw new Error(`Não foi possível registrar o PDF independente: ${metadataError.message}`);
    }

    let signedUrl: string | null = null;
    try { signedUrl = await createPropostaPdfSignedUrl(storagePath); } catch { signedUrl = null; }
    arquivos.push({ arquivoNome, storagePath, signedUrl });
  }

  await admin.from("propostas").update({ pdf_url: arquivos[0]?.storagePath ?? null, status: "PDF gerado" }).eq("id", propostaId);
  await registrarEvento({
    tipo_evento: "proposta_pdf_gerada",
    origem: overrides?.origem ?? "admin",
    pagina: overrides?.pagina,
    entidade_tipo: "proposta",
    entidade_id: propostaId,
    usuario_id: overrides?.usuario_id,
    dados_evento: { modo: "independentes", arquivos: arquivos.length },
  });
  return { arquivos };
}

export async function generateAndStorePropostaPdf(
  propostaId: string,
  overrides?: GeneratePdfOverrides,
) {
  const pdfData = await buildPropostaPdfData(propostaId, overrides);
  const buffer = await renderPropostaPdfBuffer(pdfData);

  const storagePath = await tryUploadPropostaPdf(propostaId, Buffer.from(buffer));

  const admin = createAdminClient();
  const updatePayload: Record<string, unknown> = {
    pdf_url: storagePath,
    status: "PDF gerado",
  };
  if (overrides?.consultor_nome) updatePayload.consultor_nome = overrides.consultor_nome;
  if (overrides?.consultor_telefone) updatePayload.consultor_telefone = overrides.consultor_telefone;
  if (overrides?.consultor_email) updatePayload.consultor_email = overrides.consultor_email;
  if (overrides?.parceiro_nome) updatePayload.parceiro_nome = overrides.parceiro_nome;
  if (overrides?.observacao) updatePayload.observacoes = overrides.observacao;
  if (overrides?.consultor_nome) {
    updatePayload.contato_exibido_tipo = "consultor";
  }

  await admin.from("propostas").update(updatePayload).eq("id", propostaId);

  let signedUrl: string | null = null;
  try {
    signedUrl = await createPropostaPdfSignedUrl(storagePath);
  } catch {
    signedUrl = null;
  }

  await registrarEvento({
    tipo_evento: "proposta_pdf_gerada",
    origem: overrides?.origem ?? "admin",
    pagina: overrides?.pagina,
    entidade_tipo: "proposta",
    entidade_id: propostaId,

    usuario_id: overrides?.usuario_id,
  });

  return { storagePath, signedUrl };
}

/** Persiste resumo de projeção na proposta (consórcio) antes do PDF. */
export async function enrichPropostaProjecaoFromSimulacao(propostaId: string) {
  const admin = createAdminClient();
  const { data: p } = await admin.from("propostas").select("*").eq("id", propostaId).single();
  if (!p) return;
  const ds = (p.dados_simulacao ?? {}) as Record<string, unknown>;
  const entradaRaw = (ds.entrada ?? ds) as Record<string, unknown>;
  if (!entradaRaw?.valorCredito || !entradaRaw?.prazoMeses) return;
  const linhas = gerarProjecaoAnoAno({
    valorCredito: Number(entradaRaw.valorCredito),
    prazoMeses: Number(entradaRaw.prazoMeses),
    taxaAdministrativaPercentual: Number(entradaRaw.taxaAdministrativaPercentual ?? 20),
    fundoReservaPercentual: Number(entradaRaw.fundoReservaPercentual ?? 2),
    seguroPrestamistaPercentual: Number(entradaRaw.seguroPrestamistaPercentual ?? 0),
    entrada: Number(entradaRaw.entrada ?? 0),
    lanceEmbutido: Number(entradaRaw.lanceEmbutido ?? 0),
    reajusteAnualCredito: Number(entradaRaw.reajusteAnualCredito ?? 8),
    correcaoAnualParcela: Number(entradaRaw.correcaoAnualParcela ?? 8),
    percentualParcelaInicial: Number(entradaRaw.percentualParcelaInicial ?? 100),
  });
  const prazo = Number(entradaRaw.prazoMeses);
  const anos = Math.ceil(prazo / 12);
  const marcos = [1, 3, 5, 10].filter((a) => a <= anos);
  if (!marcos.includes(anos)) marcos.push(anos);
  const pick = marcos
    .map((a) => linhas.find((l) => l.ano === a))
    .filter(Boolean)
    .map((l) => ({
      periodo: `${l!.ano} ${l!.ano === 1 ? "ano" : "anos"}`,
      totalPago: l!.totalPagoAcumulado,
      creditoReajustado: l!.creditoEstimadoReajustado,
      valorizacao: l!.valorizacaoAcumuladaCredito,
      ganhoPatrimonial: l!.ganhoPatrimonialEstimado,
    }));
  await admin.from("propostas").update({ resumo_projecao: pick }).eq("id", propostaId);
}

export async function getPropostaPdfDownloadUrl(propostaId: string) {
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("propostas")
    .select("pdf_url,dados_simulacao")
    .eq("id", propostaId)
    .single();
  const dadosSimulacao = (p?.dados_simulacao ?? {}) as Record<string, unknown>;
  const dependeDeGrupoVigente = Boolean(dadosSimulacao.simulacao_grupo_id);

  // Propostas de grupos usam o catálogo vigente até a formalização. Não devolver
  // um arquivo em cache quando taxa, fundo ou seguro do grupo puderam mudar.
  if (p?.pdf_url && !dependeDeGrupoVigente) {
    try {
      return await createPropostaPdfSignedUrl(p.pdf_url);
    } catch {
      // Arquivo pode ter sido expirado ou removido do storage; prosseguir com nova geração sob demanda.
    }
  }

  try {
    await enrichPropostaProjecaoFromSimulacao(propostaId);
    const generated = await generateAndStorePropostaPdf(propostaId, { origem: "download_direto" });
    if (generated.signedUrl) return generated.signedUrl;
    if (generated.storagePath) return await createPropostaPdfSignedUrl(generated.storagePath);
  } catch (err) {
    console.error("[getPropostaPdfDownloadUrl] Erro ao gerar PDF sob demanda:", err);
    throw new Error("Não foi possível gerar o PDF da proposta no momento.");
  }

  throw new Error("Não foi possível obter a URL de download do PDF.");
}
