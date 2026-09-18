export const MODELOS_PROGRAMA_PARCEIROS = [
  { id: "MICROFRANQUEADO", slug: "microfranqueado", nome: "Microfranqueado", ganho: "50%", meta: "Meta anual de R$ 12 milhões", resumo: "Para quem quer construir sua própria operação comercial.", vantagens: ["Estrutura pronta e suporte da Master", "Treinamento comercial e operacional", "Eventos e apoio em vendas estratégicas"] },
  { id: "GERADOR_NEGOCIOS", slug: "gerador-de-negocios", nome: "Gerador de Negócios", ganho: "25%", meta: "Meta anual de R$ 6 milhões", resumo: "Para quem vende, reúne pessoas e transforma conexões em negócios.", vantagens: ["Apoio em reuniões e apresentações", "Network semanal e materiais comerciais", "Você pode vender ou encaminhar para a equipe"] },
  { id: "GERADOR_POSSIBILIDADES", slug: "gerador-de-possibilidades", nome: "Gerador de Possibilidades", ganho: "12,5%", meta: "Sem meta obrigatória", resumo: "Para quem quer indicar oportunidades sem precisar vender.", vantagens: ["Cadastro simples de indicações pelo celular", "Acompanhamento do andamento e das comissões", "Sem obrigação de reunião ou fechamento"] },
] as const;

export type ModeloParceiroId = (typeof MODELOS_PROGRAMA_PARCEIROS)[number]["id"];
