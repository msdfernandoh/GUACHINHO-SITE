# Repasse com total divergente — 18/10/2026

## Solicitação e diagnóstico

Permitir importar o relatório, todas as cotas e seus valores, mantendo a diferença
para conferência. Caso informado: soma das linhas de R$ 9.318,00, total do PDF de
R$ 8.352,58 e diferença de R$ 965,42. A competência pode possuir vários repasses,
inclusive nos dias 5, 15 e 25.

O parser interrompia o fluxo antes do Storage e da RPC quando a soma divergisse
mais de R$ 0,02. Além disso, a sincronização automática introduzida na migration
282 podia tentar completar uma linha além do saldo real do recebimento, lançando
erro e revertendo a transação de importação ou releitura.

## Implementação

- Parser mantém as linhas e o total original do PDF, gravando aviso em `alertas`.
  Comparação de totais usa centavos, mantendo a tolerância de R$ 0,02.
- Action retorna sucesso, ID da conferência e alertas. Mensagem de divergência
  diferencia importação da baixa efetiva das linhas. Modo antigo também retorna
  alertas, sem mudar sua ausência de receita/comissão.
- Consulta carrega os alertas já persistidos no cabeçalho do relatório. Tela
  apresenta soma, total recebido e diferença ao reabrir, e identifica relatórios
  divergentes como recebidos com atenções abertas.
- Migration 313 introduz wrapper privado para a sincronização canônica 203 e o
  reutiliza no processamento por importação e no trigger de linhas da fase 282.
  Captura somente a exceção conhecida de saldo insuficiente; o sub-bloco
  transacional desfaz apenas a tentativa da linha. Preserva linhas, recebimento,
  vínculos e baixas válidas, registrando alerta sem duplicação e status PENDENTE.
  Demais exceções continuam propagadas, inclusive erros de tenant e pagamentos.
- A soma das linhas não substitui a entrada financeira. Não se gera crédito de
  caixa fictício nem se liquida acima do total efetivamente recebido.
- Vários PDFs no mês já eram permitidos: a identidade do relatório é empresa +
  hash, não empresa + competência. Essa regra foi preservada.

## Validação

- 14 testes aprovados em `repasse-racon-parser.test.ts`,
  `repasse-antigos-action.test.ts` e `repasse-divergencia-total-database.test.ts`.
- Cobertura de soma acima/abaixo do total, caso R$ 9.318,00 / R$ 8.352,58,
  preservação de itens, alertas retornados e abertura da conferência, três
  arquivos distintos na mesma competência e fluxo antigo preservado.
- Migration 313 compilada e executada em PostgreSQL embarcado PGlite com tabelas
  mínimas e rotina financeira simulada. Testes exercitam registro do recebimento,
  trigger de linha, rollback da tentativa sem saldo, baixa sem duplicação,
  releitura, alerta único e propagação de erro diferente de falta de saldo.
- `npx tsc --noEmit`: aprovado.
- ESLint direcionado: zero erros; sete avisos preexistentes nos componentes.
- Suíte ampliada de repasse: 57 testes aprovados e oito falhas em seis arquivos
  contratuais antigos. As mesmas oito falhas foram reproduzidas em cópia isolada
  das fontes e testes de HEAD, antes deste ajuste. São expectativas textuais
  obsoletas de fases 182, 184, 186, 197, 198 e reabertura; não foram alteradas
  para ampliar o escopo desta correção.
- Nenhuma escrita em produção ou nos dados operacionais foi realizada. A imagem
  foi usada como referência do erro; o PDF original não foi fornecido para
  homologação de sua extração completa.

## Entrega e publicação

Correção local concluída. Para ativar em produção, aplicar isoladamente a
migration 313 e publicar o frontend/actions correspondentes. Não aplicar em
bloco outras migrations pendentes ou alterações paralelas do workspace. A
publicação, aplicação remota e teste autenticado com o PDF real permanecem
pendentes; nenhum sucesso em produção é afirmado por este relatório.

Dados existentes, autorização N:N, escopo por empresa, hash de idempotência e
livros append-only permanecem preservados. Não há backfill, exclusão ou migração
de dados nesta entrega.

## Retomada autorizada — envio à main

O titular solicitou aplicar e enviar à main. A verificação remota encontrou a
migration 313 já registrada no Supabase canônico `eaeuoynprurmmulzhydt`, com o
nome `repasse_divergencia_total_nao_bloqueante`. Não foi necessário reaplicá-la.
Os corpos das três funções correspondem exatamente aos locais:

| Função | MD5 de prosrc local = remoto |
| --- | --- |
| tentar_sincronizar_item_repasse_313 | 56b01bec17e7d8ac6791b1dddfddf52e |
| sincronizar_importacao_repasse_canonica_282 | d42333ad98c4e0c679b89d1db1d78b58 |
| trg_sincronizar_item_repasse_282 | 6f9afca97879dfd7496dd6ac0e49221e |

Helper confirmado como SECURITY DEFINER com search_path=pg_catalog e sem
EXECUTE para anon/authenticated. Os triggers da importação e das linhas estão
presentes. A rotina canônica 203 mantém a exceção específica de falta de saldo.
Os 14 testes e TypeScript foram novamente aprovados antes do envio. Somente os
arquivos deste hotfix são incluídos no commit; alterações paralelas de
Assembleias, Robôs, tipos e outras migrations permanecem fora desta entrega.

## Publicação concluída

- Commit `b695b65af762cb160059eb5eb7f6fa22472a06c6` enviado a `origin/main`.
  O hash remoto foi conferido após o push.
- Deploy automático da integração GitHub/Vercel, com clone do commit correto,
  build Next.js e TypeScript concluídos: `dpl_Ca2TndfkReUViGdY8ZiiuYbovpTw`,
  estado READY, target production. URL de evidência:
  `https://guachinho-site-4e6egn249-hugo-8097s-projects.vercel.app`.
- Domínio `www.gauchinhoconsorcios.com.br` confirmado entre os aliases desse
  deployment. Nenhum deploy do workspace com alterações paralelas foi feito.
- Smoke autenticado de produção em `/erp/repasse-franquia`: HTTP 200,
  416.568 bytes, com importador PDF, relatório em conferência, histórico e
  Central de atenção presentes. Sessão temporária criada sem envio de e-mail
  e encerrada com escopo local; sessões existentes preservadas.
- Migration 313 confirmada aplicada e funções idênticas ao arquivo local,
  conforme a seção anterior. Não houve reaplicação nem escrita em fatos de
  negócio durante esta retomada.

O sistema publicado contém a correção. O upload do PDF real do erro não foi
executado porque foi fornecida somente a captura de tela. Esse caso poderá ser
reenviado pelo operador; não foi criado recebimento fictício para homologação.
