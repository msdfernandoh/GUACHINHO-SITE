# Portfólio SPL para imobiliárias parceiras (15/11/2026)

## Objetivo
Página `spl.raconsinop.com.br` para imobiliárias parceiras da SPL Engenharia
se cadastrarem, subirem a carteira de clientes e darem aos vendedores um
portfólio simples para apresentar as soluções da entrega das chaves (70%).

## Rotas
| Rota | Uso |
|---|---|
| `/spl` (raiz de `spl.<domínio>`) | Página de vendas: contadores, logos aprovadas, empreendimentos, modelos de parceria |
| `/spl/cadastro` | Cadastro da imobiliária em 3 passos (dados e logo, modelo e PIX, equipe) |
| `/spl/painel/<token>` | Painel da imobiliária: cliente, planilha, vendedores, link de convite |
| `/spl/e/<convite>` | Cadastro de vendedor pelo link da imobiliária (entra na rede) |
| `/spl/v/<código>` | Portfólio do vendedor (consórcio, contemplada, financiamento, home equity) |
| `/admin/spl` | Aprovação, logo, carteira, empreendimentos e parâmetros |
| `/admin/cartas-contempladas/importar` | Atalho do master: colar a conversa do WhatsApp e substituir as cartas |

APIs públicas (todas com `authorizePublicIngress`): `POST /api/public/spl/imobiliaria`,
`/vendedor`, `/cliente`, `/planilha`.

## Banco (migration 340)
Tabelas novas e aditivas, com RLS por tenant e acesso do site via service role:
`spl_empreendimentos`, `spl_imobiliarias`, `spl_vendedores`, `spl_clientes`.
Seed dos seis empreendimentos para as empresas `gauchinho`, `racon-sinop` e
`sorriso` e a configuração `spl_portfolio` em `configuracoes_sistema`.
Observação: hoje `raconsinop.com.br` é servido pelo site parceiro da empresa
Gauchinho (`parceiro_site_dominios`); o registro em `empresa_dominios` da
Racon Sinop não está ativo. Por isso o seed cobre as três empresas.
Cada cliente também é gravado no CRM (`leads`, origem `spl_portfolio`) pelo
`upsertLeadPorTelefone`. A imobiliária gera uma `organizacoes_parceiras`
(`IMOBILIARIA`, rascunho até a aprovação).

## Regras de negócio
- Modelos de parceria: Gerador de oportunidades (12,5%), Gerador de negócios
  (25%), Microfranquia (50%) e "não participar, só liberar a carteira" (sem
  CNPJ/PIX obrigatórios).
- Modelo do vendedor: próprio (não vê comissão nem PIX), gerador de negócios
  ou gerador de oportunidades. A comissão do vendedor sai da parte da imobiliária.
- A logo só aparece na página depois da aprovação no admin.
- Consórcio: Plano SPL (grupo 1553, reduzida 70%, embutido 25%, reajuste 3% a.a.)
  e Plano Econômico (grupo 1563, reduzida 60%, embutido 25%, INCC com trava 8%).
  `lib/spl/combinacao-cartas.ts` usa o mesmo cálculo da tela de grupos
  (`calcularLinhaSimulacaoGrupo`), sempre com o máximo de cotas que cabe no valor
  (menor carta do grupo), e devolve a composição logo abaixo e logo acima do
  crédito líquido pedido, aceitando valores de carta diferentes.
- Proposta: vale 48 horas (`proposta_expira_em`); o consórcio segue para o fluxo
  canônico `/proposta/rascunho` (documentos) e qualquer solução gera PDF pela
  impressão do resumo.
- Cartas contempladas: lidas do catálogo ativo do site; reserva pedida pelo
  WhatsApp (sem bloqueio no sistema).
- Financiamento e home equity: `simularFinanciamento` com taxas configuráveis
  (home equity 1,85% a.m.) e aviso de análise de crédito.

## Atalho das cartas contempladas
`parseCartaWhatsAppText` passou a ler os formatos "Contemplada RACON Veículo" e
"🔥OPORTUNIDADE🔥 / RACON CONSÓRCIOS - IMÓVEL" (prazo na linha de baixo, "×",
"Vencimento 10/12"). `parseCartasWhatsAppLote` separa a conversa por mensagem e
soma a margem configurável (R$ 10 mil) na entrada. A ação do master inclui as novas
como disponíveis e só depois inativa as ativas da mesma administradora.

## Pendências de implantação
1. Aplicar `supabase/migrations/340_spl_portfolio_imobiliarias.sql` (em 15/11 a
   aplicação pelo conector pediu confirmação e não foi executada; o banco segue sem as tabelas `spl_*`).
2. Apontar `spl.raconsinop.com.br` para o projeto na Vercel (mesmo padrão de `eua.`/`filhos.`).
3. Conferir no admin os grupos 1553/1563 publicados no catálogo da empresa.

## Verificação (15/11/2026)
- `tsc --noEmit` do projeto: sem erros.
- ESLint nos arquivos novos e alterados: sem avisos.
- `next build`: concluído, com as rotas `/spl`, `/spl/cadastro`, `/spl/painel/[token]`, `/spl/e/[codigo]`, `/spl/v/[codigo]`.
- Vitest completo: 408 arquivos passando; 5 falhas pré-existentes e sem relação com o SPL
  (contratos de migrations antigas de assembleias e WhatsApp, robô de lances, renderização de Vendas e texto do app-indicador).
- Conferência do motor com a tela de grupos: R$ 350 mil no 1553 → 2 × R$ 250 mil, líquido R$ 341.250 e lance R$ 158.750.

## Testes
`lib/cartas/parser-lote.test.ts`, `lib/spl/combinacao-cartas.test.ts`,
`lib/spl/validacao.test.ts`, `lib/spl/planilha.test.ts` e o caso `spl` em
`lib/landings/subdominios.test.ts`.

## Ajustes de 15/11/2026 (noite) — migration 341
- Máscaras de celular, CNPJ e CPF (`lib/spl/mascaras.ts`); celular limitado a 11 números.
- Chave PIX com tipo obrigatório (celular, CPF, CNPJ, e-mail ou aleatória), validada e
  normalizada por tipo (`validarChavePix`); coluna `chave_pix_tipo` em imobiliárias e vendedores.
- "Como pretende remunerar os vendedores": o percentual do vendedor sai do percentual da
  imobiliária e não pode passar dele (`opcoesRemuneracaoVendedor`, validado também na API).
  No mesmo modelo da imobiliária aparece o aviso de que ela repassa toda a comissão.
- CNPJ opcional: o cadastro entra marcado como incompleto (aviso no cadastro, no painel e no admin).
- Links com o nome da imobiliária: `/spl/painel/<nome>-<token>`, `/spl/e/<nome>-<convite>`,
  `/spl/v/<nome>-<código>` (links antigos continuam válidos; `lib/spl/links.ts`).
- Painel da SPL Engenharia, somente leitura e só com números agregados:
  `/spl/dashboard/spl-engenharia-<token>` (token em `configuracoes_sistema.spl_dashboard`;
  link exibido em `/admin/spl`).

## Ajustes de 15/11/2026 (noite) — migration 342
- Painel da imobiliária: "Editar dados da imobiliária" (nome, logo, responsável, contatos,
  CNPJ, PIX, equipe e remuneração). O modelo de parceria só muda enquanto o cadastro
  está em aprovação (`POST /api/public/spl/imobiliaria/editar`).
- Remuneração "Escolher para cada vendedor" (`POR_VENDEDOR`): o painel gera um link de
  convite por modelo permitido, assinado com HMAC do token do painel (`lib/spl/convite.ts`),
  para o vendedor não trocar o modelo pelo endereço.
- Portfólio: valor das chaves com máscara em reais (padrão R$ 350.000,00) e opção
  "Apenas pelo saldo bruto" (o valor vira o crédito da carta, sem lance embutido).

## App na tela inicial e envio pelo WhatsApp (15/11/2026)
- Painel da imobiliária, portfólio do vendedor e painel da SPL viram app (PWA): manifesto por
  link pessoal em `/api/public/spl/manifest` (`start_url` = o próprio link), ícones
  `public/spl-img/app-icon-*.png` e botão "Instalar" (`components/spl/spl-instalar-app.tsx`).
- Botões "Mandar para o meu WhatsApp" (painel e portfólio), "Enviar no WhatsApp" do portfólio de
  cada vendedor no painel e "Enviar o sistema no WhatsApp" para cada imobiliária no admin.

## 16/11/2026 — cartas pelo celular, termo de parceria e ações do admin (migration 343)
- Importação de cartas: tela para celular, "Cadastrar e substituir" (só o mesmo tipo e
  administradora) ou "Apenas cadastrar", margem por tipo (imóvel R$ 10 mil, veículo R$ 5 mil,
  `margemEntradaCartaVeiculo`), tipo forçado opcional e aviso de cartas repetidas.
- Admin no celular: barra lateral recolhida com botão "Menu".
- Termo de parceria das imobiliárias: texto publicado em Admin › Portfólio SPL
  (`configuracoes_sistema.spl_termos`, nova versão a cada publicação). Aceite obrigatório no
  cadastro e no painel quando há versão nova; aceite registrado com versão, data, IP e navegador.
  PDF em `/api/public/spl/termos/pdf` (com `?painel=` sai com os dados e o aceite da imobiliária).
- Admin: copiar link do painel e do convite, baixar o termo aceito e excluir imobiliária
  (apaga vendedores e clientes da carteira SPL; os leads do CRM ficam).

## Fase — Termos de parceria por modelo, preenchidos com o cadastro (2026-11-16)

- Três termos a partir das minutas da rede: Parceiro Indicador (GO 12,5%), Parceiro de Negócio (GN 25%) e Microfranquia (50%). "Só liberar carteira" não tem termo.
- Os textos padrão ficam em `lib/spl/termos-padrao.json`; o master pode editar e publicar uma versão própria em Admin › Portfólio SPL (`configuracoes_sistema.spl_termos` = `{versao, modelos, campos}`).
- `lib/spl/termos-preencher.ts` troca os `{{campos}}`: contratante (razão social, CNPJ e sede vindos de `empresas`), participante (nome, CNPJ, endereço, e-mail, telefone, responsável), condições do contrato (vigência, aviso prévio, foro, estorno, multa, prestação de contas, canal) e data do aceite. O que não foi preenchido aparece como "[a definir]" ou "não informado".
- Cadastro: novo campo de endereço; o termo do modelo escolhido aparece no passo 3 já com os dados digitados. Painel: termo do modelo da imobiliária com os dados atuais; o PDF (`/api/public/spl/termos/pdf?painel=` ou `?modelo=`) sai com o layout do contrato e o registro do aceite.
- Migration 344: `spl_imobiliarias.endereco` (aplicada).
- Observação: as minutas vieram marcadas como "para revisão jurídica"; a Microfranquia depende de autorização da franqueadora e da COF (Lei 13.966/2019).
