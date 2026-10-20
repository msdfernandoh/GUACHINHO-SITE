# Crédito dos sócios pelo repasse recebido — 20/10/2026

## Solicitação
Reconhecer a comissão do sócio na empresa tão logo o repasse vinculado seja
recebido, conferido ou não, mantendo seu crédito até a transferência efetiva.
Expor gastos, saldo da empresa e comissão/crédito/débito por sócio.

## Implementação
- Crédito derivado de financeiro_recebimento_itens de recebimentos confirmados,
  vinculado à previsão de participante e ao usuário de empresa_socios. Valor
  líquido do snapshot proporcional ao repasse alocado; sem regra percentual nova.
- Competência do demonstrativo pela data do recebimento. Reversões negativas do
  livro compensam o crédito; baixa da comissão não é somada novamente.
- Transferências entre conta PJ e conta vinculada ao participante, e pagamentos
  com saída PJ comprovada, reduzem o direito. Devoluções/estornos recompõem o
  direito. Crédito interno sem saída PJ não constitui transferência.
- Pagamentos estornados continuam consultados para identificar seus movimentos
  compensatórios; composição de pagamentos considera somente confirmados.
- Previsões aguardando liberação excluem a parcela já recebida, mesmo sem baixa.
- Resumo atual independente das retiradas simuladas: despesas, saldo registrado,
  saldo após despesas pendentes, comissões e crédito/débito individual.
- Cálculo e action de lacre compartilham a dedução de transferências históricas;
  estas não são descontadas novamente do saldo bancário atual.

## Preservação e limites
Sem migration, backfill, gravação financeira ou exclusão de dados. Envio do código à main autorizado pelo titular em 20/10/2026.
Cortes lacrados preservados. Queries usam a empresa ativa e vínculo do sócio pelo
usuario_id do participante, sem presumir identidade com auth.uid().
Mantido o bloqueio do lacre quando houver contas pagas sem saída: a posição de
caixa continua explicitamente sujeita à conciliação. Identificação de retirada
exige vínculo bancário/financeiro; descrição textual isolada não basta.

## Validação
Testes direcionados cobrem recebimento parcial, ausência de recebimento,
reversões, crédito/débito após rateio e transferências, baixa interna sem saída,
estorno, devolução e recorte de datas. Resultados: 8 testes aprovados em 2 arquivos; TypeScript sem erros; lint direcionado sem erros ou avisos; build Next.js de produção aprovado. git diff --check aprovado. Sem homologação autenticada em produção nesta fase.

Atualização do pedido de impostos: o resumo identifica por sócio o imposto
persistido no snapshot fiscal, proporcional ao repasse recebido no período.
Exibe comissão líquida, imposto separado e soma dos dois como origem do caixa.
A reserva fiscal atual continua sendo o controle canônico acumulado, já líquido
das guias pagas com reserva; impostos gerados no período não são somados
novamente ao saldo bancário nem ao crédito disponível para retirada do sócio.

## Validação para envio à main
- main local e origin/main sincronizadas antes da alteração (0 commits de diferença).
- Testes específicos: 8/8; TypeScript, lint direcionado e build de produção aprovados.
- Suíte completa: 330 arquivos aprovados, 19 com falha, 9 ignorados;
  1.765 testes aprovados, 24 com falha e 55 ignorados.
- Os 19 arquivos com falha foram executados em snapshot limpo de HEAD/main:
  17 falharam e 2 passaram; 24 testes falharam e 79 passaram nesse recorte.
  Falhas de contratos/cálculos também ocorrem no baseline; SEO e homologação
  de eventos variaram entre execuções. O baseline apresentou ainda uma falha
  de contrato de repasse que não ocorreu na execução completa.
- Não foram alterados módulos alheios para corrigir a suíte histórica.
- Build não substitui homologação autenticada nem confirma implantação Vercel.

## Refinamento do demonstrativo por solicitação do titular
O card mostra comissão antes de impostos, imposto separado, comissão líquida,
parte das despesas e crédito para receber em transferência. Saldo anterior,
aportes e transferências efetivas aparecem quando existentes. Teste do exemplo
R$ 20.000 recebidos - R$ 2.000 impostos - R$ 10.000 despesas = R$ 8.000 crédito
aprovado. O imposto não é descontado novamente da comissão já líquida usada no motor.

## Diagnóstico das falhas gerais (sem alteração de regras alheias)
1. Seis divergências numéricas em calcular-linha-grupo.test.ts (3) e
   simulacao-linha.test.ts (3). Prioridade de investigação: comparar catálogo
   oficial e fixtures com a precedência de parcela persistida. Exemplo: fixture
   informa parcela_integral 4772,73 mas espera cálculo 5918,18; motor atual
   prioriza a parcela persistida. Não foi comprovado erro de produção.
2. grupos-cadastro-completo-154-contract espera [60], enquanto código retorna
   [50,60], coerente com a atualização documentada de modalidades de 20/10.
3. empresa-usuarios-relations referencia migration 301 inexistente; arquivo
   canônico é 314_permitir_fechamento_socios_acesso_erp.sql.
4. Contratos textuais de assembleias, repasse, formalização, login e menus:
   falham procurando frases, chamadas ou trechos exatos ausentes/refatorados.
   Precisam verificar comportamento atual antes de atualizar expectativas.
   Ausência de um trecho literal não comprova ausência funcional.
5. SEO: timeout de 5 segundos. Homologação de eventos: timeout no hook de
   10 segundos. Ambos passaram no recorte baseline e precisam isolamento de
   dependências/ambiente, sem apenas aumentar timeout indiscriminadamente.

Essas pendências são independentes do demonstrativo societário; não foram
silenciadas nem alteradas regras comerciais para obter suíte verde.
