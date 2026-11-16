import { parseBrazilianNumber } from "@/lib/utils/format";
import type { CartaTipo, ParsedCartaWhatsApp } from "./types";

function moneyFromLine(line: string): number | null {
  const m = line.match(/(?:R\$\s*)?(\d[\d.]*(?:,\d{1,2})?)/i);
  if (!m) return null;
  const n = parseBrazilianNumber(m[1]);
  return n > 0 ? n : null;
}

function parseBrDate(raw: string): string | null {
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

/** "Vencimento 10/12" (dia/mês, sem ano) → próxima ocorrência a partir de hoje. */
function parseDiaMesSemAno(raw: string, hoje: Date): string | null {
  const m = raw.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?!\s*\/\s*\d)/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  const base = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
  let ano = base.getUTCFullYear();
  if (Date.UTC(ano, mes - 1, dia) < base.getTime()) ano += 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const TIPO_IMOVEL = /IM[OÓ]VE(L|IS)/i;
const TIPO_AUTO = /AUTOM[OÓ]VEL|AUTOMOVEL|\bAUTO\b|VE[IÍ]CULO|CARRO|CAMINH[AÃ]O|PESADO/i;

function detectTipo(texto: string): CartaTipo | null {
  for (const line of texto.split(/\r?\n/)) {
    if (TIPO_IMOVEL.test(line)) return "imovel";
    if (TIPO_AUTO.test(line)) return "automovel";
  }
  return null;
}

const ADMINISTRADORAS_CONHECIDAS = [
  "RACON", "EMBRACON", "RODOBENS", "PORTO", "SANTANDER", "BRADESCO", "ITAU", "ITAÚ",
  "CAIXA", "CANOPUS", "MAGALU", "SICREDI", "SICOOB", "ANCORA", "ÂNCORA", "SERVOPA", "YAMAHA",
];

function detectAdministradora(texto: string, tipo: CartaTipo | null): string | null {
  const upper = texto.toUpperCase();
  for (const nome of ADMINISTRADORAS_CONHECIDAS) {
    if (new RegExp(`(^|[^A-ZÀ-Ú])${nome}([^A-ZÀ-Ú]|$)`).test(upper)) {
      return nome === "ITAÚ" ? "ITAU" : nome === "ÂNCORA" ? "ANCORA" : nome;
    }
  }
  // Fallback legado: palavra após "carta contemplada <tipo>" na linha do tipo.
  const linhaTipo = texto.split(/\r?\n/).find((l) => TIPO_IMOVEL.test(l) || TIPO_AUTO.test(l)) ?? "";
  const words = linhaTipo.replace(/[^\w\sÀ-ú]/gi, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const idx = words.findIndex((w) =>
    tipo === "imovel" ? TIPO_IMOVEL.test(w) : TIPO_AUTO.test(w),
  );
  return idx >= 0 ? words[idx + 1] ?? null : null;
}

/** Linhas sem cabeçalho do WhatsApp ("[10:41, 13/11/2026] +55 ...: "). */
function limparLinhas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?,\s*\d{1,2}\/\d{1,2}\/\d{2,4}\]\s*[^:]*:\s*/, ""))
    .map((l) => l.replace(/\*/g, "").trim())
    .filter(Boolean);
}

/** Organiza texto colado do WhatsApp em campos de carta (sem inventar valores). */
export function parseCartaWhatsAppText(texto: string, hoje: Date = new Date()): ParsedCartaWhatsApp {
  const texto_original = texto;
  const lines = limparLinhas(texto);
  const corpo = lines.join("\n");
  const tipo_carta = detectTipo(corpo);
  const administradora = detectAdministradora(corpo, tipo_carta);

  let credito: number | null = null;
  let entrada: number | null = null;
  let prazo_quantidade: number | null = null;
  let valor_parcela: number | null = null;
  let saldo_devedor: number | null = null;
  let proxima_parcela_data: string | null = null;
  let taxa_transferencia: number | null = null;
  const PRAZO_RE = /(\d{1,3})\s*[x×X]\s*(?:R\$\s*)?([\d.]+(?:,\d{1,2})?)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const low = line.toLowerCase();

    if (credito == null && /^cr[eé]dito/i.test(line)) {
      credito = moneyFromLine(line);
      continue;
    }
    if (entrada == null && /^entrada/i.test(line)) {
      entrada = moneyFromLine(line);
      continue;
    }
    if (prazo_quantidade == null && (/prazo/i.test(low) || PRAZO_RE.test(line))) {
      const prazoMatch = line.match(PRAZO_RE) ?? (/prazo/i.test(low) ? lines[i + 1]?.match(PRAZO_RE) : null);
      if (prazoMatch) {
        prazo_quantidade = parseInt(prazoMatch[1], 10) || null;
        const parcela = parseBrazilianNumber(prazoMatch[2]);
        valor_parcela = parcela > 0 ? parcela : null;
        if (!line.match(PRAZO_RE)) i += 1;
      }
      continue;
    }
    if (saldo_devedor == null && /saldo\s*devedor/i.test(low)) {
      const after = line.replace(/saldo\s*devedor\s*:?\s*/i, "");
      const n = parseBrazilianNumber(after.replace(/R\$\s*/i, "").trim());
      saldo_devedor = n > 0 ? n : moneyFromLine(line);
      continue;
    }
    if (proxima_parcela_data == null && /pr[oó]xima\s*parcela|vencimento/i.test(low)) {
      proxima_parcela_data = parseBrDate(line) ?? parseDiaMesSemAno(line, hoje);
      continue;
    }
    if (taxa_transferencia == null && /transfer[eê]ncia/i.test(low)) {
      taxa_transferencia = moneyFromLine(line);
    }
  }

  return {
    tipo_carta,
    administradora,
    credito,
    entrada,
    prazo_quantidade,
    valor_parcela,
    saldo_devedor,
    proxima_parcela_data,
    taxa_transferencia,
    texto_original,
  };
}

/** Separa uma conversa colada do WhatsApp em uma mensagem por carta. */
export function separarMensagensWhatsApp(texto: string): string[] {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const blocos: string[][] = [];
  let atual: string[] = [];
  const CABECALHO = /^\[\d{1,2}:\d{2}(?::\d{2})?,\s*\d{1,2}\/\d{1,2}\/\d{2,4}\]/;
  const fechar = () => {
    if (atual.some((l) => l.trim())) blocos.push(atual);
    atual = [];
  };
  for (const linha of linhas) {
    const inicioPorCabecalho = CABECALHO.test(linha.trim());
    // Sem cabeçalho: nova carta quando aparece outro "Crédito" depois de um já lido.
    const novoCredito = /^\W*cr[eé]dito/i.test(linha.trim()) && atual.some((l) => /^\W*cr[eé]dito/i.test(l.trim()));
    if (inicioPorCabecalho || novoCredito) {
      if (novoCredito && !inicioPorCabecalho) {
        // Leva junto as linhas de título (oportunidade/administradora) que antecedem o crédito.
        const titulo: string[] = [];
        while (atual.length && !/\d/.test(atual[atual.length - 1]) ) titulo.unshift(atual.pop()!);
        fechar();
        atual = titulo;
      } else {
        fechar();
      }
    }
    atual.push(linha);
  }
  fechar();
  return blocos.map((b) => b.join("\n").trim()).filter((b) => /cr[eé]dito/i.test(b));
}

export type CartaImportacaoItem = ParsedCartaWhatsApp & {
  entrada_original: number | null;
  erro: string | null;
};

/** Lê várias cartas e soma a margem comercial na entrada de cada uma. */
export function parseCartasWhatsAppLote(
  texto: string,
  margemEntrada: number,
  hoje: Date = new Date(),
): CartaImportacaoItem[] {
  return separarMensagensWhatsApp(texto).map((bloco) => {
    const p = parseCartaWhatsAppText(bloco, hoje);
    const erro = !p.credito
      ? "Crédito não encontrado."
      : !p.entrada
        ? "Entrada não encontrada."
        : !p.tipo_carta
          ? "Não identifiquei se é imóvel ou veículo."
          : null;
    return {
      ...p,
      entrada_original: p.entrada,
      entrada: p.entrada != null ? Math.round((p.entrada + Math.max(0, margemEntrada)) * 100) / 100 : null,
      erro,
    };
  });
}
