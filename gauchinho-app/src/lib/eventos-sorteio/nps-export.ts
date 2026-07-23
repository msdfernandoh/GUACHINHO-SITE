import { formatBRL } from "@/lib/formatters/money";
import { formatWhatsappBrInput } from "@/lib/utils/format";
import type { NpsDashboardData, NpsExportColumn, NpsIndicacaoRow, NpsRespostaRow } from "./nps-dashboard";
import type { NpsTipo } from "./nps";

function escapeSemicolonField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function formatNpsRespostaExport(tipo: NpsTipo, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (tipo === "escala_0_10") {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isInteger(n) && n >= 0 && n <= 10 ? String(n) : "";
  }
  if (tipo === "sim_nao") {
    if (value === true || value === "sim" || value === "true") return "Sim";
    if (value === false || value === "nao" || value === "não" || value === "false") return "Não";
    return "";
  }
  return typeof value === "string" ? value.trim() : String(value);
}

export function buildNpsExportHeaders(perguntas: NpsExportColumn[]): string[] {
  return [
    "Nome",
    "Telefone",
    "Valor disponível para investimento",
    "Código",
    "Data resposta NPS",
    ...perguntas.map((p) => p.titulo),
  ];
}

export function buildNpsExportRow(
  resposta: NpsRespostaRow,
  perguntas: NpsExportColumn[],
): string[] {
  const r = resposta.respostas ?? {};
  return [
    resposta.nome,
    formatWhatsappBrInput(resposta.telefone),
    resposta.valorMensalDisponivel != null ? formatBRL(resposta.valorMensalDisponivel) : "",
    resposta.codigo,
    resposta.npsCompletoEm
      ? new Date(resposta.npsCompletoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "",
    ...perguntas.map((p) => formatNpsRespostaExport(p.tipo, r[p.chave])),
  ];
}

export function buildIndicacoesExportHeaders(): string[] {
  return [
    "Data",
    "Nome indicado",
    "Tipo",
    "Telefone indicado",
    "Quem indicou",
    "Telefone quem indicou",
    "Cupom gerado",
  ];
}

export function buildIndicacaoExportRow(indicacao: NpsIndicacaoRow): string[] {
  return [
    new Date(indicacao.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    indicacao.nome,
    indicacao.tipo,
    formatWhatsappBrInput(indicacao.telefone),
    indicacao.indicadorNome,
    formatWhatsappBrInput(indicacao.indicadorTelefone),
    indicacao.cupomGerado ? "Sim" : "Não",
  ];
}

export function npsDashboardToSemicolonTable(data: NpsDashboardData): string {
  const lines: string[] = [];

  lines.push("Respostas NPS");
  const npsHeaders = buildNpsExportHeaders(data.perguntasColunas);
  lines.push(npsHeaders.map(escapeSemicolonField).join(";"));
  for (const row of data.respostas) {
    lines.push(buildNpsExportRow(row, data.perguntasColunas).map(escapeSemicolonField).join(";"));
  }

  lines.push("");
  lines.push("Indicações");
  const indHeaders = buildIndicacoesExportHeaders();
  lines.push(indHeaders.map(escapeSemicolonField).join(";"));
  for (const ind of data.indicacoes) {
    lines.push(buildIndicacaoExportRow(ind).map(escapeSemicolonField).join(";"));
  }

  return lines.join("\n");
}

export function npsDashboardToXlsBytes(data: NpsDashboardData): Uint8Array {
  const bom = "\uFEFF";
  const body = npsDashboardToSemicolonTable(data);
  return new TextEncoder().encode(bom + body);
}
