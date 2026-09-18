import { headers } from "next/headers";
import { isRaconHost, resolveOriginFromHost } from "@/lib/seo/site-url";

export const dynamic = "force-dynamic";

export async function GET() {
  let host: string | null = null;
  let proto = "https";
  try {
    const h = await headers();
    host = h.get("x-forwarded-host") || h.get("host");
    proto = h.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  } catch {
    // fallback estático
  }

  const isRacon = isRaconHost(host);
  const base = resolveOriginFromHost(host, proto);

  if (isRacon) {
    const markdown = `# Racon Consórcios Sinop MT

> Unidade autorizada Racon Consórcios em Sinop, Mato Grosso. Especialista em planejamento financeiro via consórcio imobiliário, veicular, caminhões e máquinas agrícolas do Grupo Empresas Randon.

## Sobre a Empresa
- **Nome:** Racon Consórcios - Unidade Sinop MT
- **Marca:** Racon Consórcios (Empresas Randon)
- **Localização:** Sinop, Mato Grosso, Brasil (Norte do MT)
- **Região atendida:** Sinop, Sorriso, Lucas do Rio Verde, Nova Mutum, Alta Floresta, Mato Grosso e todo o Brasil.
- **Regulatório:** Administradora autorizada e fiscalizada pelo Banco Central do Brasil (BACEN).
- **Modelo de Atendimento:** Consultoria presencial e digital, análise de capacidade de pagamento, simulação de parcelas e lances estratégicos.

## Principais Soluções e Modalidades
- [Simulador de Consórcio](${base}/simulador): Simule parcelas, créditos e prazos para imóveis, automóveis e pesados.
- [Tabela de Grupos](${base}/grupos): Grupos abertos e em andamento com vagas imediatas.
- [Consórcio Imobiliário](${base}/consorcio/imovel-parcela-reduzida): Aquisição de casa, apartamento, terreno, construção ou reforma com parcela reduzida.
- [Consórcio de Veículos](${base}/consorcio/carro-sem-entrada): Carros novos e seminovos sem entrada obrigatória e sem juros bancários.
- [Pesados e Agrícolas](${base}/consorcio/pesados-agricolas): Caminhões, tratores e colheitadeiras para produtores e frotistas do agronegócio.
- [Programa de Parceiros](${base}/parceiros): Cadastro para corretores, imobiliárias e indicadores de negócios.
- [Perguntas Frequentes](${base}/perguntas-frequentes): Dúvidas sobre sorteios, lances, lance embutido e contemplação.

## Diferenciais Competitivos
- Sem cobrança de juros bancários (apenas taxa de administração diluída).
- Opções com lance embutido de até 30% da própria carta de crédito.
- Solidez das Empresas Randon, uma das maiores corporações industriais e financeiras do Brasil.
- Atendimento especializado voltado para o agronegócio e desenvolvimento imobiliário de Sinop e região.
`;

    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  }

  const markdown = `# Gauchinho Consórcios e Soluções Financeiras

> Plataforma digital multi-administradora de simulação, consultoria e contratação de consórcios e soluções financeiras com sede em Sinop - MT e atendimento em todo o Brasil.

## Sobre a Empresa
- **Nome:** Gauchinho Consórcios e Soluções Financeiras
- **Sede:** Sinop, Mato Grosso, Brasil
- **Abrangência:** Atendimento online em todos os estados do Brasil e presencial no Norte do Mato Grosso.
- **Atuação:** Consultoria independente em consórcios imobiliários, automotivos, veículos pesados, máquinas agrícolas, cartas contempladas e planejamento financeiro.
- **Conformidade Legal:** Todas as operações seguem a Lei 11.795/2008 e normas do Banco Central do Brasil.

## Links e Ferramentas Oficiais
- [Simulador Inteligente](${base}/simulador): Ferramenta completa para simular créditos de R$ 30 mil a mais de R$ 2 milhões com cenários de lance livre e embutido.
- [Calculadoras Financeiras](${base}/calculadoras): Compare consórcio versus financiamento imobiliário e veicular, juros reais e valor futuro.
- [Tabela de Grupos](${base}/grupos): Acesso a cotas disponíveis em grupos em andamento com diferentes administradoras.
- [Cartas Contempladas](${base}/cartas-contempladas): Cartas de crédito com contemplação imediata para aquisição rápida.
- [Oportunidades Imobiliárias](${base}/oportunidades-imobiliarias): Imóveis em Sinop e região estruturados para compra via consórcio.
- [Segmentos de Consórcio](${base}/consorcio):
  - [Imóvel com Parcela Reduzida](${base}/consorcio/imovel-parcela-reduzida)
  - [Carro sem Entrada Obrigatória](${base}/consorcio/carro-sem-entrada)
  - [Moto com Parcela Planejada](${base}/consorcio/moto-parcela-baixa)
  - [Caminhões e Pesados](${base}/consorcio/caminhao-para-autonomo)
  - [Máquinas Agrícolas e Agro](${base}/consorcio/maquinas-agricolas)
  - [Capital de Giro Empresarial](${base}/consorcio/capital-de-giro)
- [Programa de Parceiros](${base}/parceiros): Seja um indicador de consórcios e gere receita recorrente com comissões auditadas.
- [Dúvidas Frequentes](${base}/perguntas-frequentes): Respostas detalhadas sobre o funcionamento do consórcio, contemplação e regras.
`;

  return new Response(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
