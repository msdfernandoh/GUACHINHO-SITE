export const CABECALHOS_CARTEIRA = [
  "Nome do cliente",
  "Telefone",
  "Email",
  "Empreendimento",
  "Unidade",
  "Ja comprou (sim/nao)",
  "Valor das chaves",
] as const;

const chave = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export type LinhaCarteira = {
  nome: string;
  telefone: string;
  email: string;
  empreendimento_slug: string;
  unidade: string;
  situacao: "JA_COMPROU" | "VAI_COMPRAR" | "";
  valor_chaves: string;
};

/** Converte as linhas brutas (primeira linha = cabeçalho) em clientes da carteira. */
export function interpretarCarteira(rows: unknown[][], empreendimentos: { slug: string; nome: string }[]): LinhaCarteira[] {
  if (!rows.length) throw new Error("A planilha está vazia.");
  const header = rows[0]!.map(chave);
  const idx = (prefixo: string) => header.findIndex((h) => h.startsWith(prefixo));
  const col = {
    nome: idx("nome"),
    telefone: idx("telefone"),
    email: idx("email"),
    empreendimento: idx("empreendimento"),
    unidade: idx("unidade"),
    comprou: idx("jacomprou"),
    valor: idx("valor"),
  };
  if (col.nome < 0 || col.telefone < 0) throw new Error("Use o modelo: as colunas Nome do cliente e Telefone são obrigatórias.");
  const porNome = new Map(empreendimentos.map((e) => [chave(e.nome), e.slug]));
  return rows
    .slice(1)
    .filter((r) => r.some((c) => String(c ?? "").trim()))
    .slice(0, 300)
    .map((r) => {
      const get = (i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
      const comprou = chave(get(col.comprou));
      return {
        nome: get(col.nome),
        telefone: get(col.telefone),
        email: get(col.email),
        empreendimento_slug: porNome.get(chave(get(col.empreendimento))) ?? "",
        unidade: get(col.unidade),
        situacao: comprou.startsWith("s") ? "JA_COMPROU" : comprou.startsWith("n") ? "VAI_COMPRAR" : "",
        valor_chaves: get(col.valor),
      };
    });
}

export async function lerPlanilhaCarteira(file: File, empreendimentos: { slug: string; nome: string }[]) {
  if (file.size > 2 * 1024 * 1024) throw new Error("O arquivo deve ter até 2 MB.");
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", sheetRows: 305 });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) throw new Error("A planilha está vazia.");
  return interpretarCarteira(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }), empreendimentos);
}

export async function baixarModeloCarteira() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([
    [...CABECALHOS_CARTEIRA],
    ["Maria Silva", "(66) 99999-0000", "maria@email.com", "Gaia", "Torre 1 · 302", "sim", "350000"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Carteira");
  XLSX.writeFile(wb, "modelo-carteira-spl.xlsx");
}
