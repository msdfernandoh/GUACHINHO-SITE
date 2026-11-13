# Página de vendas para brasileiros nos EUA (12/11/2026)

## Objetivo

Criar `eua.raconsinop.com.br`, uma página de vendas para brasileiros que vivem
nos EUA. Ela mostra quanto crédito em reais o valor mensal em dólar compra,
explica o lance embutido, mostra oportunidades em todo o Brasil e oferece dois
caminhos: pedir uma reunião online no fuso do cliente ou contratar online com
envio de documentos.

O layout foi aprovado a partir do protótipo `docs/prototipos/eua-landing-prototipo.html`.

## Roteamento

- `eua.<domínio>` herda o tenant do domínio pai. Não é necessário cadastro
  próprio em `empresa_dominios` nem em `parceiro_site_dominios`
  (`src/lib/eua-landing/host.ts`).
- No subdomínio, a raiz é reescrita para `/eua`. APIs, `/proposta/*` e as demais
  rotas seguem sem reescrita e com os headers de tenant confiáveis.
- O redirect canônico do domínio pai (apex → www) não se aplica ao subdomínio.
- `/eua` entrou em `partnerOperationalPaths`, então `www.raconsinop.com.br/eua`
  também abre a página.
- A rota fica no grupo `(landing-eua)`, sem o cabeçalho e o rodapé do site
  institucional.

## Funcionalidades

- **Página inteira em PT/EN.** Dicionário único em `src/lib/eua-landing/copy.ts`,
  com `?lang=en` compartilhável. Datas, horas e números seguem o idioma.
- **Dólar comercial do dia.** Vem da série SGS 1 do Banco Central, com
  `fetchBcbUltimo` reaproveitado. Se a consulta falhar, usa 5,40.
- **Cálculos de apresentação.** Ficam em `src/lib/eua-landing/calculos.ts`. A
  parcela reduzida segue a tabela comercial divulgada: imóvel do grupo 1563,
  200 meses, 0,375% do crédito; veículo dos grupos 5388/5588, 0,58%. Quando o
  crédito passa do teto do grupo, o plano é dividido automaticamente em várias
  cotas.
- **Captação de leads.** `POST /api/public/eua/lead` com as ações `plano`,
  `reuniao`, `oportunidade` e `contratar`. Usa a mesma ingestão dos demais leads:
  `authorizePublicIngress`, `upsertLeadPorTelefone` e `registrarEvento`. O lead
  recebe origem `landing_eua`, capacidade em US$, crédito, parcela, horário da
  reunião (Sinop e fuso do cliente) e o canal escolhido. O telefone é gravado com
  o DDI (`+1 …`).
- **Reunião.** Dias de segunda a sábado, das 9h às 19h no horário de Sinop
  (UTC-4), exibidos no fuso americano do cliente. A tela registra o pedido no CRM
  e informa que a confirmação chega pelo WhatsApp. Ela não reserva horário em
  agenda de consultor.
- **Contratação.** A gaveta de escolha da cota inicia o fluxo canônico existente
  (`/api/public/contratacoes/iniciar`, origem `simulador`, modo `cliente_site`)
  e leva a `/proposta/rascunho`. Dados, documentos, pagamento e finalização
  continuam no fluxo e na RPC já homologados.
- **Oportunidades.** Mostram os imóveis publicados do tenant e as cartas
  contempladas autorizadas, sem anúncios fictícios. Há também um cartão para o
  cliente entrar na lista de imóveis novos e devolvidos.

## Correções feitas no caminho

- **Telefone internacional na proposta.** `sanitizeTelefone` preserva o "+" de
  DDI estrangeiro, e o assistente de proposta usa `formatWhatsappIntlInput`.
  Antes, "+1 (407) 555-1234" virava "(14) 07555-1234". Números brasileiros não
  mudam.
- **CRM.** O cartão do lead não adiciona mais 55 a números gravados com "+DDI"
  estrangeiro.
- **Vitrine de imóveis.** Encontrado erro pré-existente: `fetchPublicImoveis`
  falha com "more than one relationship was found for 'imoveis' and
  'imobiliarias'". Por isso `/oportunidades-imobiliarias` volta vazia. A página
  EUA usa uma consulta própria em duas etapas. A função original não foi
  alterada.

- **APIs no subdomínio.** As re-resoluções server-side de tenant das APIs
  públicas (`evaluateLegacyOperationalApiAccess` e
  `getCatalogEmpresaIdFromRequest`) usam `hostParaResolucaoTenant`. Assim
  `eua.<domínio>` vale como o domínio pai. Sem isso, os formulários do
  subdomínio recebiam 404 "Site não configurado" em produção.

- **Card de compartilhamento.** `eua/opengraph-image.tsx` gera o card
  1200×630 de curiosidade ("Quanto o seu dólar compra no Brasil?", com o valor
  em reais oculto). O título e a descrição de Open Graph estão em PT/EN. A fonte
  Inter 800 vem do Google Fonts; se a rede falhar, o card usa a fonte padrão.
- **Máscara de telefone.** Formata enquanto o cliente digita, por país:
  (407) 555-1234 nos EUA, (66) 99608-6030 no Brasil. Também exige o número
  completo (`src/lib/eua-landing/telefone.ts`).

## Testes

- Novos: `host.test.ts`, `calculos.test.ts`, `lead.test.ts`, `eua-proxy.test.ts`
  (subdomínio, APIs, proposta, `/eua` e home do domínio principal) e
  `format-intl-phone.test.ts`. O teste existente `validacao.test.ts` ganhou o
  caso de DDI.
- `tsc` sem erros. Lint sem erros nos arquivos alterados.
- Suíte completa: 2022 testes passaram. As 4 falhas restantes (Assembleias, robô
  de lances, renderização de Vendas, migração WhatsApp) estão em arquivos com
  alterações locais anteriores a esta fase e não envolvem arquivos desta
  entrega.
- No navegador local, `/eua` foi testada em PT e EN, no desktop e no celular
  (375 px, sem estouro horizontal), com agenda, gaveta de contratação e
  `/proposta/rascunho` mostrando o crédito, a parcela e o telefone `+1`. O envio
  de lead foi simulado no navegador para não gravar contato de teste no CRM de
  produção.

## Pendências

1. **Domínio.** Adicionar `eua.raconsinop.com.br` ao projeto `guachinho-site` na
   Vercel. O DNS de `raconsinop.com.br` já está delegado à Vercel, então o
   registro é criado ao adicionar o domínio.
2. **Endereço brasileiro.** A etapa de dados da proposta ainda exige CEP e UF
   brasileiros (`parseEnderecoContratacao`). O cliente nos EUA precisa informar
   um endereço no Brasil, que pode ser de um familiar, até haver decisão sobre
   aceitar endereço no exterior.
3. **Telefone na contratação.** `rpc_finalizar_contratacao_proposta` grava
   `contratacoes_online.telefone` apenas com dígitos (`1407…`). A proposta
   preserva `+1`, mas a contratação formal perde o "+".
4. **Classificação de imóveis.** Para filtrar "novos sendo entregues" e
   "devolvidos" com dados reais, a tabela `imoveis` precisa de um campo de
   classificação.
5. **Números ilustrativos.** O limite de lance embutido (30%), o aluguel (0,5%
   ao mês) e as taxas do comparativo devem ser confirmados pela franquia.
