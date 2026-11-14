# Página Método Herança Inteligente — filhos.raconsinop.com.br (14/11/2026)

## Objetivo

Página de vendas com cadastro focada na carta de R$ 100 mil com parcela inicial
de R$ 375, mostrando que esse começo pode construir de R$ 317 mil a R$ 599 mil
para o filho em 16 anos. O tom é emocional: a herança que os pais vivem junto,
em vida. A página oferece inscrição direta no encontro e cadastro para receber
informações. O encontro tem link e QR code próprios.

## Rotas

| Endereço | Rota real | Conteúdo |
|---|---|---|
| `filhos.raconsinop.com.br/` | `/filhos` | Página de vendas |
| `filhos.raconsinop.com.br/evento` | `/filhos/evento` | Inscrição direta no encontro (destino do QR) |
| `filhos.raconsinop.com.br/qr` | `/filhos/qr` | QR code para imprimir e baixar (PNG/SVG), fora dos buscadores |

- A regra de subdomínio da página EUA foi generalizada em
  `src/lib/landings/subdominios.ts`. Cada landing declara a sua base e os seus
  caminhos curtos. `eua.` e `filhos.` herdam o tenant do domínio pai, inclusive
  nas re-resoluções server-side das APIs (`hostParaResolucaoTenant`).
- `/filhos` e `/eua` ficam liberados no domínio principal (`LANDING_BASES`).

## Evento, vagas e lista de espera

- Evento criado em `eventos`: slug `heranca-inteligente`, "Encontro Método
  Herança Inteligente", ativo, publicado, somente por link, limite de 30 vagas,
  vagas visíveis. A data e o local ficaram em branco para a equipe preencher no
  admin; enquanto isso, a página informa que serão confirmados pelo WhatsApp.
- A inscrição usa a API existente `/api/public/eventos/inscricao`, que já cria o
  lead (origem `evento`) e o participante e controla as vagas. Acima do limite,
  o status é `lista_espera` e a página mostra: "As vagas deste encontro já foram
  preenchidas. Devido à grande procura, vamos realizar um novo encontro e você
  será informado pelo WhatsApp assim que a nova data for definida."
- O payload de inscrição ganhou `filhosIdades` (opcional). A quantidade e as
  idades vão para a observação do participante ("Filhos: 2 filhos — 4 anos e 9
  anos") e para os dados do lead. Eventos sem esse campo seguem iguais.

## Cadastro para informações

`POST /api/public/filhos/lead` grava o lead com origem `landing_heranca`,
crédito de R$ 100 mil, parcela de R$ 375, quantidade e idades dos filhos.

## Projeção

`src/lib/heranca-inteligente/projecao.ts` reproduz a tabela comercial: parcela e
crédito reajustados em 8% ao ano e, após a contemplação, crédito aplicado a 1%
ao mês até o 16º ano. O ano 1 dá R$ 599.580,20 e o ano 16 dá R$ 317.216,91. A
linha do tempo interativa combina a idade do filho com o ano da contemplação.

## Card de compartilhamento

`filhos/opengraph-image.tsx`: "A herança que você vive junto", "R$ 375/mês vira
até R$ 599 mil", com selo de encontro gratuito. A rota `/filhos/evento` herda o
card.

## Testes

- Novos: `subdominios.test.ts`, os testes do proxy para `filhos.`
  (`eua-proxy.test.ts`), `filhos.test.ts` (idades), `projecao.test.ts` (tabela)
  e `lead.test.ts`.
- `tsc` sem erros, lint limpo nos arquivos novos e 544 testes das áreas
  afetadas passando.
- No navegador local, a página foi testada no desktop e no celular, sem estouro
  horizontal. O formulário foi testado com a resposta simulada: lista de espera
  com a mensagem do novo encontro e envio com o slug e as idades. Também foram
  conferidas as páginas de inscrição direta e do QR.

## Pendências

1. Informar a data, a hora e o local do encontro no admin de eventos.
2. Confirmar o limite de 30 vagas, que é editável no admin.
3. Adicionar `filhos.raconsinop.com.br` ao projeto na Vercel.

## Atualização — evento, admin e leads (14/11/2026)

- Encontro definido: terça-feira, 17/11/2026, às 19h30 (Sinop), no Auditório
  da UniFECAF, Av. Embaúbas, 2114 - Setor Comercial, com 30 vagas.
- Admin → Eventos ganhou o botão **Herança Inteligente**
  (`/admin/eventos/heranca-inteligente`). A página tem um formulário de dia,
  horário, vagas, local e endereço, mostra vagas, confirmados, restantes e
  lista de espera, e traz atalhos para os inscritos, a página, o QR e a edição
  completa.
- Leads do projeto: a inscrição em eventos passou a gravar a empresa e o site de
  origem do tenant resolvido pelo servidor. Para eventos mapeados em
  `src/lib/comercial-eventos/projetos.ts`, o lead também recebe o projeto
  (`produto_interesse` = "Método Herança Inteligente"), o local de atendimento
  (`preferencia_atendimento` = "Presencial · local · endereço · cidade") e a data
  (`quando_atendimento`). O cadastro de informações também recebe o local e a
  data do encontro.
- Convites 9:16 (modelo original e modelo família, sem valores) e QR code em alta
  resolução ficam em `docs/convites/`. O gerador é
  `gauchinho-app/scripts/gerar-convite-heranca.mjs`.
- Confirmação de inscrição: o botão "Salvar na agenda" ficou legível e o
  convite agora diz "Compartilhe essa oportunidade com outros pais".
