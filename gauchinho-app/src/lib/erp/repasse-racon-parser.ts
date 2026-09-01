export type RepasseRaconItem = {
  linha: number;
  produto: string;
  data_alocacao: string;
  periodo: string;
  grupo: string;
  cota: string;
  versao: string;
  cliente_nome: string;
  parcela_numero: number;
  parcela_total: number;
  situacao: string;
  percentual_comissao: number;
  valor_comissao: number;
  valor_base: number;
};

export type RepasseRaconParsed = {
  competencia: string;
  ponto_venda: string | null;
  comissionado_codigo: string | null;
  comissionado_nome: string | null;
  pedidos: { numero: string; data_aprovacao: string | null }[];
  valor_total: number;
  itens: RepasseRaconItem[];
  alertas: string[];
};

const brNumber = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));
const isoDate = (value: string) => {
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
};

export function parseRepasseRaconText(text: string, competencia: string): RepasseRaconParsed {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) throw new Error("Competência inválida.");
  if (!/Pedidos de Compras/i.test(text) || !/RACON|RANDON ADMINISTRADORA/i.test(text)) {
    throw new Error("O arquivo não foi reconhecido como relatório de Pedidos de Compras Racon.");
  }

  const totalMatch = text.match(/Valor TotalPonto de Venda:[^\n]*?([\d.]+,\d{2})\s*$/im)
    ?? text.match(/Total Pedido:\s*([\d.]+,\d{2})/i);
  if (!totalMatch) throw new Error("Valor total do relatório não encontrado.");

  const pontoMatch = text.match(/Ponto de Venda:\s*([^\n]+?)\s+[\d.]+,\d{2}\s*$/im);
  const comissionadoMatch = text.match(/(\d{3,})\s*-\s*([^\n]+?)Comissionado:/i);
  const pedidos = [...text.matchAll(/Pedido:\s*(?:(\d{2}\/\d{2}\/\d{4}))?\s*(\d{7,})/gi)].map((m) => ({
    numero: m[2],
    data_aprovacao: m[1] ? isoDate(m[1]) : null,
  }));

  let produto = "Não identificado";
  const itens: RepasseRaconItem[] = [];
  const alertas: string[] = [];
  const rowPattern = /^(\d{2}\/\d{2}\/\d{4})(\d{3})\s+(\d{6})\s+(\d{4})\s+(\d{2})\s*(.+?)\s+(\d{3})\s*\/\s*(\d{3})\s+(.+?)\s+(\d+,\d{4})\s+(\d[\d.]*,\d{2})(\d[\d.]*,\d{2})$/;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const productMatch = line.match(/^Produto:\s*(.+)$/i);
    if (productMatch) {
      produto = productMatch[1].trim();
      continue;
    }
    const match = line.match(rowPattern);
    if (!match) continue;
    const percentual = brNumber(match[10]);
    const valorComissao = brNumber(match[11]);
    const valorBase = brNumber(match[12]);
    const esperado = Math.round(valorBase * percentual) / 100;
    if (Math.abs(esperado - valorComissao) > 0.02) {
      alertas.push(`Linha ${itens.length + 1}: comissão divergente do valor-base e percentual.`);
    }
    itens.push({
      linha: itens.length + 1,
      produto,
      data_alocacao: isoDate(match[1]),
      periodo: match[2],
      grupo: match[3],
      cota: match[4],
      versao: match[5],
      cliente_nome: match[6].trim(),
      parcela_numero: Number(match[7]),
      parcela_total: Number(match[8]),
      situacao: match[9].trim(),
      percentual_comissao: percentual,
      valor_comissao: valorComissao,
      valor_base: valorBase,
    });
  }

  if (itens.length === 0) throw new Error("Nenhuma linha de comissão foi identificada no PDF.");
  const valorTotal = brNumber(totalMatch[1]);
  const soma = itens.reduce((acc, item) => acc + item.valor_comissao, 0);
  if (Math.abs(soma - valorTotal) > 0.02) {
    throw new Error(`O total das linhas (${soma.toFixed(2)}) não confere com o total do PDF (${valorTotal.toFixed(2)}).`);
  }

  return {
    competencia,
    ponto_venda: pontoMatch?.[1]?.trim() ?? null,
    comissionado_codigo: comissionadoMatch?.[1] ?? null,
    comissionado_nome: comissionadoMatch?.[2]?.trim() ?? null,
    pedidos: pedidos.length ? pedidos : [],
    valor_total: valorTotal,
    itens,
    alertas,
  };
}
