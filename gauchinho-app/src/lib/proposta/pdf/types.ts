export const MARCA_PRINCIPAL = "Gauchinho Escritório de Soluções Financeiras";
export const TITULO_PROPOSTA = "Proposta de Solução Financeira Personalizada";
export const FRASE_CAPA =
  "Uma análise preparada para ajudar você a escolher o melhor caminho para realizar seu objetivo com segurança e planejamento.";
export const AVISO_PROJECAO_PDF =
  "Projeção estimada com base nos índices configurados. Os valores podem variar conforme administradora, grupo, índice de reajuste, regras contratuais e data de contemplação. Esta simulação não representa garantia de rentabilidade, contemplação ou disponibilidade.";
export const AVISO_RESUMO =
  "Esta proposta apresenta uma simulação inicial com base nas informações fornecidas e nas condições configuradas no sistema. Os valores podem variar conforme regras da administradora, aprovação, disponibilidade e atualização dos índices.";
export const TEXTO_COMPARATIVO =
  "O melhor caminho depende do momento, urgência, capacidade de pagamento, disponibilidade de entrada e estratégia de aquisição.";
export const TEXTO_ENCERRAMENTO =
  "Esta proposta foi preparada para orientar sua decisão. Para confirmar condições, disponibilidade e próximos passos, fale com um especialista do Gauchinho Escritório de Soluções Financeiras.";

export const PARCEIROS_SUGERIDOS = ["Racon", "Creditas", "Tutors", "Outro"] as const;

export type GrupoCotaPdfRow = {
  codigoGrupo: string;
  modalidade: string;
  valorCredito: number;
  parcela: number;
  saldoDevedor: number;
  lanceEmbutido: number;
  recursoProprio: number;
  lanceTotal: number;
  seguro: number;
  prazoRestante: number | string;
  modalidadeLanceNome: string | null;
  parcelaPosContemplacao: number | null;
  creditoLiquido: number | null;
};

export type MarcoProjecaoPdf = {
  periodo: string;
  totalPago: number;
  creditoReajustado: number;
  valorizacao: number;
  ganhoPatrimonial: number;
};

export type PropostaPdfData = {
  propostaId: string;
  dataEmissao: string;
  validadeTexto: string | null;
  cliente: {
    nome: string;
    whatsapp: string | null;
    email: string | null;
    cidade: string | null;
  };
  tipoProposta: string;
  tipoBem: string | null;
  parceiroNome: string | null;
  consultor: {
    nome: string | null;
    telefone: string | null;
    email: string | null;
    usarConsultor: boolean;
  };
  contatoGauchinho: {
    nomeEmpresa: string;
    whatsapp: string | null;
    email: string | null;
    site: string | null;
    endereco: string | null;
  };
  resumo: {
    valorCredito: number | null;
    prazo: number | null;
    parcela: number | null;
    entrada: number | null;
    lanceEmbutido: number | null;
    valorTotal: number | null;
    creditoLiquido: number | null;
  };
  detalhesLinhas: Array<{ label: string; value: string }>;
  gruposCotas: GrupoCotaPdfRow[];
  gruposTotais: {
    creditoTotal: number;
    lanceTotal: number;
    lanceEmbutido: number;
    recursoProprio: number;
    primeiraParcela: number;
    creditoLiquido: number;
  } | null;
  comparativo: {
    consorcioParcela: number;
    consorcioTotal: number;
    financiamentoParcela: number;
    financiamentoTotal: number;
    diferencaTotal: number;
    diferencaParcela: number;
  } | null;
  marcosProjecao: MarcoProjecaoPdf[];
  mostrarProjecao: boolean;
};
