export const MODELOS_PROGRAMA_PARCEIROS = [
  {
    id: "MICROFRANQUEADO",
    slug: "microfranqueado",
    nome: "Microfranqueado",
    ganho: "50%",
    meta: "Meta anual de R$ 12 milhões",
    titulo: "Construa seu próprio negócio de consórcio com uma estrutura pronta para crescer.",
    resumo: "Para quem quer desenvolver uma operação comercial própria, com autonomia e suporte da Master.",
    publico: ["Vendedores de consórcio", "Corretores de imóveis e veículos", "Empresários e profissionais liberais", "Quem quer um negócio próprio"],
    vantagens: ["Estrutura comercial, física e operacional", "Treinamento, materiais e apoio em reuniões", "Pós-venda e acompanhamento de cotas"],
    condicoes: [["Participação", "50% da base líquida"], ["Venda mínima anual", "R$ 12.000.000,00"], ["Referência mensal", "R$ 1.000.000,00"], ["Investimento estrutural", "Sem investimento inicial estrutural"], ["Encontro semanal", "Terças-feiras, às 19h"]],
    producoes: [1000000, 3000000, 5000000],
    cta: "Quero ser Microfranqueado",
  },
  {
    id: "GERADOR_NEGOCIOS",
    slug: "gerador-de-negocios",
    nome: "Gerador de Negócios",
    ganho: "25%",
    meta: "Meta anual de R$ 6 milhões",
    titulo: "Transforme sua rede de contatos em oportunidades de negócio.",
    resumo: "Para quem vende, convida, agenda, reúne pessoas e abre portas para novos negócios.",
    publico: ["Pessoas com boa rede de contatos", "Corretores e vendedores externos", "Empresários locais", "Quem participa de grupos e eventos"],
    vantagens: ["Apoio em reuniões, apresentações e fechamento", "Network semanal e materiais comerciais", "Você pode vender ou encaminhar para a equipe"],
    condicoes: [["Participação", "25% da base líquida"], ["Meta anual", "R$ 6.000.000,00"], ["Referência mensal", "R$ 500.000,00"], ["Atuação", "Convites, eventos, reuniões e vendas"], ["Encontro semanal", "Terças-feiras, às 19h"]],
    producoes: [500000, 1000000],
    cta: "Quero ser Gerador de Negócios",
  },
  {
    id: "GERADOR_POSSIBILIDADES",
    slug: "gerador-de-possibilidades",
    nome: "Gerador de Possibilidades",
    ganho: "12,5%",
    meta: "Sem meta obrigatória",
    titulo: "Indique oportunidades e participe do resultado quando o negócio acontece.",
    resumo: "Para quem quer monetizar relacionamentos sem precisar dominar produto, negociar ou fechar contrato.",
    publico: ["Clientes, amigos e pessoas bem relacionadas", "Empresários e corretores", "Quem quer indicar sem vender diretamente", "Pessoas que identificam boas oportunidades"],
    vantagens: ["Cadastro de indicações pelo celular", "Acompanhamento de andamento e comissões", "Sem obrigação de reunião ou fechamento"],
    condicoes: [["Participação", "12,5% da base líquida"], ["Meta", "Sem meta obrigatória"], ["Atuação", "Indicação e cadastro de oportunidades"], ["Precisa vender?", "Não"], ["Precisa fazer reunião?", "Não obrigatório"]],
    producoes: [500000, 1000000, 3000000, 5000000],
    cta: "Quero indicar oportunidades",
  },
] as const;

export type ModeloParceiro = (typeof MODELOS_PROGRAMA_PARCEIROS)[number];
export type ModeloParceiroId = ModeloParceiro["id"];

export const BASE_LIQUIDA_POR_MILHAO = 33000;

export function percentualModelo(modelo: ModeloParceiroId) {
  return modelo === "MICROFRANQUEADO" ? 0.5 : modelo === "GERADOR_NEGOCIOS" ? 0.25 : 0.125;
}

export function estimarGanhoParceria(modelo: ModeloParceiroId, producaoMensal: number) {
  return (producaoMensal / 1000000) * BASE_LIQUIDA_POR_MILHAO * percentualModelo(modelo);
}
