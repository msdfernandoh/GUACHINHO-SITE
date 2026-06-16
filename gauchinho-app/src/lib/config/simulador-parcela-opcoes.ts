import type { SimuladorTipoBemConfig } from "./defaults";

export type OpcaoParcelaConsorcio = {
  id: string;
  nome: string;
  percentual: number;
  descricao: string;
  ativa: boolean;
  ordem: number;
};

export const DEFAULT_OPCOES_PARCELA_IMOVEL: OpcaoParcelaConsorcio[] = [
  {
    id: "p60",
    nome: "60% da parcela",
    percentual: 60,
    descricao: "Parcela inicial reduzida para facilitar a entrada no plano.",
    ativa: true,
    ordem: 1,
  },
  {
    id: "p70",
    nome: "70% da parcela",
    percentual: 70,
    descricao: "Equilíbrio entre parcela inicial e amortização.",
    ativa: true,
    ordem: 2,
  },
  {
    id: "p100",
    nome: "Parcela integral",
    percentual: 100,
    descricao: "Pagamento completo da parcela desde o início.",
    ativa: true,
    ordem: 3,
  },
];

export const DEFAULT_OPCOES_PARCELA_AUTOMOVEL: OpcaoParcelaConsorcio[] = [
  {
    id: "p50",
    nome: "50% da parcela",
    percentual: 50,
    descricao: "Parcela inicial reduzida para facilitar a entrada no plano.",
    ativa: true,
    ordem: 1,
  },
  {
    id: "p100",
    nome: "Parcela integral",
    percentual: 100,
    descricao: "Pagamento completo da parcela desde o início.",
    ativa: true,
    ordem: 2,
  },
];

/** Normaliza config legada (temParcelaReduzida) para opcoesParcela. */
export function normalizarOpcoesParcela(cfg: SimuladorTipoBemConfig): OpcaoParcelaConsorcio[] {
  if (cfg.opcoesParcela?.length) {
    return [...cfg.opcoesParcela].sort((a, b) => a.ordem - b.ordem);
  }
  if (cfg.temParcelaReduzida) {
    const pct = cfg.percentualParcelaReduzida ?? 50;
    return [
      {
        id: "legado-reduzida",
        nome: `${pct}% da parcela`,
        percentual: pct,
        descricao: "Parcela inicial reduzida para facilitar a entrada no plano.",
        ativa: true,
        ordem: 1,
      },
      {
        id: "legado-integral",
        nome: "Parcela integral",
        percentual: 100,
        descricao: "Pagamento completo da parcela desde o início.",
        ativa: true,
        ordem: 2,
      },
    ];
  }
  return [
    {
      id: "integral",
      nome: "Parcela integral",
      percentual: 100,
      descricao: "Pagamento completo da parcela desde o início.",
      ativa: true,
      ordem: 1,
    },
  ];
}

export function opcoesParcelaAtivas(cfg: SimuladorTipoBemConfig): OpcaoParcelaConsorcio[] {
  return normalizarOpcoesParcela(cfg)
    .filter((o) => o.ativa && o.percentual > 0)
    .sort((a, b) => a.ordem - b.ordem);
}

export function opcaoParcelaPorId(
  cfg: SimuladorTipoBemConfig,
  id: string,
): OpcaoParcelaConsorcio | undefined {
  return normalizarOpcoesParcela(cfg).find((o) => o.id === id);
}
