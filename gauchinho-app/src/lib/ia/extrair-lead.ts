import type { DadosLeadExtraidos, ExtrairLeadResult, IaChatMessage } from "./types";

function textoConversa(messages: IaChatMessage[]): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => m.content)
    .join("\n");
}

function extrairNome(text: string): string | undefined {
  const patterns = [
    /(?:meu nome (?:é|e)|me chamo|sou o?a?)\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s]{1,40})/i,
    /nome[:\s]+([A-Za-zÀ-ú][A-Za-zÀ-ú\s]{1,40})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const nome = m[1].trim().split(/\s+/).slice(0, 4).join(" ");
      if (nome.length >= 2) return nome;
    }
  }
  return undefined;
}

function extrairWhatsapp(text: string): string | undefined {
  const m = text.match(/(?:whatsapp|zap|celular|telefone|fone)[:\s]*([\d\s().+-]{10,20})/i);
  const raw = m?.[1] ?? text.match(/\b(\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4})\b/)?.[1];
  if (!raw) {
    const digits = text.replace(/\D/g, "");
    const idx = digits.search(/55?\d{10,11}/);
    if (idx >= 0) {
      const slice = digits.slice(idx).replace(/^55/, "");
      if (slice.length >= 10 && slice.length <= 11) return slice;
    }
    return undefined;
  }
  const digits = raw.replace(/\D/g, "").replace(/^55/, "");
  if (digits.length >= 10 && digits.length <= 11) return digits;
  return undefined;
}

function extrairCidade(text: string): string | undefined {
  const m = text.match(
    /(?:cidade|moro em|sou de|em)\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s-]{2,30})/i,
  );
  if (m?.[1]) {
    const c = m[1].trim().split(/[,.]/)[0]?.trim();
    if (c && c.length >= 3 && !/mil|consórcio|financiamento/i.test(c)) return c;
  }
  return undefined;
}

function extrairValor(text: string): number | undefined {
  const contextual = text.match(
    /(?:imóvel|imovel|carro|crédito|credito|valor|simular)[^\d]{0,40}([\d.]{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+)\s*mil/i,
  );
  if (contextual?.[1]) {
    const n = Number(contextual[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n < 100_000) return Math.round(n * 1000);
  }

  const reais = text.match(/r\$\s*([\d.]{1,3}(?:\.\d{3})*(?:,\d{2})?)/i);
  if (reais?.[1]) {
    const n = Number(reais[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n < 1e9) return Math.round(n);
  }

  const mil = text.match(/\b([\d.]{1,3}(?:\.\d{3})*|\d+)\s*mil\b/i);
  if (mil?.[1]) {
    const n = Number(mil[1].replace(/\./g, ""));
    if (Number.isFinite(n) && n > 0 && n < 100_000) return Math.round(n * 1000);
  }

  return undefined;
}

function extrairRecurso(text: string): number | undefined {
  const m = text.match(
    /(?:lance|entrada|recurso|tenho|disponho)[^\d]{0,20}(?:r\$?\s*)?([\d.]{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+)\s*(?:mil)?/i,
  );
  if (!m?.[1]) return undefined;
  let s = m[1].replace(/\./g, "").replace(",", ".");
  let n = Number(s);
  if (/mil/i.test(m[0])) n *= 1000;
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return undefined;
}

function extrairInteresse(text: string): { tipo?: string; produto?: string } {
  const lower = text.toLowerCase();
  if (/carta contemplada|carta contempl/i.test(lower)) {
    return { tipo: "Carta contemplada", produto: "carta_contemplada" };
  }
  if (/financiamento|financiar/i.test(lower)) {
    return { tipo: "Financiamento", produto: "financiamento" };
  }
  if (/oportunidade imob|imóvel parceiro|imobiliária/i.test(lower)) {
    return { tipo: "Oportunidade imobiliária", produto: "imovel" };
  }
  if (/investimento|aplicação|aplicar/i.test(lower)) {
    return { tipo: "Investimento", produto: "investimento" };
  }
  if (/caminhão|caminhao/i.test(lower)) {
    return { tipo: "Consórcio caminhão", produto: "caminhao" };
  }
  if (/caminhonete|pickup/i.test(lower)) {
    return { tipo: "Consórcio caminhonete", produto: "caminhonete" };
  }
  if (/moto|motocicleta/i.test(lower)) {
    return { tipo: "Consórcio moto", produto: "moto" };
  }
  if (/automóvel|automovel|carro|veículo|veiculo/i.test(lower)) {
    return { tipo: "Consórcio automóvel", produto: "automovel" };
  }
  if (/imóvel|imovel|casa|apartamento/i.test(lower)) {
    return { tipo: "Consórcio imóvel", produto: "imovel" };
  }
  if (/consórcio|consorcio|grupo/i.test(lower)) {
    return { tipo: "Consórcio", produto: "consorcio" };
  }
  if (/grupo/i.test(lower)) {
    return { tipo: "Grupos de consórcio", produto: "grupos" };
  }
  return {};
}

function extrairUrgencia(text: string): string | undefined {
  if (/imediata|urgente|já|agora|rápido/i.test(text)) return "Compra imediata";
  if (/planej|futuro|meses|ano/i.test(text)) return "Compra planejada";
  return undefined;
}

export function buildResumoIa(dados: DadosLeadExtraidos): string {
  const parts: string[] = [];
  parts.push(
    `Lead demonstrou interesse em ${dados.tipoInteresse ?? "solução financeira"}.`,
  );
  if (dados.valorAproximado) {
    parts.push(
      `Valor aproximado informado: R$ ${dados.valorAproximado.toLocaleString("pt-BR")}.`,
    );
  }
  if (dados.urgencia) parts.push(`Perfil: ${dados.urgencia}.`);
  if (dados.recursoProprio) {
    parts.push(
      `Recurso próprio/lance/entrada informado: cerca de R$ ${dados.recursoProprio.toLocaleString("pt-BR")}.`,
    );
  }
  if (dados.cidade) parts.push(`Cidade informada: ${dados.cidade}.`);
  parts.push("Deseja orientação com especialista Gauchinho.");
  return parts.join(" ");
}

export function extrairLeadDaConversa(messages: IaChatMessage[]): ExtrairLeadResult {
  const text = textoConversa(messages);
  const { tipo, produto } = extrairInteresse(text);

  const dados: DadosLeadExtraidos = {
    nome: extrairNome(text),
    whatsapp: extrairWhatsapp(text),
    cidade: extrairCidade(text),
    tipoInteresse: tipo,
    produtoInteresse: produto,
    valorAproximado: extrairValor(text),
    urgencia: extrairUrgencia(text),
    recursoProprio: extrairRecurso(text),
  };

  dados.resumo = buildResumoIa(dados);

  const prontoParaLead = Boolean(
    dados.nome?.trim() &&
      dados.whatsapp &&
      (dados.tipoInteresse || dados.produtoInteresse),
  );

  return { dados, prontoParaLead };
}
