# ERP — Importação de contas, sócios pagadores, permissões e ajustes de caixa

Data: 14/08/2026  
Migration: `077_erp_importacao_socios_permissoes.sql`  
Estado: aplicada no Supabase principal em 14/08/2026; homologação funcional autenticada ainda pendente.

## Escopo entregue

- Importação CSV de contas pagas e a pagar, com modelo público e leitura do formato legado analisado em `analise/todas_as_contas_2026-08-14.csv`.
- Idempotência por origem/chave de importação, criação controlada de bancos e centros de custo ausentes e indicação de linhas de valor zero para revisão.
- Seleção individual ou em lote de contas para associar/remover o sócio pagador, sem gerar estorno e sem alterar movimento de caixa já registrado.
- Sócios pagadores definidos no vínculo N:N `empresa_usuarios`; Fernando e Eroni são habilitados inicialmente apenas na empresa `gauchinho`.
- Visibilidade individual dos menus do ERP também em `empresa_usuarios`. Menu desmarcado é removido da navegação e bloqueado nas rotas diretas, inclusive subrotas explícitas.
- Inclusão manual append-only de entrada ou saída no Livro Razão por RPC tenant-aware.
- Cadastro de banco e centro de custo com autorização controlada e retorno de sucesso/erro na própria tela, evitando falha silenciosa ou quebra da página.

## Decisões de integridade

- `usuarios` continua sendo identidade global; `socio_pagador` e `erp_modulos_visiveis` pertencem ao vínculo empresa–usuário.
- Associação retroativa de sócio é classificatória para o fechamento visual entre sócios. Ela não cria, apaga, edita nem estorna `caixa_movimentos`.
- Baixa futura paga pessoalmente mantém a regra já existente de não movimentar o caixa da empresa.
- Ajustes manuais usam somente inserção com `origem_tipo = 'ajuste_caixa'`; não foi criada operação de edição ou exclusão.
- Importações repetidas não duplicam contas que possuam a mesma chave no mesmo tenant e origem.

## Modelo CSV

O download está disponível em `/modelos/modelo_importacao_contas.csv`. As linhas iniciadas com centro de custo `EXEMPLO` são ignoradas pelo importador e servem somente como documentação do formato.

## Segurança

- Escritas financeiras exigem vínculo ativo e `can_write_tenant_internal`.
- Só é aceito como pagador o usuário ativo marcado como sócio no mesmo tenant.
- Rotas dinâmicas validam o módulo individual; rotas explícitas e suas subrotas usam layouts de autorização.
- O banco valida por trigger a associação de sócio da mesma empresa.
- A migration é forward-only e não remove dados existentes.

## Validação local

- `npm exec tsc -- --noEmit --pretty false`: PASS.
- `npm test -- --run`: PASS — 127 arquivos aprovados, 9 ignorados; 723 testes aprovados, 37 ignorados.
- `npm exec next -- build --webpack`: PASS — 127 páginas geradas. O build Turbopack não foi usado no worktree porque o `node_modules` compartilhado é uma junção externa à raiz aceita pelo Turbopack.
- ESLint dos arquivos alterados: PASS. A varredura ampliada de todo o diretório ERP ainda encontra `any` explícitos preexistentes nas telas de clientes e minhas comissões, fora deste escopo.
- Testes novos cobrem parsing do CSV legado, campos com ponto e vírgula entre aspas, contas pendentes, valor para revisão e resolução de permissões por usuário.
- Validação direta do arquivo `todas_as_contas_2026-08-14.csv`: 77 contas lidas sem erro, sendo 17 pagas, 60 abertas e 1 linha de valor zero sinalizada para revisão.

## Pendências operacionais

1. Aplicar a migration `077` no Supabase do ambiente escolhido antes de publicar a interface.
2. Homologar com sessão real: importação do arquivo completo, associação em lote a Fernando/Eroni, bloqueio por URL e lançamento de entrada/saída.
3. Não promover para Produção sem backup e autorização operacional correspondente.

## Correção de execução da migration 077

- A primeira tentativa no SQL Editor foi revertida pelo trigger
  `validar_papel_empresa_usuario`, pois a regra da migration 043 tratava qualquer
  `UPDATE` de vínculo PLATFORM como alteração de papel.
- A migration 077 agora substitui essa função mantendo a exigência de
  SuperAdmin quando `papel_id`, `empresa_id` ou `ativo` mudarem, mas permitindo
  alterações em campos auxiliares como `socio_pagador`.
- O trigger não foi desativado e a proteção de atribuição, remoção, rebaixamento
  ou desativação de papéis PLATFORM permanece ativa.
- Após a correção, a migration foi executada no Supabase principal. Consultas de
  leitura confirmaram as novas colunas de `empresa_usuarios`, os campos de
  importação, a view `financeiro_fechamento_socios` e os vínculos de FERNANDO e
  Eroni Bolfe como sócios pagadores somente na tenant `gauchinho`.
- A verificação não criou contas, movimentos de caixa ou dados de homologação.
