# Fase 168 — Aprovação e consolidação segura de grupos

## Problema confirmado

O cadastro local do grupo `1553 IMÓVEL` foi enviado nove vezes em uma janela de
18 segundos antes da proteção idempotente da Fase 167. Ao aprovar qualquer item,
a rotina reaplicava os campos cadastrais no registro local. O gatilho de chave
natural era executado mesmo sem mudança desses campos e encontrava as outras
cópias, interrompendo a promoção para o catálogo global.

## Auditoria antes da correção

- nove solicitações pendentes, com empresa, administradora, tipo, código e
  payload idênticos;
- cada cópia continha exclusivamente seus dados cadastrais, cinco créditos,
  modalidade de lance, tabela comercial e histórico de criação;
- nenhuma cópia possuía simulação, contratação, venda, assembleia, reajuste,
  categoria, vínculo legado ou outro uso comercial;
- o registro mais antigo foi escolhido como principal e preservado.

## Correção

1. A migration 167 remove somente as oito IDs duplicadas auditadas. O bloco é
   transacional, idempotente e cancela toda a operação se o lote ou suas relações
   divergirem da auditoria.
2. O registro principal e sua solicitação permanecem pendentes para a decisão
   normal do Platform Superadmin.
3. O gatilho de duplicidade continua bloqueando inserts e mudanças reais da
   chave natural, mas ignora atribuições idempotentes durante a aprovação.
4. A tela de aprovações bloqueia cliques repetidos, valida a observação de
   devolução/rejeição e exibe a mensagem real da operação na própria solicitação.

## Preservação

Nenhuma proposta, venda, contratação ou grupo legítimo foi alterado. A limpeza
foi limitada ao incidente confirmado e não cria rotina genérica de exclusão em
massa. A proteção da Fase 167 permanece ativa para novos cadastros.

## Verificação

- teste de contrato da migration, da trava de segurança e do formulário;
- TypeScript, ESLint, suíte Vitest e build de produção;
- conferência pós-migration do único grupo local e da única solicitação restante.
