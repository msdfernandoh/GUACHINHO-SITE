export const MODELOS_PARCERIA = [
  {
    value: "GERADOR_OPORTUNIDADES",
    label: "Gerador de oportunidades",
    percentual: "12,5%",
    porMilhao: 4_125,
    descricao: "Só indicar: mande a mensagem para o cliente ou suba a planilha. A gente faz o resto.",
  },
  {
    value: "GERADOR_NEGOCIOS",
    label: "Gerador de negócios",
    percentual: "25%",
    porMilhao: 8_250,
    descricao: "Participe das reuniões, apresente as vantagens e feche junto com a nossa equipe.",
  },
  {
    value: "MICROFRANQUIA",
    label: "Microfranquia",
    percentual: "50%",
    porMilhao: 16_500,
    descricao: "Operação independente com treinamento, site e sistema. Meta anual de R$ 12 milhões.",
  },
  {
    value: "SOMENTE_LIBERAR_CARTEIRA",
    label: "Não participar, só liberar a carteira",
    percentual: "—",
    porMilhao: 0,
    descricao: "Sua imobiliária não entra no plano de remuneração. Você só libera a carteira SPL para a gente atender.",
  },
] as const;

export type ModeloParceria = (typeof MODELOS_PARCERIA)[number]["value"];

export const MODELOS_VENDEDOR = [
  { value: "PROPRIO", label: "Modelo próprio", descricao: "A imobiliária paga o vendedor. Ele não vê comissão nem PIX no app." },
  { value: "GERADOR_NEGOCIOS", label: "Gerador de negócios", descricao: "O vendedor participa das reuniões e vendas." },
  { value: "GERADOR_OPORTUNIDADES", label: "Gerador de oportunidades", descricao: "O vendedor só indica clientes." },
] as const;

export type ModeloVendedor = (typeof MODELOS_VENDEDOR)[number]["value"];

export const SOLUCOES = [
  { value: "CONSORCIO_SPL", label: "Consórcio · Plano SPL", curta: "Consórcio SPL" },
  { value: "CONSORCIO_ECONOMICO", label: "Consórcio · Plano Econômico", curta: "Consórcio Econômico" },
  { value: "CARTA_CONTEMPLADA", label: "Carta contemplada", curta: "Carta contemplada" },
  { value: "FINANCIAMENTO", label: "Financiamento", curta: "Financiamento" },
  { value: "HOME_EQUITY", label: "Home equity", curta: "Home equity" },
] as const;

export type SolucaoSpl = (typeof SOLUCOES)[number]["value"];

export const STATUS_CLIENTE = [
  { value: "NOVO", label: "Novo" },
  { value: "EM_ATENDIMENTO", label: "Em atendimento" },
  { value: "PROPOSTA", label: "Proposta enviada" },
  { value: "FECHADO", label: "Fechado" },
  { value: "PERDIDO", label: "Não seguiu" },
] as const;

export type StatusClienteSpl = (typeof STATUS_CLIENTE)[number]["value"];

/** Remuneração fixa por solução (sem consórcio): valores da apresentação de parceiros. */
export const REMUNERACAO_FIXA = {
  FINANCIAMENTO: "R$ 3.000 por R$ 1 milhão financiado",
  HOME_EQUITY: "R$ 5.000 por R$ 1 milhão contratado",
  CARTA_CONTEMPLADA: "R$ 5.000 por carta",
} as const;

export type EmpreendimentoSpl = {
  id: string;
  slug: string;
  nome: string;
  cidade: string;
  entrega_texto: string;
  entrega_data: string | null;
  vendidas: number;
  disponiveis: number;
  foto_url: string | null;
  solucoes_recomendadas: string[];
  ordem: number;
};

export type ImobiliariaSpl = {
  id: string;
  empresa_id: string;
  nome: string;
  logo_url: string | null;
  responsavel: string;
  telefone: string;
  email: string;
  cnpj: string | null;
  chave_pix: string | null;
  modelo_parceria: ModeloParceria;
  quantidade_vendedores: number;
  modelo_vendedores: ModeloVendedor;
  status: "PENDENTE" | "APROVADA" | "RECUSADA" | "INATIVA";
  exibir_logo: boolean;
  codigo_convite: string;
  token_painel: string;
  created_at: string;
};

export type VendedorSpl = {
  id: string;
  imobiliaria_id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cpf: string | null;
  chave_pix: string | null;
  modelo: ModeloVendedor;
  codigo: string;
  ativo: boolean;
  created_at: string;
};

export type ClienteSpl = {
  id: string;
  imobiliaria_id: string;
  vendedor_id: string | null;
  nome: string;
  telefone: string;
  email: string | null;
  empreendimento_slug: string | null;
  unidade: string | null;
  situacao: "JA_COMPROU" | "VAI_COMPRAR" | null;
  valor_chaves: number | null;
  solucao: SolucaoSpl | null;
  status: StatusClienteSpl;
  origem: "PAINEL" | "PLANILHA" | "PORTFOLIO";
  proposta_expira_em: string | null;
  created_at: string;
};

export const labelDe = <T extends { value: string; label: string }>(lista: readonly T[], v: string | null | undefined) =>
  lista.find((i) => i.value === v)?.label ?? "—";

/** Imobiliária no modelo de vendedor próprio não mostra comissão nem PIX ao vendedor. */
export function vendedorVeComissao(modelo: ModeloVendedor | null | undefined): boolean {
  return modelo === "GERADOR_NEGOCIOS" || modelo === "GERADOR_OPORTUNIDADES";
}
