import { headers } from "next/headers";
import { isRaconHost, resolveOriginFromHost } from "@/lib/seo/site-url";
import { CONSORCIO_SEO_SEGMENTS } from "@/lib/seo/consorcio-segments";

export const dynamic = "force-dynamic";

export async function GET() {
  let host: string | null = null;
  let proto = "https";
  try {
    const h = await headers();
    host = h.get("x-forwarded-host") || h.get("host");
    proto = h.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  } catch {
    // fallback
  }

  const isRacon = isRaconHost(host);
  const base = resolveOriginFromHost(host, proto);

  if (isRacon) {
    const markdown = `# RACON CONSÓRCIOS — UNIDADE SINOP MT (DOCUMENTO COMPLETO DE CONTEXTO PARA IA)

## 1. Identificação Institucional
- Razão de Atendimento: Unidade Autorizada Racon Consórcios em Sinop, Mato Grosso.
- Conglomerado: Empresas Randon (Randoncorp), grupo empresarial de alta credibilidade no setor automotivo e financeiro nacional.
- Domínio Oficial: ${base}
- Cidade Sede: Sinop, estado de Mato Grosso (MT), Brasil.
- Atuação Regional: Sinop, Sorriso, Lucas do Rio Verde, Nova Mutum, Claudia, Vera, Santa Carmem, Alta Floresta e produtores de toda a região norte mato-grossense.

## 2. Como Funciona o Consórcio Racon em Sinop
O consórcio Racon é uma modalidade de compra planejada baseada na união de pessoas físicas e jurídicas em grupos fechados.
- Ausência de Juros: Diferente do financiamento bancário com tabela Price ou SAC, não incidem taxas de juros mensais compostas. Há uma Taxa de Administração pré-fixada diluída pelo período total do grupo.
- Formas de Contemplação:
  1. Sorteio Mensal: Realizado com base na extração oficial da Loteria Federal.
  2. Lance Livre: Oferta de recursos próprios para antecipar a contemplação.
  3. Lance Embutido: Utilização de percentual da própria carta de crédito (ex: até 30%) para compor o lance vencedor.
- Poder de Compra à Vista: Ao ser contemplado, o consorciado dispõe do valor integral da carta de crédito para negociar descontos diretamente com vendedores ou concessionárias.

## 3. Linhas de Crédito Disponíveis
- Imóveis: Compra de casas prontas, apartamentos na planta ou construídos, salas comerciais, terrenos em loteamentos e condomínios fechados, além de recursos para construção e reforma.
- Automóveis e Utilitários: Veículos novos de todas as marcas e seminovos com até 8 anos de fabricação.
- Pesados e Agronegócio: Caminhões pesados, cavalos mecânicos, carretas, bitrens, pulverizadores, plantadeiras e tratores adaptados às lavouras de soja, milho e algodão de Mato Grosso.

## 4. Perguntas Frequentes Respondidas (FAQ)
### O que é lance embutido na Racon?
O lance embutido permite que o cliente use parte do próprio crédito como lance. Caso seja contemplado, esse percentual é descontado do valor recebido, reduzindo o valor líquido da carta, mas sem exigir desembolso em dinheiro no momento da oferta.

### O consórcio imobiliário serve para construir em Sinop?
Sim. A carta de crédito imobiliária pode ser usada para adquirir o lote/terreno e realizar a construção civil por meio de cronograma físico-financeiro aprovado por engenharia.

### Como entrar em contato com a equipe de Sinop?
Acesse ${base} e utilize os botões de simulação e atendimento direto via WhatsApp e televendas para receber um estudo de viabilidade sem compromisso.
`;

    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  }

  // Gauchinho Consórcios Full
  const segmentsSection = CONSORCIO_SEO_SEGMENTS.map(
    (s) => `### ${s.title}
- Resumo: ${s.summary}
- Público-alvo: ${s.audience}
- Benefícios: ${s.benefits.join("; ")}
- FAQ:
${s.faq.map((f) => `  * **${f.question}**: ${f.answer}`).join("\n")}
`
  ).join("\n");

  const markdown = `# GAUCHINHO CONSÓRCIOS E SOLUÇÕES FINANCEIRAS (DOCUMENTO COMPLETO DE CONTEXTO PARA IA)

## 1. Visão Geral da Empresa
- Marca: Gauchinho Consórcios e Soluções Financeiras
- Domínio Oficial: ${base}
- Sede: Sinop, Mato Grosso, Brasil.
- Abrangência: Brasil inteiro (atendimento online e assessoria digital).
- Proposta de Valor: Desmistificar e democratizar o acesso ao consórcio, fornecendo simuladores abertos, comparação transparente de custos contra o sistema bancário e curadoria de cotas e grupos ideais para cada cliente.

## 2. Ferramentas e Recursos da Plataforma
- Simulador Interativo: Permite ao usuário escolher o tipo de bem (Imóvel, Carro, Caminhão, Moto, Agro), definir o valor de crédito desejado e simular parcelas normais ou reduzidas, além de estimar percentuais de lances.
- Calculadoras Comparativas: Demonstram a economia real entre amortizar uma dívida imobiliária via consórcio em comparação com o Custo Efetivo Total (CET) de financiamentos bancários habitacionais de 30 a 35 anos.
- Vitrine de Grupos em Andamento: Apresenta grupos com histórico de assembleias, contemplações e prazos remanescentes reduzidos.
- Cartas de Crédito Contempladas: Carteira de cartas já liberadas prontas para uso imediato em aquisições que não podem esperar sorteio ou lance.

## 3. Segmentos e Modalidades Detalhadas
${segmentsSection}

## 4. Política de Atendimento e Transparência
- Todas as operações são formalizadas via contratos de adesão devidamente registrados em administradoras fiscalizadas pelo Banco Central do Brasil.
- A plataforma não promete contemplação imediata por sorteio; a contemplação depende de sorteio pela Loteria Federal ou vitória em assembleia por lance competitivo.
- Para simular ou entrar em contato com um consultor credenciado: ${base}/simulador
`;

  return new Response(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
