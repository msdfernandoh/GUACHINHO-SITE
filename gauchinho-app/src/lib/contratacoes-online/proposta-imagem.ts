import type { VisualizacaoProposta } from "@/lib/contratacoes-online/proposta-visualizacao";

type LinhaGrupo = {
  codigoGrupo?: string;
  modalidade?: string | null;
  quantidadeCotas?: number;
  parcelasRealizadas?: number | null;
};

export type PropostaImagemPayload = {
  contratacao: {
    protocolo?: string | null;
    tipo_bem?: string | null;
    credito_selecionado?: number | null;
    parcela_estimada?: number | null;
    prazo?: number | null;
    origem?: string | null;
    administradora?: string | null;
    grupo_nome?: string | null;
  };
  resumoFinanceiro?: Record<string, number | string | null>;
  gruposLinhas?: LinhaGrupo[];
};

export type LinhaImagemProposta = { secao: "PROPOSTA" | "GRUPOS" | "FINANCEIRO"; label: string; value: string };

const moeda = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  const numero = Number(value);
  return Number.isFinite(numero)
    ? numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
};

const meses = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  const numero = Number(value);
  return Number.isFinite(numero) ? `${Math.round(numero)} meses` : "—";
};

export function montarLinhasImagemProposta(
  payload: PropostaImagemPayload,
  visualizacao: VisualizacaoProposta,
): LinhaImagemProposta[] {
  const c = payload.contratacao;
  const f = payload.resumoFinanceiro ?? {};
  const completa = visualizacao === "completa";
  const linhas: LinhaImagemProposta[] = [];
  const add = (secao: LinhaImagemProposta["secao"], label: string, value: string | null | undefined) => {
    if (value && value !== "—") linhas.push({ secao, label, value });
  };

  if (completa) add("PROPOSTA", "Tipo do bem", c.tipo_bem);
  add("PROPOSTA", "Crédito contratado", moeda(c.credito_selecionado));
  add("PROPOSTA", "Parcela inicial estimada", moeda(c.parcela_estimada));
  add("PROPOSTA", "Prazo", meses(c.prazo));
  if (completa) {
    add("PROPOSTA", "Origem", c.origem === "grupos" ? "Grupos" : "Simulador");
    add("PROPOSTA", "Administradora", c.administradora);
  }

  const grupos = payload.gruposLinhas ?? [];
  if (grupos.length) {
    grupos.forEach((grupo, index) => add(
      "GRUPOS",
      `Grupo ${grupo.codigoGrupo || index + 1}`,
      [grupo.modalidade, grupo.quantidadeCotas ? `${grupo.quantidadeCotas} cota(s)` : null,
        grupo.parcelasRealizadas != null ? `${grupo.parcelasRealizadas} meses decorridos` : null]
        .filter(Boolean).join(" · "),
    ));
  } else {
    add("GRUPOS", "Grupo selecionado", c.grupo_nome);
  }

  if (completa) add("FINANCEIRO", "Saldo devedor", moeda(f.saldoDevedor));
  add("FINANCEIRO", "Parcela integral", moeda(f.parcelaIntegral));
  if (completa) {
    add("FINANCEIRO", "Parcela reduzida", moeda(f.parcelaReduzida));
    add("FINANCEIRO", "Parcela após contemplação", moeda(f.parcelaPosContemplacao));
  }
  if (completa || Number(f.lanceEmbutido) > 0) add("FINANCEIRO", "Lance embutido", moeda(f.lanceEmbutido));
  if (completa || Number(f.recursoProprio) > 0) add("FINANCEIRO", "Recurso próprio", moeda(f.recursoProprio));
  if (completa) add("FINANCEIRO", "Lance total", moeda(f.lanceTotal));
  add("FINANCEIRO", "Crédito líquido", moeda(f.creditoLiquido));
  add("FINANCEIRO", "Saldo pós-contemplação", moeda(f.saldoPosLance));
  if (completa) add("FINANCEIRO", "Seguro", moeda(f.seguro));
  add("FINANCEIRO", "Prazo pós-contemplação", meses(f.parcelasRestantes));
  if (completa && Number.isFinite(Number(f.custoEfetivoMensal))) {
    add("FINANCEIRO", "Custo efetivo mensal", `${Number(f.custoEfetivoMensal).toLocaleString("pt-BR")}% a.m.`);
  }
  if (completa && Number.isFinite(Number(f.custoEfetivoAnual))) {
    add("FINANCEIRO", "Custo efetivo anual", `${Number(f.custoEfetivoAnual).toLocaleString("pt-BR")}% a.a.`);
  }
  return linhas;
}

export function extrairTokenProposta(url: string): string | null {
  try {
    const partes = new URL(url, "https://local.invalid").pathname.split("/").filter(Boolean);
    const indice = partes.indexOf("proposta");
    return indice >= 0 ? decodeURIComponent(partes[indice + 1] || "") || null : null;
  } catch {
    return null;
  }
}
