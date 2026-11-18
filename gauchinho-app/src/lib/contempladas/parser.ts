import { parseCartaWhatsAppText, separarMensagensWhatsApp } from "@/lib/cartas/parser";
import { parseBrazilianNumber } from "@/lib/utils/format";
import type { Acrescimo } from "./motor";
import { valorAcrescimo } from "./motor";

export type CotaLida = {
  administradora: string;
  tipo: "imovel" | "automovel";
  credito: number;
  entrada_original: number;
  entrada_acrescimo: number;
  entrada: number;
  prazo: number;
  parcela: number;
  saldo_devedor: number;
  vencimento_mes: number | null;
  comissao_parceiro: number;
  texto_original: string;
};

export type LinhaLida = { cota: CotaLida | null; erro: string | null; texto: string };

const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function mesDoTexto(t: string): number | null {
  const n = sem(t);
  const i = MESES.findIndex((m) => new RegExp(`\\b${m}\\b|\\b${m.slice(0, 3)}\\b`).test(n));
  return i >= 0 ? i + 1 : null;
}

const TIPO_AUTO = /autom[oó]vel|ve[ií]culo|\bauto\b|caminh[aã]o|pesado/i;

/**
 * Linha copiada da planilha: ADM TIPO CRÉDITO ENTRADA PRAZO PARCELA SALDO VENCIMENTO COMISSÃO.
 * Ex.: "racon IMÓVEL R$ 311.000,00 R$ 195.300,00 113 R$ 2.002,26 R$ 226.255,38 dezembro R$ 5.000,00"
 */
function lerLinhaTabela(linha: string): Omit<CotaLida, "entrada_acrescimo" | "entrada"> | null {
  const nums = (linha.match(/\d[\d.]*(?:,\d{1,2})?/g) ?? []).map(parseBrazilianNumber);
  if (nums.length < 6) return null;
  const [credito, entrada, prazo, parcela, saldo, comissao = 0] = nums;
  if (!(credito > 0) || !Number.isInteger(prazo) || prazo <= 0 || prazo > 400) return null;
  const adm = (linha.trim().split(/[\s\t;|]+/)[0] ?? "racon").toLowerCase();
  return {
    administradora: /^[a-z]+$/i.test(adm) ? adm : "racon",
    tipo: TIPO_AUTO.test(linha) ? "automovel" : "imovel",
    credito,
    entrada_original: entrada,
    prazo,
    parcela,
    saldo_devedor: saldo,
    vencimento_mes: mesDoTexto(linha),
    comissao_parceiro: comissao,
    texto_original: linha.trim(),
  };
}

function lerBlocoWhatsApp(bloco: string): Omit<CotaLida, "entrada_acrescimo" | "entrada"> | null {
  const p = parseCartaWhatsAppText(bloco);
  if (!p.credito || !p.entrada || !p.prazo_quantidade) return null;
  const linhaCom = bloco.split(/\r?\n/).find((l) => /comiss/i.test(l)) ?? "";
  const com = linhaCom.match(/\d[\d.]*(?:,\d{1,2})?/);
  const linhaVenc = bloco.split(/\r?\n/).find((l) => /venc/i.test(l)) ?? "";
  return {
    administradora: (p.administradora ?? "racon").toLowerCase(),
    tipo: p.tipo_carta === "automovel" ? "automovel" : "imovel",
    credito: p.credito,
    entrada_original: p.entrada,
    prazo: p.prazo_quantidade,
    parcela: p.valor_parcela ?? 0,
    saldo_devedor: p.saldo_devedor ?? 0,
    vencimento_mes: p.proxima_parcela_data ? Number(p.proxima_parcela_data.slice(5, 7)) : mesDoTexto(linhaVenc),
    comissao_parceiro: com ? parseBrazilianNumber(com[0]) : 0,
    texto_original: bloco.trim(),
  };
}

const VALOR = String.raw`R?\$?\s*(\d[\d.]*(?:,\d{1,2})?)`;
function campo(bloco: string, rotulo: string): number | null {
  const m = bloco.match(new RegExp(rotulo + String.raw`[^:\n]*:\s*` + VALOR, "i"));
  return m ? parseBrazilianNumber(m[1]) : null;
}

/**
 * Formato da lista do WhatsApp com rótulos, uma carta por bloco:
 * "🏠 CARTA 01 / 💰 Crédito: R$ … / 💵 Entrada: … / 📆 Prazo: 113 parcelas / 💳 Parcela: … /
 *  📊 Saldo devedor: … / 🗓 Vencimento: Dezembro / 🤝 Comissão parceiro: …"
 */
function lerBlocosRotulados(texto: string): LinhaLida[] | null {
  if (!/cr[eé]dito\s*:/i.test(texto) || !/entrada\s*:/i.test(texto)) return null;
  const cabecalho = texto.split(/cr[eé]dito\s*:/i)[0];
  const tipoGeral = TIPO_AUTO.test(cabecalho) ? "automovel" : "imovel";
  const admGeral = /racon/i.test(cabecalho) ? "racon" : (cabecalho.match(/\b([A-Za-zÀ-ú]+)\s+CONS[OÓ]RCIO/i)?.[1] ?? "racon").toLowerCase();
  // Cada bloco começa no "Crédito:" (ou no título "CARTA nn" logo antes).
  const partes = texto.split(/\n(?=[^\n]*(?:\bCARTA\s*\d+|COTA\s*\d+)[^\n]*\n)|━{3,}|-{5,}|_{5,}/i).filter((b) => /cr[eé]dito\s*:/i.test(b));
  return partes.map((b) => {
    const credito = campo(b, "cr[eé]dito");
    const entrada = campo(b, "entrada");
    const prazo = campo(b, "prazo");
    const linhaVenc = b.split(/\r?\n/).find((l) => /venc/i.test(l)) ?? "";
    const tipo = TIPO_AUTO.test(b) || b.includes("🚗") ? "automovel" : tipoGeral;
    if (!credito || entrada == null || !prazo) return { cota: null, erro: "Crédito, entrada ou prazo não encontrado.", texto: b.trim() };
    return {
      cota: {
        administradora: admGeral,
        tipo,
        credito,
        entrada_original: entrada,
        prazo: Math.round(prazo),
        parcela: campo(b, "parcela") ?? 0,
        saldo_devedor: campo(b, "saldo") ?? 0,
        vencimento_mes: mesDoTexto(linhaVenc),
        comissao_parceiro: campo(b, "comiss") ?? 0,
        texto_original: b.trim(),
      } as CotaLida,
      erro: null,
      texto: b.trim(),
    };
  });
}

/**
 * Lê o texto colado (linhas da planilha ou mensagens do WhatsApp) e aplica o
 * acréscimo de entrada (percentual do crédito ou valor fixo) em cada cota.
 */
export function lerCotasTexto(texto: string, acrescimo: Acrescimo | ((tipo: "imovel" | "automovel") => Acrescimo)): LinhaLida[] {
  const agioDe = typeof acrescimo === "function" ? acrescimo : () => acrescimo;
  const rotulados = lerBlocosRotulados(texto);
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tabela = linhas.map((l) => ({ l, c: lerLinhaTabela(l) }));
  const pareceTabela = tabela.filter((x) => x.c).length >= Math.max(1, Math.ceil(linhas.length / 3));

  const brutas: LinhaLida[] = rotulados
    ? rotulados
    : pareceTabela
    ? tabela
        .filter((x) => /\d/.test(x.l) && !/cr[eé]dito\s+entrada/i.test(x.l))
        .map((x) => ({ cota: x.c as CotaLida | null, erro: x.c ? null : "Linha sem os valores esperados.", texto: x.l }))
    : separarMensagensWhatsApp(texto).map((b) => {
        const c = lerBlocoWhatsApp(b);
        return { cota: c as CotaLida | null, erro: c ? null : "Crédito, entrada ou prazo não encontrado.", texto: b };
      });

  return brutas.map((x) => {
    if (!x.cota) return x;
    const extra = valorAcrescimo(x.cota.credito, agioDe(x.cota.tipo));
    return {
      ...x,
      cota: { ...x.cota, entrada_acrescimo: extra, entrada: Math.round((x.cota.entrada_original + extra) * 100) / 100 },
    };
  });
}
