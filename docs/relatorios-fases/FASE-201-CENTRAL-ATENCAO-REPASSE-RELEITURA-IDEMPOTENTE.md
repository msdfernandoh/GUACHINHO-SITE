# Fase 201 — Central de atenção do repasse e releitura idempotente

Data: 01/09/2026

## Objetivo

Transformar divergências de repasse em filas operacionais de conferência, sem
bloquear o registro do relatório ou do recebimento financeiro.

## Entrega

- aba **Não vinculadas/cadastradas** para linhas do PDF ainda sem correspondência,
  com vínculo manual ou cadastro mínimo já disponível;
- aba **No sistema, fora do relatório** para previsões possivelmente inadimplentes,
  com opção auditável de aguardar o próximo relatório ou cancelar a cota aplicando
  a curva de estorno existente;
- aba **Valores divergentes** com sistema, relatório e diferença lado a lado;
- quando o sistema é maior, **Gerar crédito** baixa somente o valor recebido e
  mantém o saldo da previsão para um relatório futuro;
- **Dar por ajustado** registra a decisão e, quando o PDF é maior, classifica apenas
  o excedente como `AJUSTE_ADMINISTRADORA` no mesmo recebimento;
- o relatório e a entrada financeira deixam de depender da resolução das atenções;
- o mesmo PDF pode ser reenviado para atualizar a leitura sem duplicar importação,
  recebimento ou caixa;
- relatórios persistidos oferecem **Atualizar leitura**, dispensando novo upload.

## Banco e segurança

A migration `195_repasse_abas_atencao_resolucoes.sql` cria o livro append-only
`erp_repasse_atencao_resolucoes` e duas RPCs tenant-aware:

- `rpc_resolver_atencao_repasse` registra decisões idempotentes e reutiliza os fluxos
  financeiros/cancelamento existentes;
- `rpc_reprocessar_repasse_racon` reavalia somente itens `ATENCAO` ou
  `NAO_ENCONTRADO`; vínculos e baixas anteriores não são reescritos.

As funções exigem autenticação e `gerenciar_financeiro`, validam empresa,
administradora, importação, item, previsão e cota. A nova tabela concede apenas
leitura tenant-aware ao papel autenticado; escrita ocorre exclusivamente pela RPC.

## Preservação

Nenhuma importação, linha, recebimento, movimento de caixa ou previsão histórica é
apagada. Cancelamento usa a RPC canônica da cota e sua curva de estorno. Reenvio por
hash retorna a importação existente e executa apenas a releitura das pendências.

## Validação concluída

- 8 testes dos contratos novo e anterior aprovados;
- ESLint dos arquivos tocados sem erros;
- TypeScript completo sem erros;
- build de produção aprovado com 150 rotas;
- histórico remoto alinhado em 001–194 antes da implantação;
- dry-run confirmou somente a migration 195;
- migration 195 aplicada com sucesso no projeto Supabase vinculado em 01/09/2026.
