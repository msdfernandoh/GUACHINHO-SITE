# Repasse: competência, continuidade da cota e vínculo manual — 19/10/2026

## Diagnóstico comprovado

Projeto canônico confirmado: Supabase `eaeuoynprurmmulzhydt`. A análise usou
schema, funções e dados reais, sem acessar outro projeto físico.

1. A importação 178 e a releitura 195 exigiam competência da previsão igual
   à do PDF. Mônica (três cotas ainda abertas) e Gabriel tinham a etapa e o
   valor corretos em novembro, mas o recebimento ocorreu em outubro.
2. O cadastro mínimo antigo criava uma venda/cota e somente a parcela daquele
   PDF. Não havia a parcela atual de Géssica, Luiza (duas cotas), Juca (duas)
   e Pedro, embora os clientes já estivessem cadastrados. Géssica possui duas
   cotas históricas do mesmo número, com etapas diferentes; ambas são preservadas.
3. A DUO estava em `somente_controle`, sem previsão. O titular autorizou nesta
   conversa reconhecer as parcelas reais para Eroni. Isso não autoriza inventar
   cronograma futuro nem transformar o crédito antigo em faturamento de venda.
4. A RPC de vínculo manual chamava diretamente o sincronizador após o trigger
   313. Falta de saldo era capturada pelo trigger, mas a segunda chamada
   levantava novamente a exceção e revertia todo o vínculo. O PDF de 05/10 tem
   R$ 9.318,00 em linhas para R$ 8.352,58 recebidos: diferença R$ 965,42.
5. O seletor oferecia comissões de todas as cotas da administradora. Seleções
   de outra cota eram corretamente rejeitadas no banco, mas oferecidas pela UI.
   O vínculo válido de Mônica foi reproduzido com sucesso sob rollback; não
   foi comprovada falha geral de permissão ou assinatura da RPC 242.

## Correção

Migration forward-only 322, sem backfill embutido:

- Importação e releitura compartilham identificação por empresa, administradora,
  grupo/cota normalizados, titular, etapa e saldo. Competência prevista diferente
  gera informação, preservando o cronograma original. Ambiguidade impede vínculo
  automático; valor ou titular divergentes continuam em atenção.
- Parcela ausente de cadastro mínimo por PDF pode continuar na cota existente,
  conservando o participante e seu percentual explicitamente registrados na
  etapa anterior. Empates e regras sem evidência continuam para decisão manual.
  Não são copiadas baixas, pagamentos ou conferências da parcela anterior.
- Cadastro manual da parcela também reutiliza a cota, em vez de duplicar venda.
  A atualização de comissão fica restrita à nova previsão; parcelas pagas da
  mesma venda não são alteradas.
- Autorização da DUO é registrada em livro append-only por cota, empresa,
  participante, autor e motivo. O bloqueio de comissões de controle só admite
  essa exceção para parcela identificada em PDF com recebimento real. Venda
  permanece `somente_controle=true` e `afeta_faturamento=false`. Demais cotas de
  controle continuam bloqueadas. Não há criação de parcelas futuras hipotéticas.
- Continuação usa imposto comprovado na etapa anterior; sem histórico, usa a
  configuração fiscal vigente na competência do reconhecimento. Ausência de
  configuração é erro explícito. No caso real, a alíquota é 17,5%.
- Manual e automático usam o tratamento 313 de saldo insuficiente. Vínculo é
  preservado, baixa fica pendente e o valor excedente não vira caixa/elegibilidade.
  A action comunica essa situação sem anunciar liquidação inexistente.
- UI limita opções ao mesmo grupo/cota (ou cota ainda sem número), sugere
  somente correspondência exata única e não envia ID obsoleto oculto quando
  filtros removem a seleção. A busca aceita acentos e zeros de identificação.

Permissões N:N e RPCs autenticadas preservadas. Helpers privados sem EXECUTE
para público, anônimo, autenticado ou service role. Nova tabela com RLS de
leitura tenant e sem escrita direta por usuário autenticado.

## Validação

- 22 testes em cinco arquivos aprovados: opções de vínculo, parser, tratamento
  de total divergente no PostgreSQL embarcado, assinatura RPC e modo antigos.
- TypeScript sem erros, ESLint direcionado sem erros e build Next.js aprovado.
- `supabase/tests/322_repasse_validacao_rollback.sql` executado junto da DDL,
  na mesma transação terminada em ROLLBACK, no banco canônico. Inclui chamadas
  com `SET LOCAL ROLE authenticated` e identidade real N:N do titular.
- Validados: dez novos vínculos de 15/10; continuidade de Pedro em 05/10;
  repetição sem novas previsões/baixas; vínculo manual válido; cota incorreta;
  outro tenant; privilégios; novo importador; manual sem saldo; imposto e
  elegibilidade, incluindo DUO para Eroni com R$ 618,75 líquidos.
- Hashes integrais antes/depois idênticos para clientes, vendas, cotas,
  recebimentos, caixa, pagamentos e previsões de participantes já pagas.
  Nenhum desses dados foi reescrito pelo teste de conciliação.

## População e pendências

No início, a linha 1 da Mônica já estava vinculada manualmente, após a captura
enviada. Restavam dez linhas sem previsão no PDF de 15/10 e três divergências
de valor: Orlei, Ramon e Ivani, cada uma R$ 1.332,60 no PDF e R$ 1.250,00 no
sistema. Essas divergências exigem decisão financeira e não são falha de vínculo.

Em 05/10, cinco cotas de Luiz Carlos não possuem venda/cota no banco e continuam
como cadastro pendente. Franciomar tem diferença de parcela/valor. A diferença
de R$ 965,42 entre soma e total do PDF permanece explícita.

## Publicação e reversibilidade

Migration 322 aplicada e registrada no Supabase canônico, junto da autorização
da DUO e da conciliação assistida dos dois relatórios, em transação única.
As verificações de preservação e repetição foram executadas antes do COMMIT.

Pós-check definitivo: 15/10 possui 15 linhas vinculadas, zero sem cadastro e
três divergências reais de valor. Foram resolvidos dez vínculos adicionais.
05/10 possui a parcela de Pedro vinculada, cinco cotas sem cadastro e uma
divergência de Franciomar. DUO: R$ 750,00 brutos, R$ 131,25 de imposto e
R$ 618,75 líquidos elegíveis para Eroni; nenhum pagamento foi criado.
Build, TypeScript, lint e os 22 testes direcionados aprovados.
Publicação da interface será confirmada após o deploy.
Uma correção de dados posteriores deve usar compensações e migration
forward-only; não excluir previsões, autorizações ou baixas históricas.
