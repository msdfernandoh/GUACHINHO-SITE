/** Parâmetros do portfólio SPL, editáveis em Admin › Configurações › Portfólio SPL. */
export type SplPortfolioConfig = {
  /** Valor somado à entrada de cada carta contemplada importada (margem de comissão). */
  margemEntradaCarta: number;
  /** Taxa mensal de referência do home equity (% a.m.). */
  taxaHomeEquityMensal: number;
  prazoHomeEquityMeses: number;
  /** Taxa mensal de referência do financiamento bancário (% a.m.). */
  taxaFinanciamentoMensal: number;
  prazoFinanciamentoMeses: number;
  grupoSpl: string;
  reduzidaSpl: number;
  embutidoSpl: number;
  reajusteSpl: string;
  grupoEconomico: string;
  reduzidaEconomico: number;
  embutidoEconomico: number;
  reajusteEconomico: string;
  /** Validade da proposta gerada pelo vendedor, em horas. */
  validadePropostaHoras: number;
  /** WhatsApp que recebe os pedidos de reserva de carta contemplada. */
  whatsappReservas: string;
};

export const DEFAULT_SPL_PORTFOLIO: SplPortfolioConfig = {
  margemEntradaCarta: 10_000,
  taxaHomeEquityMensal: 1.85,
  prazoHomeEquityMeses: 180,
  taxaFinanciamentoMensal: 1.27,
  prazoFinanciamentoMeses: 220,
  grupoSpl: "1553",
  reduzidaSpl: 70,
  embutidoSpl: 25,
  reajusteSpl: "3% ao ano (fixo)",
  grupoEconomico: "1563",
  reduzidaEconomico: 60,
  embutidoEconomico: 25,
  reajusteEconomico: "INCC com trava de 8% ao ano",
  validadePropostaHoras: 48,
  whatsappReservas: "",
};

const num = (v: unknown, fb: number) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fb;
};

export function normalizarSplConfig(raw: Partial<SplPortfolioConfig> | null | undefined): SplPortfolioConfig {
  const d = DEFAULT_SPL_PORTFOLIO;
  const r = raw ?? {};
  return {
    margemEntradaCarta: num(r.margemEntradaCarta, d.margemEntradaCarta),
    taxaHomeEquityMensal: num(r.taxaHomeEquityMensal, d.taxaHomeEquityMensal),
    prazoHomeEquityMeses: Math.max(1, Math.round(num(r.prazoHomeEquityMeses, d.prazoHomeEquityMeses))),
    taxaFinanciamentoMensal: num(r.taxaFinanciamentoMensal, d.taxaFinanciamentoMensal),
    prazoFinanciamentoMeses: Math.max(1, Math.round(num(r.prazoFinanciamentoMeses, d.prazoFinanciamentoMeses))),
    grupoSpl: String(r.grupoSpl ?? d.grupoSpl).trim() || d.grupoSpl,
    reduzidaSpl: num(r.reduzidaSpl, d.reduzidaSpl),
    embutidoSpl: num(r.embutidoSpl, d.embutidoSpl),
    reajusteSpl: String(r.reajusteSpl ?? d.reajusteSpl),
    grupoEconomico: String(r.grupoEconomico ?? d.grupoEconomico).trim() || d.grupoEconomico,
    reduzidaEconomico: num(r.reduzidaEconomico, d.reduzidaEconomico),
    embutidoEconomico: num(r.embutidoEconomico, d.embutidoEconomico),
    reajusteEconomico: String(r.reajusteEconomico ?? d.reajusteEconomico),
    validadePropostaHoras: Math.max(1, Math.round(num(r.validadePropostaHoras, d.validadePropostaHoras))),
    whatsappReservas: String(r.whatsappReservas ?? "").replace(/\D/g, ""),
  };
}

export const SPL_CONFIG_CHAVE = "spl_portfolio";
