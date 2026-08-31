# Fase 173 — Vendas mensais e aplicação fiscal em lote

Data: 31/08/2026.

## Solicitação

Acrescentar dois cards em ERP → Minhas comissões (crédito vendido e quantidade
de cotas no mês), além de permitir aplicar uma alíquota fiscal cadastrada a
todas as comissões pendentes sem editar cada parcela.

## Implementação

- Dois cards adicionais, mantendo os quatro indicadores de comissão existentes.
- Vendas lidas diretamente de `vendas` e `venda_participantes`, com empresa e
  identidade comercial resolvidas no servidor. Não dependem da geração prévia
  de parcelas de comissão. As consultas são paginadas e deduplicadas por venda.
- Somente vendas confirmadas que afetam faturamento; importação histórica sem
  faturamento não aumenta a produção comercial. `valor_credito` já representa
  o total contratado e não é multiplicado novamente por `quantidade_cotas`.
- Quantidade de cotas usa `quantidade_cotas`, com fallback 1 para legado. O mês
  corrente é determinado em America/Cuiaba e os fatos são filtrados pela data
  de venda persistida, sem usar a competência de recebimento da comissão.
- Os cards de vendas permanecem no mês corrente; os filtros de recebimento
  continuam restritos aos indicadores e parcelas de comissão.
- Atalho administrativo em Minhas comissões para Regras de comissão → Fiscal.
- Prévia e confirmação de aplicação fiscal para todos os participantes da
  empresa, incluindo comissões importadas. A alíquota é escolhida explicitamente
  dentre as configurações ativas cadastradas; a interface informa que a operação
  inclui previsões anteriores à vigência e não altera as vigências em si.

## Diagnóstico fiscal

O motor canônico 127 grava a repartição comercial sobre o bruto, com parte da
informação fiscal apenas no snapshot da franquia. Já a importação 136 grava
bruto, alíquota, imposto e líquido no snapshot do participante, sem previsão da
franquia. A tela antes consultava somente o vínculo da franquia, deixando as
importações com traços nas colunas fiscais.

A tela agora lê o snapshot fiscal próprio das importações e da aplicação em
lote. O restante mantém a leitura histórica existente. Não há desconto feito
apenas no navegador: o líquido exibido continua sendo `valor_previsto` gravado.

## Segurança e integridade

Migration: `supabase/migrations/170_comissoes_aplicacao_fiscal_lote.sql`.

- Instala somente funções; não executa recálculo, backfill ou alteração de dados.
- `rpc_aplicar_imposto_comissoes_lote` exige sessão autenticada e
  `can_write_tenant_internal` para a empresa. Anônimo e service role não recebem
  permissão de execução. A Server Action valida também tenant ativo e acesso
  à rota de regras de comissão.
- Prévia não escreve; confirmação usa transação única, locks e auditoria central.
- Conservadoramente, preserva a venda inteira se qualquer previsão dela já tiver
  recebimento, elegibilidade, pagamento, conferência, suspensão ou cancelamento.
  Também preserva registros com itens financeiros históricos, mesmo estornados.
- Não altera caixa, pagamentos, recebimentos, estados de liquidação, percentuais
  comerciais ou regras. O recebível bruto da franquia é preservado.
- Reconhece bruto comercial do motor 127, bruto das importações 136 e registros
  antigos V2 identificados como calculados sobre líquido. Origem sem base fiscal
  segura fica sem alteração e aparece na contagem de vendas que exigem análise.
- Salva o bruto original no snapshot fiscal. Reaplicar ou escolher outra alíquota
  utiliza esse mesmo bruto, impedindo desconto cumulativo.
- Auditoria registra operador, configuração, valores anteriores e posteriores.
- Regras fiscais de geração de novas comissões não foram substituídas; esta é
  uma aplicação explícita em lote sobre previsões existentes.

## Validação

- TypeScript sem emissão: aprovado.
- Build Next.js de produção: aprovado.
- Suíte completa: aprovada (incluindo testes existentes do extrato fiscal).
- Testes PostgreSQL isolados com PGlite executam a migration e a RPC, cobrindo:
  prévia sem escrita, confirmação, repetição idempotente em valores, alteração
  de alíquota, legado, V2 líquido, rateio consultor/SDR, isolamento entre empresas,
  bloqueio de consultor/anônimo, permissões de execução, proteção de movimentos
  e rollback completo se a auditoria falhar.
- Testes dos cards cobrem múltiplas cotas, crédito total sem duplicação,
  participação duplicada, paginação, vendas sem previsões, falha de consulta,
  exclusão de importações sem faturamento e virada do mês corrente em Cuiabá.
- Lint dos novos módulos: aprovado; `git diff --check`: aprovado.

## Entrega e publicação

Alterações isoladas em `codex/minhas-comissoes-cards`, sem modificar os trabalhos
pendentes da cópia principal. Nenhuma comissão de produção foi recalculada.

A migration 170 precisa ser instalada no Supabase antes de disponibilizar a
nova ação. Em seguida, publicar a aplicação pelo fluxo existente de main/Vercel.
Não criar outro site, trocar hospedagem, alterar modelos visuais nem migrar dados.
Após publicação, o administrador escolhe a alíquota e confirma a aplicação na
interface; o trabalho de desenvolvimento não executa essa confirmação por ele.
