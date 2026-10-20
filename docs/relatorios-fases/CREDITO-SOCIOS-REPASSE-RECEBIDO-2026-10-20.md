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
