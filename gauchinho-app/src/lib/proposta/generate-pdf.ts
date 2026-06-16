import "server-only";
import { renderPropostaPdfBuffer } from "@/lib/proposta/pdf/proposta-pdf-document";
import { buildPropostaPdfData } from "@/lib/proposta/load-pdf-data";
import { createPropostaPdfSignedUrl, tryUploadPropostaPdf } from "@/lib/proposta/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import { gerarProjecaoAnoAno } from "@/lib/simulador/projecao";
import type { EntradaConsorcio } from "@/lib/simulador/consorcio";

export type GeneratePdfOverrides = {
  consultor_nome?: string;
  consultor_telefone?: string;
  consultor_email?: string;
  parceiro_nome?: string;
  validade_dias?: number;
  validade_data?: string;
  origem?: string;
  pagina?: string;
  usuario_id?: string;
};

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
  const { data: p } = await admin.from("propostas").select("pdf_url").eq("id", propostaId).single();
  if (!p?.pdf_url) throw new Error("PDF ainda não gerado");
  return createPropostaPdfSignedUrl(p.pdf_url);
}
