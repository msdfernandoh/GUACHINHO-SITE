import { parseBrazilianNumber } from "@/lib/utils/format";
import type { CartaTipo, ParsedCartaWhatsApp } from "./types";

function moneyFromLine(line: string): number | null {
  const m = line.match(/(?:R\$\s*)?([\d.]+(?:,\d{1,2})?)/i);
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

function detectTipo(firstLine: string): CartaTipo | null {
  const u = firstLine.toUpperCase();
  if (/IM[OÓ]VEL/.test(u)) return "imovel";
  if (/AUTOM[OÓ]VEL|AUTOMOVEL|\bAUTO\b|VE[IÍ]CULO|CARRO/.test(u)) return "automovel";
  return null;
}

function detectAdministradora(firstLine: string, tipo: CartaTipo | null): string | null {
  const cleaned = firstLine.replace(/[^\w\sÀ-ú]/gi, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  const upperWords = words.map((w) => w.toUpperCase());
  let startIdx = 0;
  for (let i = 0; i < upperWords.length; i++) {
    const w = upperWords[i];
    if (/^CARTA$/.test(w) || /^CONTEMPLADA$/.test(w)) {
      startIdx = i + 1;
      continue;
    }
    if (tipo === "imovel" && /^IM[OÓ]VEL$/.test(w)) {
      startIdx = i + 1;
      break;
    }
    if (
      tipo === "automovel" &&
      (/^AUTOM[OÓ]VEL$/.test(w) || /^AUTOMOVEL$/.test(w) || /^AUTO$/.test(w) || /^VE[IÍ]CULO$/.test(w))
    ) {
      startIdx = i + 1;
      break;
    }
  }
  const admin = words[startIdx];
  return admin ?? null;
}

/** Organiza texto colado do WhatsApp em campos de carta (sem inventar valores). */
export function parseCartaWhatsAppText(texto: string): ParsedCartaWhatsApp {
  const texto_original = texto;
  const lines = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const tipo_carta = detectTipo(first);
  const administradora = detectAdministradora(first, tipo_carta);

  let credito: number | null = null;
  let entrada: number | null = null;
  let prazo_quantidade: number | null = null;
  let valor_parcela: number | null = null;
  let saldo_devedor: number | null = null;
  let proxima_parcela_data: string | null = null;
  let taxa_transferencia: number | null = null;

  for (const line of lines) {
    const low = line.toLowerCase();

    if (credito == null && /^cr[eé]dito/i.test(line)) {
      credito = moneyFromLine(line);
      continue;
    }
    if (entrada == null && /^entrada/i.test(line)) {
      entrada = moneyFromLine(line);
      continue;
    }
    if (prazo_quantidade == null && /prazo/i.test(low)) {
      const prazoMatch = line.match(/(\d+)\s*x\s*([\d.,]+)/i);
      if (prazoMatch) {
        prazo_quantidade = parseInt(prazoMatch[1], 10) || null;
        const parcela = parseBrazilianNumber(prazoMatch[2]);
        valor_parcela = parcela > 0 ? parcela : null;
      }
      continue;
    }
    if (saldo_devedor == null && /saldo\s*devedor/i.test(low)) {
      const after = line.replace(/saldo\s*devedor\s*:?\s*/i, "");
      const n = parseBrazilianNumber(after.replace(/R\$\s*/i, "").trim());
      saldo_devedor = n > 0 ? n : moneyFromLine(line);
      continue;
    }
    if (proxima_parcela_data == null && /pr[oó]xima\s*parcela/i.test(low)) {
      proxima_parcela_data = parseBrDate(line);
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
