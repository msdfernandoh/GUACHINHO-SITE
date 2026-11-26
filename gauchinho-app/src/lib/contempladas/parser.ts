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
  transferencia?: number | null;
  /** Comissão veio na própria lista: vale como está, por cota. */
  comissao_fixada?: boolean;
  texto_original: string;
};

export type LinhaLida = { cota: CotaLida | null; erro: string | null; texto: string };

const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function mesDoTexto(t: string): number | null {
  const n = sem(t);
  const i = MESES.findIndex((m) => new RegExp(`\\b${m}\\b|\\b${m.slice(0, 3)}\\b`).test(n));
  if (i >= 0) return i + 1;
  // Campo só com a data do vencimento: "10.01", "20/12".
  const d = t.trim().match(/^(\d{1,2})[./-](\d{1,2})(?:[./-]\d{2,4})?$/);
  const mes = d ? Number(d[2]) : 0;
  return mes >= 1 && mes <= 12 ? mes : null;
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
 * Uma carta por linha com rótulos separados por "|" (formato que o Gemini/ChatGPT devolvem):
 * "* Administradora: racon | Tipo: veiculo | Crédito: R$ 74.500,00 | Entrada: R$ 29.900,00 | Prazo: 75 | …"
 */
function lerLinhasComBarras(texto: string): LinhaLida[] | null {
  const linhas = texto.split(/\r?\n/).filter((l) => /\|/.test(l) && /cr[eé]dito\s*:/i.test(l));
  if (!linhas.length) return null;
  const campos = (l: string) => {
    const m = new Map<string, string>();
    for (const parte of l.replace(/^[\s*•\-–]+/, "").split("|")) {
      const i = parte.indexOf(":");
      if (i > 0) m.set(sem(parte.slice(0, i)), parte.slice(i + 1).trim());
    }
    const achar = (...k: string[]) => [...m.entries()].find(([n]) => k.some((x) => n.includes(x)))?.[1];
    return achar;
  };
  const numero = (v: string | undefined) => {
    const x = (v ?? "").match(/\d[\d.]*(?:,\d{1,2})?/);
    return x ? parseBrazilianNumber(x[0]) : null;
  };
  return linhas.map((l) => {
    const f = campos(l);
    const credito = numero(f("credito"));
    const entrada = numero(f("entrada"));
    const prazo = numero(f("prazo"));
    if (!credito || entrada == null || !prazo) return { cota: null, erro: "Crédito, entrada ou prazo não encontrado.", texto: l.trim() };
    const adm = (f("administradora", "adm") ?? "racon").trim().toLowerCase().replace(/[^a-zà-ú\s]/gi, "").trim() || "racon";
    const comissao = numero(f("comiss")) ?? 0;
    return {
      cota: {
        administradora: adm,
        tipo: TIPO_AUTO.test(f("tipo") ?? "") ? "automovel" : "imovel",
        credito,
        entrada_original: entrada,
        prazo: Math.round(prazo),
        parcela: numero(f("parcela")) ?? 0,
        saldo_devedor: numero(f("saldo")) ?? 0,
        vencimento_mes: mesDoTexto(f("venc") ?? ""),
        comissao_parceiro: comissao,
        comissao_fixada: comissao > 0,
        transferencia: numero(f("transf")),
        texto_original: l.trim(),
      } as CotaLida,
      erro: null,
      texto: l.trim(),
    };
  });
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
        comissao_fixada: (campo(b, "comiss") ?? 0) > 0,
        transferencia: campo(b, "transfer"),
        texto_original: b.trim(),
      } as CotaLida,
      erro: null,
      texto: b.trim(),
    };
  });
}

/** Mês do vencimento: "dezembro", "dez", "10/12", "10.01", "19.11". */
function mesVencimento(v: string): number | null {
  const m = v.match(/(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  if (m) {
    const mes = Number(m[2]);
    return mes >= 1 && mes <= 12 ? mes : null;
  }
  return mesDoTexto(v);
}

/**
 * Planilha copiada (Excel/Google Sheets) com linha de títulos:
 * ADMINISTRADORA | TIPO | CRÉDITO | ENTRADA | PRAZO | PARCELA | SALDO DEVEDOR | VENCIMENTO | COMISSÃO.
 * As colunas são achadas pelo título, em qualquer ordem.
 */
function lerPlanilhaComTitulos(texto: string): LinhaLida[] | null {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  const iTitulo = linhas.findIndex((l) => {
    const n = sem(l);
    return n.includes("credito") && n.includes("entrada") && n.includes("prazo");
  });
  if (iTitulo < 0) return null;
  const separar = (l: string) => (l.includes("\t") ? l.split("\t") : l.split(/\s{2,}|;/)).map((c) => c.trim());
  const titulos = separar(linhas[iTitulo]).map(sem);
  const col = (...chaves: string[]) => titulos.findIndex((t) => chaves.some((k) => t.includes(k)));
  const c = {
    adm: col("administradora", "adm"),
    tipo: col("tipo"),
    credito: col("credito"),
    entrada: col("entrada"),
    prazo: col("prazo"),
    parcela: col("parcela"),
    saldo: col("saldo"),
    venc: col("venc"),
    comissao: col("comiss"),
    transf: col("transf"),
  };
  // "Vencimento parcela" contém "parcela": a coluna de parcela é a que não é o vencimento.
  if (c.parcela === c.venc) c.parcela = titulos.findIndex((t, i) => t.includes("parcela") && i !== c.venc);
  const cabecalho = linhas.slice(0, iTitulo).join(" ");
  const tipoGeral = TIPO_AUTO.test(cabecalho) || /ve[ií]culo/i.test(cabecalho) ? "automovel" : "imovel";
  const num = (cel: string | undefined) => {
    const m = (cel ?? "").match(/\d[\d.]*(?:,\d{1,2})?/);
    return m ? parseBrazilianNumber(m[0]) : null;
  };
  return linhas.slice(iTitulo + 1).flatMap((l): LinhaLida[] => {
    const cel = separar(l);
    const credito = num(cel[c.credito]);
    if (!credito) return [];
    const entrada = num(cel[c.entrada]);
    const prazo = num(cel[c.prazo]);
    if (entrada == null || !prazo) return [{ cota: null, erro: "Entrada ou prazo não encontrado.", texto: l.trim() }];
    const tipoCel = c.tipo >= 0 ? cel[c.tipo] ?? "" : "";
    const comissao = c.comissao >= 0 ? num(cel[c.comissao]) : null;
    return [
      {
        cota: {
          administradora: (c.adm >= 0 && cel[c.adm] ? cel[c.adm] : "racon").toLowerCase(),
          tipo: tipoCel ? (/ve[ií]c|auto|moto|caminh|pesad/i.test(tipoCel) ? "automovel" : "imovel") : tipoGeral,
          credito,
          entrada_original: entrada,
          prazo: Math.round(prazo),
          parcela: num(cel[c.parcela]) ?? 0,
          saldo_devedor: num(cel[c.saldo]) ?? 0,
          vencimento_mes: c.venc >= 0 ? mesVencimento(cel[c.venc] ?? "") : null,
          comissao_parceiro: comissao ?? 0,
          comissao_fixada: comissao != null && comissao > 0,
          transferencia: c.transf >= 0 ? num(cel[c.transf]) : null,
          texto_original: l.trim(),
        } as CotaLida,
        erro: null,
        texto: l.trim(),
      },
    ];
  });
}

/**
 * Lê o texto colado (linhas da planilha ou mensagens do WhatsApp) e aplica o
 * acréscimo de entrada (percentual do crédito ou valor fixo) em cada cota.
 */
/** CSV (vírgulas e aspas, como o Google Sheets/Excel exportam) vira colunas separadas por TAB. */
function csvParaTabs(texto: string): string {
  if (!/","|,"R\$|"R\$[^"]*",/.test(texto)) return texto;
  return texto
    .split(/\r?\n/)
    .map((linha) => {
      const cels: string[] = [];
      let atual = "";
      let aspas = false;
      for (let i = 0; i < linha.length; i++) {
        const ch = linha[i];
        if (ch === '"') {
          if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
        } else if (ch === "," && !aspas) {
          cels.push(atual.trim());
          atual = "";
        } else atual += ch;
      }
      cels.push(atual.trim());
      return cels.join("\t");
    })
    .join("\n");
}

export function lerCotasTexto(textoBruto: string, acrescimo: Acrescimo | ((tipo: "imovel" | "automovel") => Acrescimo)): LinhaLida[] {
  const texto = csvParaTabs(textoBruto);
  const agioDe = typeof acrescimo === "function" ? acrescimo : () => acrescimo;
  const rotulados = lerLinhasComBarras(texto) ?? lerPlanilhaComTitulos(texto) ?? lerBlocosRotulados(texto);
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
