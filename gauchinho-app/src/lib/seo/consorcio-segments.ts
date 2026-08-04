export type SeoFaq = { question: string; answer: string };

export type ConsorcioSeoSegment = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  summary: string;
  audience: string;
  benefits: string[];
  considerations: string[];
  keywords: string[];
  simulatorHref: string;
  faq: SeoFaq[];
};

export const CONSORCIO_SEO_SEGMENTS: ConsorcioSeoSegment[] = [
  {
    slug: "imovel-parcela-reduzida",
    title: "Consórcio de imóvel com parcela reduzida",
    metaTitle: "Consórcio de Imóvel com Parcela Reduzida: Simule",
    metaDescription: "Simule consórcio imobiliário com parcela reduzida, compare prazos e entenda lance, contemplação e taxa de administração antes de contratar.",
    eyebrow: "Planejamento imobiliário",
    summary: "Uma alternativa para planejar casa, apartamento, terreno, construção ou reforma sem os juros de um financiamento tradicional.",
    audience: "Quem pode esperar a contemplação e deseja organizar a compra do imóvel no médio ou longo prazo.",
    benefits: ["Crédito para diferentes objetivos imobiliários", "Possibilidade de usar recursos próprios no lance", "Simulação de prazo, parcela e cenários de contemplação"],
    considerations: ["A contemplação não tem data garantida", "Há taxa de administração e possíveis encargos previstos em contrato", "A parcela pode mudar após a contemplação ou conforme o plano"],
    keywords: ["consórcio de imóvel com parcela reduzida", "simulador consórcio imobiliário", "consórcio para comprar casa", "consórcio para terreno", "consórcio para reforma"],
    simulatorHref: "/simulador?solucao=consorcio&tipo=imovel&origem=seo-imovel-parcela-reduzida",
    faq: [
      { question: "Consórcio de imóvel tem juros?", answer: "O consórcio não cobra juros bancários, mas possui taxa de administração e pode incluir fundo de reserva, seguro e outros encargos informados no contrato." },
      { question: "A parcela reduzida permanece até o fim?", answer: "Depende do plano. Em muitos casos a redução vale até a contemplação e a diferença é redistribuída depois. A proposta deve ser analisada antes da adesão." },
      { question: "Posso usar o crédito para construir ou reformar?", answer: "Há planos imobiliários que permitem aquisição, construção, reforma ou compra de terreno, conforme as regras da administradora." },
    ],
  },
  {
    slug: "carro-sem-entrada",
    title: "Consórcio de carro sem entrada obrigatória",
    metaTitle: "Consórcio de Carro sem Entrada: Simule Parcelas",
    metaDescription: "Veja como funciona o consórcio de carro sem entrada obrigatória. Simule crédito, prazo e parcela para veículo novo ou seminovo.",
    eyebrow: "Consórcio de veículos",
    summary: "Planeje a compra de carro novo ou seminovo com carta de crédito e escolha um plano compatível com o orçamento.",
    audience: "Quem não precisa do veículo imediatamente e prefere formar poder de compra ao longo do tempo.",
    benefits: ["Sem entrada obrigatória na adesão, conforme o plano", "Compra de veículo novo ou usado dentro das regras", "Lance livre ou embutido quando disponível"],
    considerations: ["A entrega do veículo depende da contemplação", "O bem e a documentação passam por análise", "Compare taxa total, prazo e reajustes"],
    keywords: ["consórcio de carro sem entrada", "simulador consórcio de veículo", "consórcio carro seminovo", "carta de crédito para carro", "consórcio automóvel parcela baixa"],
    simulatorHref: "/simulador?solucao=consorcio&tipo=automovel&origem=seo-carro-sem-entrada",
    faq: [
      { question: "Consórcio de carro exige entrada?", answer: "Normalmente não há entrada obrigatória como em um financiamento. A primeira parcela e eventuais condições de adesão variam conforme o grupo." },
      { question: "Posso comprar carro usado?", answer: "Sim, desde que o veículo atenda aos critérios de idade, avaliação e documentação definidos pela administradora." },
      { question: "Como antecipar a contemplação?", answer: "Além do sorteio, o participante pode ofertar lance livre ou usar lance embutido quando essa modalidade estiver prevista." },
    ],
  },
  {
    slug: "moto-parcela-baixa",
    title: "Consórcio de moto com parcela planejada",
    metaTitle: "Consórcio de Moto: Simule Crédito e Parcela",
    metaDescription: "Simule consórcio de moto nova ou seminova. Compare crédito, prazo, parcela e estratégias de lance com orientação consultiva.",
    eyebrow: "Duas rodas",
    summary: "Uma forma de organizar a compra da moto para mobilidade, trabalho ou lazer sem financiamento bancário.",
    audience: "Quem busca uma moto e consegue planejar a aquisição sem depender de entrega imediata.",
    benefits: ["Planos para diferentes valores de moto", "Possibilidade de antecipar parcelas", "Estratégias de lance conforme o grupo"],
    considerations: ["Contemplação por sorteio ou lance", "Taxa de administração deve ser comparada", "Verifique critérios para motos usadas"],
    keywords: ["consórcio de moto parcela baixa", "simulador consórcio moto", "consórcio moto sem entrada", "carta de crédito para moto"],
    simulatorHref: "/simulador?solucao=consorcio&tipo=moto&origem=seo-moto",
    faq: [
      { question: "Consórcio de moto é sem entrada?", answer: "Em geral não há entrada obrigatória, mas existe a primeira parcela e podem existir condições específicas de adesão." },
      { question: "É possível dar lance embutido?", answer: "Alguns grupos permitem usar parte da carta como lance. Isso reduz o crédito líquido disponível para comprar a moto." },
    ],
  },
  {
    slug: "caminhao-para-autonomo",
    title: "Consórcio de caminhão para autônomo e transportadora",
    metaTitle: "Consórcio de Caminhão para Autônomo: Simule",
    metaDescription: "Simule consórcio de caminhão para autônomo, motorista e transportadora. Planeje frota, crédito, prazo e estratégia de lance.",
    eyebrow: "Pesados e transporte",
    summary: "Crédito planejado para renovar o caminhão, ampliar a frota ou estruturar o crescimento da operação de transporte.",
    audience: "Motoristas autônomos, produtores, empresas de logística e transportadoras que conseguem programar o investimento.",
    benefits: ["Créditos compatíveis com veículos pesados", "Planejamento sem entrada bancária obrigatória", "Compra com poder de negociação à vista após contemplação"],
    considerations: ["Avalie impacto da parcela no faturamento", "A contemplação precisa caber no cronograma operacional", "Confirme regras para veículo usado e documentação"],
    keywords: ["consórcio de caminhão para autônomo", "consórcio caminhão sem entrada", "simulador consórcio caminhão", "consórcio para transportadora", "carta de crédito caminhão usado"],
    simulatorHref: "/simulador?solucao=consorcio&tipo=caminhao&origem=seo-caminhao-autonomo",
    faq: [
      { question: "Autônomo pode fazer consórcio de caminhão?", answer: "Sim. A aprovação e liberação do crédito após a contemplação dependem da análise cadastral e das garantias exigidas pela administradora." },
      { question: "Posso comprar caminhão usado?", answer: "Muitos planos permitem, respeitando limite de idade, avaliação e regras documentais da administradora." },
      { question: "O lance embutido reduz o crédito?", answer: "Sim. Quando usado, a parte embutida é descontada da carta, reduzindo o valor líquido disponível para a compra." },
    ],
  },
  {
    slug: "maquinas-agricolas",
    title: "Consórcio de máquinas agrícolas para produtor rural",
    metaTitle: "Consórcio de Máquinas Agrícolas: Simule seu Plano",
    metaDescription: "Consórcio para trator, colheitadeira e máquinas agrícolas. Simule crédito, prazo e lance para planejar a expansão da produção rural.",
    eyebrow: "Agronegócio",
    summary: "Planejamento para aquisição de trator, colheitadeira, implementos e equipamentos que aumentam a produtividade no campo.",
    audience: "Produtores rurais, cooperativas e empresas do agronegócio com investimento programado.",
    benefits: ["Crédito para diferentes equipamentos agrícolas", "Compra negociada após contemplação", "Planejamento alinhado ao ciclo da atividade"],
    considerations: ["Confirme quais equipamentos são aceitos", "Considere sazonalidade e capacidade de pagamento", "Compare reajuste do crédito e prazo do grupo"],
    keywords: ["consórcio de máquinas agrícolas", "consórcio para trator", "consórcio para colheitadeira", "carta de crédito agronegócio", "simulador consórcio máquinas agrícolas"],
    simulatorHref: "/simulador?solucao=consorcio&tipo=maquinario&origem=seo-maquinas-agricolas",
    faq: [
      { question: "Consórcio compra trator e colheitadeira?", answer: "Existem planos para máquinas agrícolas, mas os equipamentos elegíveis dependem do regulamento e da análise da administradora." },
      { question: "Produtor rural pode ofertar lance?", answer: "Sim. O lance pode usar recursos próprios e, quando permitido, parte da própria carta de crédito." },
    ],
  },
  {
    slug: "maquinas-pesadas",
    title: "Consórcio de máquinas pesadas e equipamentos",
    metaTitle: "Consórcio de Máquinas Pesadas: Simule Crédito",
    metaDescription: "Planeje retroescavadeira, escavadeira, pá carregadeira e equipamentos com consórcio. Simule crédito, prazo e parcela.",
    eyebrow: "Construção e infraestrutura",
    summary: "Crédito planejado para ampliar capacidade operacional em obras, mineração, terraplenagem e serviços.",
    audience: "Construtoras, prestadores de serviço e empresas que programam a renovação de equipamentos.",
    benefits: ["Planejamento de ativos de alto valor", "Possibilidade de negociar a compra após contemplação", "Cenários de lance e prazo para o negócio"],
    considerations: ["Equipamentos usados seguem critérios específicos", "Planeje a aquisição conforme contratos e demanda", "Avalie taxa, fundo de reserva e reajuste"],
    keywords: ["consórcio máquinas pesadas", "consórcio retroescavadeira", "consórcio escavadeira hidráulica", "carta de crédito equipamentos", "simulador consórcio máquinas pesadas"],
    simulatorHref: "/simulador?solucao=consorcio&tipo=maquinario&origem=seo-maquinas-pesadas",
    faq: [
      { question: "Posso comprar retroescavadeira com consórcio?", answer: "Sim, quando o equipamento se enquadra nas regras da categoria de máquinas e equipamentos da administradora." },
      { question: "É possível comprar equipamento usado?", answer: "Pode ser possível, sujeito ao limite de idade, avaliação, origem e documentação exigidos." },
    ],
  },
  {
    slug: "lance-embutido",
    title: "Simulador de consórcio com lance embutido",
    metaTitle: "Simulador de Consórcio com Lance Embutido",
    metaDescription: "Simule consórcio com lance embutido e livre. Entenda quanto sobra da carta, impacto no crédito e opções após a contemplação.",
    eyebrow: "Estratégia de contemplação",
    summary: "Compare cenários de lance sem confundir valor ofertado, recursos próprios e crédito líquido disponível para comprar o bem.",
    audience: "Quem já avalia uma cota e quer entender o efeito financeiro do lance antes de decidir.",
    benefits: ["Visualização do crédito líquido", "Comparação entre lance livre e embutido", "Planejamento do valor necessário para a compra"],
    considerations: ["Lance não garante contemplação", "O embutido reduz o crédito disponível", "Percentuais e regras variam por grupo"],
    keywords: ["simulador consórcio lance embutido", "calcular lance embutido consórcio", "lance livre ou embutido", "quanto sobra da carta com lance embutido"],
    simulatorHref: "/simulador?solucao=consorcio&origem=seo-lance-embutido",
    faq: [
      { question: "O que é lance embutido?", answer: "É a utilização de uma parte da própria carta como oferta de lance. Se contemplado, esse valor é abatido e o crédito líquido fica menor." },
      { question: "Lance embutido garante contemplação?", answer: "Não. A contemplação depende das regras e dos resultados da assembleia do grupo." },
      { question: "Posso combinar lance livre e embutido?", answer: "Alguns grupos permitem combinar recursos próprios com lance embutido. Consulte o regulamento específico." },
    ],
  },
  {
    slug: "consorcio-ou-financiamento",
    title: "Consórcio ou financiamento: compare antes de decidir",
    metaTitle: "Consórcio ou Financiamento? Compare Custos e Prazos",
    metaDescription: "Compare consórcio e financiamento por prazo, entrada, juros, taxa e urgência. Use o simulador para avaliar o melhor cenário para você.",
    eyebrow: "Comparativo financeiro",
    summary: "A melhor escolha depende da urgência, capacidade de entrada, custo total e tolerância à espera pela contemplação.",
    audience: "Quem está entre comprar imediatamente por financiamento ou planejar a aquisição por consórcio.",
    benefits: ["Consórcio: planejamento sem juros bancários", "Financiamento: acesso imediato após aprovação", "Comparação orientada pelo custo e pela urgência"],
    considerations: ["Consórcio não garante data de contemplação", "Financiamento inclui juros e CET", "Compare custo total, não apenas a primeira parcela"],
    keywords: ["consórcio ou financiamento qual vale mais", "comparar consórcio e financiamento", "simulador consórcio x financiamento", "consórcio ou financiamento de imóvel"],
    simulatorHref: "/simulador?origem=seo-consorcio-ou-financiamento",
    faq: [
      { question: "Consórcio é sempre mais barato que financiamento?", answer: "Não necessariamente. O consórcio não tem juros bancários, mas possui taxas e reajustes. A comparação deve considerar custo total, prazo e necessidade de uso imediato." },
      { question: "Quando o financiamento faz mais sentido?", answer: "Quando a compra é urgente, há entrada disponível e a parcela com juros cabe no orçamento após análise do CET." },
      { question: "Quando o consórcio faz mais sentido?", answer: "Quando há flexibilidade de prazo e o objetivo é formar poder de compra com planejamento, aceitando a incerteza da contemplação." },
    ],
  },
];

export function getConsorcioSeoSegment(slug: string) {
  return CONSORCIO_SEO_SEGMENTS.find((item) => item.slug === slug);
}
