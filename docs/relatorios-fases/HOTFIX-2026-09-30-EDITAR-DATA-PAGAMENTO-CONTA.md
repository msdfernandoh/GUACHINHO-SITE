# Hotfix — edição da data do pagamento da conta

## Objetivo

Permitir que o usuário Master corrija a **Data do pagamento** diretamente no
modal **Editar conta**, tanto no Fechamento dos Sócios quanto em Contas a
Pagar.

## Implementação

- O formulário recebe o campo civil `pago_em` no formato `AAAA-MM-DD`, já
  preenchido com a baixa atual.
- A Server Action valida o formato e envia a data à RPC tenant-aware.
- Somente conta com status `paga` mantém data de pagamento; a data não pode
  estar no futuro.
- A mudança do fato financeiro exige usuário Master da empresa. Operadores
  financeiros continuam autorizados a editar somente os dados cadastrais já
  previstos pela governança.
- A alteração registra `data_pagamento` em `campos_alterados`, além dos valores
  anterior e novo no log da conta.
- Quando a baixa possui saída de caixa vinculada, o livro razão não é
  reescrito: uma entrada compensatória neutraliza a saída anterior e uma nova
  saída é criada na data corrigida. O saldo total permanece igual.
- O bloqueio do fechamento lacrado permanece ativo. Datas pertencentes a um
  corte já fechado não podem ser alteradas.

## Multiempresa e segurança

O tenant continua vindo da sessão e do host por `requireFinanceWrite`; o
formulário não informa `empresa_id`. A conta e o movimento de caixa são
localizados pelo par `empresa_id + id`, sob lock transacional. A nova assinatura
da RPC exige sessão autenticada e não concede execução a `anon` nem
`service_role`.

## Banco de dados

Migration forward-only:

- `301_editar_data_pagamento_conta_pagar.sql`.

Não há backfill, exclusão ou recálculo automático de contas existentes.

## Validação

- Teste contratual dedicado: `3/3` testes aprovados, cobrindo os dois
  formulários, autorização Master, auditoria, correção append-only e bloqueio
  de data futura.
- `npx tsc --noEmit`: aprovado.
- ESLint dos arquivos alterados: sem erros; permanecem 7 avisos preexistentes
  de `no-explicit-any` em `contas-pagar/actions.ts`.
- `npm run build`: aprovado, com compilação e geração estática concluídas.
- Suíte completa: `325` arquivos e `1.728` testes aprovados; `13` testes
  contratuais antigos falham em áreas não alteradas por este hotfix.
- Migration `301` aplicada no projeto Supabase de produção e registrada no
  histórico de migrations. A assinatura de 12 parâmetros foi conferida com
  execução liberada somente para `authenticated`.

## Roll-forward

Em caso de problema de aplicação, a interface pode deixar de enviar o novo
campo sem remover a função. Correções de banco permanecem forward-only; a
migration aplicada não deve ser editada ou revertida destrutivamente.
