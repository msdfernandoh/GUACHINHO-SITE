import type { OpcaoParcelaConsorcio } from "./simulador-parcela-opcoes";
import {
  DEFAULT_OPCOES_PARCELA_AUTOMOVEL,
  DEFAULT_OPCOES_PARCELA_IMOVEL,
} from "./simulador-parcela-opcoes";

export type SiteConfig = {
  nomeEmpresa: string;
  subtitulo: string;
  descricaoInstitucional: string;
  siteUrl: string;
  statusAtivo: boolean;
  exibirBotaoGruposNoSite: boolean;
  /** URL da logo (Storage ou CDN) — opcional; futuro via admin */
  logoUrl?: string;
};

export type LeadsConfig = {
  statusInicialPadrao: string;
  permitirCriarLeadManual: boolean;
  permitirArquivarLead: boolean;
  srdPodeEditarGrupos?: boolean;
};

export type PropostasConfig = {
  validadePadraoDias: number;
  textoResumoExecutivo: string;
  avisoLegalPadrao: string;
};

export type ContatoConfig = {
  whatsappPrincipal: string;
  telefone: string;
  email: string;
  endereco: string;
  instagram: string;
};

export type { OpcaoParcelaConsorcio } from "./simulador-parcela-opcoes";

export type SimuladorTipoBemConfig = {
  taxaAdministrativaPadrao: number;
  fundoReservaPadrao: number;
  seguroPrestamistaPadrao: number;
  reajusteAnualCredito: number;
  correcaoAnualParcela: number;
  rentabilidadeAnualComparativa: number;
  valorMinimoCredito: number;
  valorMaximoCredito: number;
  valorPadraoInicial: number;
  prazosDisponiveis: number[];
  prazoPadrao: number;
  quantidadePrazosExibidos: number;
  mostrarComparacaoFinanciamento: boolean;
  mostrarTabelaAnoAno: boolean;
  exibirTabelaCompletaPorPadrao: boolean;
  opcoesParcela?: OpcaoParcelaConsorcio[];
  /** @deprecated use opcoesParcela */
  temParcelaReduzida?: boolean;
  /** @deprecated use opcoesParcela */
  percentualParcelaReduzida?: number;
};

export type FinanciamentoConfig = {
  taxaMensalPadrao: number;
  entradaMinimaSugeridaPercentual: number;
  prazoPadrao: number;
  prazoMaximo: number;
  /** Prazos exibidos na home e no simulador (mesma lista). Se vazio, usa lista padrão interna. */
  prazosDisponiveis?: number[];
  indiceReajusteOpcional: number;
  parceiroPadrao: string;
  mostrarComparacaoConsorcio: boolean;
};

export type HomeCartasConfig = {
  exibirNaHome: boolean;
  quantidade: number;
  mostrarBotaoVerCartas: boolean;
  mostrarApenasDestaque: boolean;
};

export type HomeOportunidadesConfig = {
  exibir_home: boolean;
  quantidade: number;
  mostrar_nome_imobiliaria: boolean;
  mostrar_valor: boolean;
  mostrar_botao_simular: boolean;
  mostrar_botao_ver_oportunidades: boolean;
};

export const DEFAULT_HOME_OPORTUNIDADES: HomeOportunidadesConfig = {
  exibir_home: false,
  quantidade: 6,
  mostrar_nome_imobiliaria: true,
  mostrar_valor: true,
  mostrar_botao_simular: true,
  mostrar_botao_ver_oportunidades: true,
};

export const DEFAULT_HOME_CARTAS: HomeCartasConfig = {
  exibirNaHome: false,
  quantidade: 3,
  mostrarBotaoVerCartas: true,
  mostrarApenasDestaque: true,
};

export const DEFAULT_SITE: SiteConfig = {
  nomeEmpresa: "Gauchinho Escritório de Soluções Financeiras",
  subtitulo: "",
  descricaoInstitucional: "",
  siteUrl: "",
  statusAtivo: true,
  exibirBotaoGruposNoSite: false,
};

export const DEFAULT_LEADS: LeadsConfig = {
  statusInicialPadrao: "Novo",
  permitirCriarLeadManual: true,
  permitirArquivarLead: true,
  srdPodeEditarGrupos: false,
};

export const DEFAULT_PROPOSTAS: PropostasConfig = {
  validadePadraoDias: 7,
  textoResumoExecutivo: "",
  avisoLegalPadrao: "",
};

export const DEFAULT_CONTATO: ContatoConfig = {
  whatsappPrincipal: "",
  telefone: "",
  email: "",
  endereco: "",
  instagram: "",
};

export const DEFAULT_SIMULADOR_IMOVEL: SimuladorTipoBemConfig = {
  taxaAdministrativaPadrao: 22,
  fundoReservaPadrao: 2,
  seguroPrestamistaPadrao: 0.038,
  reajusteAnualCredito: 8,
  correcaoAnualParcela: 8,
  rentabilidadeAnualComparativa: 8,
  valorMinimoCredito: 150_000,
  valorMaximoCredito: 3_000_000,
  valorPadraoInicial: 500_000,
  prazosDisponiveis: [120, 150, 180, 200, 220],
  prazoPadrao: 200,
  quantidadePrazosExibidos: 5,
  mostrarComparacaoFinanciamento: true,
  mostrarTabelaAnoAno: true,
  exibirTabelaCompletaPorPadrao: false,
  opcoesParcela: DEFAULT_OPCOES_PARCELA_IMOVEL,
};

export const DEFAULT_SIMULADOR_AUTOMOVEL: SimuladorTipoBemConfig = {
  taxaAdministrativaPadrao: 20,
  fundoReservaPadrao: 2,
  seguroPrestamistaPadrao: 0,
  reajusteAnualCredito: 5,
  correcaoAnualParcela: 5,
  rentabilidadeAnualComparativa: 6,
  valorMinimoCredito: 30_000,
  valorMaximoCredito: 300_000,
  valorPadraoInicial: 100_000,
  prazosDisponiveis: [36, 48, 60, 72, 80],
  prazoPadrao: 60,
  quantidadePrazosExibidos: 5,
  mostrarComparacaoFinanciamento: true,
  mostrarTabelaAnoAno: true,
  exibirTabelaCompletaPorPadrao: false,
  opcoesParcela: DEFAULT_OPCOES_PARCELA_AUTOMOVEL,
};

export const DEFAULT_FINANCIAMENTO_CONFIG: FinanciamentoConfig = {
  taxaMensalPadrao: 1,
  entradaMinimaSugeridaPercentual: 20,
  prazoPadrao: 240,
  prazoMaximo: 360,
  indiceReajusteOpcional: 0,
  parceiroPadrao: "",
  mostrarComparacaoConsorcio: true,
};

export type CalculadorasFinanceirasConfig = {
  ativoAplicacaoMensal: boolean;
  ativoValorFuturo: boolean;
  ativoFinanciamento: boolean;
  ativoCorrecao: boolean;
  rentabilidadeMensalPadrao: number;
  taxaFinanciamentoPadrao: number;
  textoCtaAposResultado: string;
  whatsappOrigem: string;
};

export const DEFAULT_CALCULADORAS_FINANCEIRAS: CalculadorasFinanceirasConfig = {
  ativoAplicacaoMensal: true,
  ativoValorFuturo: true,
  ativoFinanciamento: true,
  ativoCorrecao: true,
  rentabilidadeMensalPadrao: 0.8,
  taxaFinanciamentoPadrao: 1,
  textoCtaAposResultado: "Quer uma análise personalizada para seu objetivo?",
  whatsappOrigem: "calculadora_financeira",
};
