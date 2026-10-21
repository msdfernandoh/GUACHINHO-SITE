# Checagem de contas possivelmente repetidas — 20/10/2026

## Pedido e regra de identificação
Disponibilizar lista para checagem de contas de mesmo valor e fornecedor no
mesmo mês de ocorrência, com opção de manter ou excluir.
Mês de ocorrência usa competencia (AAAA-MM); na ausência de valor válido, usa
mês do vencimento. Data de pagamento não muda a competência dessa análise.
Fornecedor comparado por nome sem diferença de acentos, caixa e espaços
repetidos. Nomes diferentes não são aproximados por similaridade. Valores são
comparados em centavos. Contas sem fornecedor, canceladas ou excluídas não
entram; abertas e pagas podem compor o mesmo grupo. São possíveis duplicatas,
não diagnóstico definitivo nem autorização de exclusão automática.

## Interface
Painel Possíveis contas repetidas em /erp/contas-pagar, acima dos filtros de
compromissos. Botão Analisar contas inicia checagem sob demanda. Mostra número
de contas analisadas, grupos pendentes e lista com descrição, ID, observação,
vencimento, situação, pagamento e valor. Cada conta tem Manter e Excluir.
Dez grupos por página; nenhuma consulta de análise massiva no primeiro render.
Checkbox permite exibir grupos já inteiramente conferidos.

Excluir abre confirmação com motivo obrigatório. Se a conta é paga, explica
possível estorno e autorização exigida. A operação chama excluirConta, que usa
rpc_excluir_conta_pagar: exclusão lógica auditada, permissão para contas pagas
e bloqueios de corte preservados. Nenhuma exclusão automática ou DELETE novo.

## Persistência da decisão Manter
Reutilizada financeiro_contas_pagar_logs com ação ALTERACAO e detalhes.tipo
CONFERENCIA_DUPLICIDADE_MANTER. O log registra usuário, empresa, conta,
fornecedor, valor, mês, IDs do grupo e revisão SHA-256 do snapshot. A descrição
do motivo esclarece que se trata de conferência, sem alteração da despesa.
Não foi introduzida tabela/migration nem alterada constraint de ação do log.

Somente marca como mantida a revisão exata conferida pelo operador. Quando
surge nova ocorrência ou muda valor, fornecedor, competência, descrição,
vencimento, status, pagamento ou observação do grupo, nova conferência passa
a ser necessária. Um grupo some da fila pendente quando todos os itens foram
mantidos ou quando exclusão/alteração deixa apenas uma ocorrência.

Antes de manter/excluir, o servidor reconsulta a empresa e exige que revisão e
conta ainda existam no mesmo grupo. Tela desatualizada é recusada. A exclusão
canônica ainda revalida autorização e conta na sua própria transação. A análise
e decisão Manter não têm snapshot transacional entre todos os lotes; mudança
concorrente posterior não altera dados e invalida a conferência na próxima
análise, por assinatura diferente. Repetição simultânea de Manter pode produzir
dois logs equivalentes, sem duplicar valor, despesa ou efeito financeiro.

## Isolamento e escala
Actions exigem módulo contas-pagar, gerenciar_financeiro e empresa ativa
coincidente. Leituras usam sessão do usuário com RLS e filtro empresa_id em
ambas as tabelas. Empresa e autor não vêm do cliente. Gravar a decisão Manter
revalida can_write_tenant_internal e usa cliente administrativo apenas para
inserir o log auditado. Nenhum pagamento, imposto ou movimento é criado aí.

A varredura ocorre no servidor em lotes de 500 com ordem por ID, sobre contas
e logs da empresa; a resposta à tela contém dez grupos. Não usa a página atual
da consulta normal, evitando perder duplicatas entre páginas. Limite defensivo
cerca de 100 mil registros em cada varredura gera erro explícito em vez de
apresentar resultado parcial. Para volumes maiores recomenda-se RPC de
agregação paginada no banco; essa otimização não é necessária ao volume atual.

## Validação
- 13 testes direcionados aprovados: normalização, centavos, competências,
  abertas/pagas, exclusões, decisão por snapshot, alteração/nova ocorrência,
  varredura além do primeiro lote, isolamento tenant, permissão, log com autoria,
  recusa de decisão desatualizada e delegação à exclusão canônica.
- TypeScript e lint direcionado aprovados sem novos avisos.
- Análise real somente leitura no Supabase: 171 contas, 1 grupo suspeito com
  2 ocorrências, competência 2026-09. Schema e consulta JSON de logs confirmados.
- Nenhuma conta foi excluída ou mantida automaticamente; teste remoto não gravou.
- Suíte completa: 354 arquivos aprovados, 9 opt-in ignorados; 1.834 testes
  aprovados, 37 ignorados, zero falhas.
- Build final e TypeScript aprovados após callback que atualiza a lista principal
  e seus totais ao concluir uma decisão. Lint global aprovado com zero erros e
  328 avisos preexistentes, abaixo do teto original 353.
- git diff --check aprovado. Código enviado à main sob autorização de publicação
  mantida nesta conversa. Implantação e interação autenticada em produção ainda
  não homologadas nesta fase.
