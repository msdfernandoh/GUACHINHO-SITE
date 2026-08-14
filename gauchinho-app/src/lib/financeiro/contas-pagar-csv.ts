import { createHash } from "node:crypto";

export type ContaCsvNormalizada = {
  importacaoChave: string;
  fornecedor: string | null;
  valor: number;
  dataLancamento: string | null;
  vencimento: string;
  dataPagamento: string | null;
  status: "aberta" | "paga";
  formaPagamento: string | null;
  centroCusto: string | null;
  descricao: string;
  bancoPagamento: string | null;
  responsavelImportado: string | null;
  lancadoPorImportado: string | null;
  comprovanteNome: string | null;
  comprovanteUrl: string | null;
  observacao: string | null;
  necessitaRevisao: boolean;
};

export type ResultadoParseContasCsv = {
  contas: ContaCsvNormalizada[];
  erros: Array<{ linha: number; mensagem: string }>;
};

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    const next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ";" && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.trim());
    if (row.some((value) => value !== "")) rows.push(row);
  }
  return rows;
}

function parseMoney(value: string): number | null {
  const cleaned = value
    .replace(/R\$/gi, "")
    .replace(/[\s\u00a0]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function parseDateBr(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
    ? iso
    : null;
}

function nullable(value: string | undefined): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function yes(value: string) {
  return ["sim", "s", "yes", "true", "1"].includes(normalizeHeader(value));
}

export function parseContasPagarCsv(text: string): ResultadoParseContasCsv {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { contas: [], erros: [{ linha: 1, mensagem: "CSV vazio" }] };
  const headers = rows[0]!.map(normalizeHeader);
  const index = (name: string) => headers.indexOf(normalizeHeader(name));
  const required = ["Fornecedor / Favorecido", "Valor (R$)", "Data de Vencimento", "Status", "Descrição"];
  const missing = required.filter((name) => index(name) < 0);
  if (missing.length) {
    return { contas: [], erros: [{ linha: 1, mensagem: `Colunas ausentes: ${missing.join(", ")}` }] };
  }

  const get = (row: string[], name: string) => {
    const position = index(name);
    return position >= 0 ? String(row[position] ?? "").trim() : "";
  };
  const contas: ContaCsvNormalizada[] = [];
  const erros: ResultadoParseContasCsv["erros"] = [];

  rows.slice(1).forEach((row, offset) => {
    const linha = offset + 2;
    const externalId = get(row, "ID da Conta");
    if (externalId.toUpperCase().startsWith("EXEMPLO-")) return;
    const fornecedor = get(row, "Fornecedor / Favorecido");
    const descricaoRaw = get(row, "Descrição");
    const descricao = descricaoRaw || fornecedor || "Conta importada";
    const valor = parseMoney(get(row, "Valor (R$)"));
    const vencimento = parseDateBr(get(row, "Data de Vencimento"));
    let dataPagamentoRaw = get(row, "Data de Pagamento");
    let statusRaw = get(row, "Status");

    // O arquivo analisado coloca "Pendente" em Data de Pagamento e usa
    // Status para "Em Atraso"/"A Preencher". Normalizamos sem deslocar colunas.
    if (!parseDateBr(dataPagamentoRaw) && /pendente|a preencher|em atraso/i.test(dataPagamentoRaw)) {
      statusRaw = dataPagamentoRaw;
      dataPagamentoRaw = "";
    }
    const dataPagamento = parseDateBr(dataPagamentoRaw);
    const paga = /pago|paga/i.test(statusRaw) || Boolean(dataPagamento);
    const necessitaRevisao = yes(get(row, "Necessita Revisão"));

    if (valor == null || valor < 0 || (valor === 0 && !necessitaRevisao)) {
      erros.push({ linha, mensagem: "Valor inválido; zero exige Necessita Revisão = Sim" });
      return;
    }
    if (!vencimento) {
      erros.push({ linha, mensagem: "Data de vencimento inválida" });
      return;
    }
    if (paga && !dataPagamento) {
      erros.push({ linha, mensagem: "Conta paga sem data de pagamento válida" });
      return;
    }

    const fallbackKey = createHash("sha256")
      .update([fornecedor, valor, vencimento, descricao].join("|"))
      .digest("hex");
    contas.push({
      importacaoChave: externalId || fallbackKey,
      fornecedor: nullable(fornecedor),
      valor,
      dataLancamento: parseDateBr(get(row, "Data de Lançamento")),
      vencimento,
      dataPagamento,
      status: paga ? "paga" : "aberta",
      formaPagamento: nullable(get(row, "Forma de Pagamento")),
      centroCusto: nullable(get(row, "Centro de Custo")),
      descricao,
      bancoPagamento: nullable(get(row, "Banco de Pagamento")),
      responsavelImportado: nullable(get(row, "Pago Por (Responsável)")),
      lancadoPorImportado: nullable(get(row, "Lançado Por")),
      comprovanteNome: nullable(get(row, "Nome Comprovante")),
      comprovanteUrl: nullable(get(row, "Link do Comprovante")),
      observacao: nullable(get(row, "Observações")),
      necessitaRevisao,
    });
  });

  return { contas, erros };
}
