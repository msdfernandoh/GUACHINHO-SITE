# Relatório de fase — Conversas WhatsApp unificadas e disparo sequencial no CRM

**Data:** 04/11/2026  
**Escopo:** Gauchinho Site, exclusivamente no checkout `gauchinho-app`.

## Diagnóstico

O checkout atual já possuía a infraestrutura WhatsApp Cloud API, mas a página
ERP mostrava apenas o histórico linear. O botão de WhatsApp do card do CRM
abria `wa.me`, criando uma experiência diferente da página ERP. Também não
havia uma ação canônica para enviar o template dos leads de uma fase do Kanban;
qualquer implementação de disparo direto no cliente poderia contornar tenant,
RLS e reserva idempotente.

## Correções

- Criado `WhatsappConversations`, com lista de contatos, conversa selecionada,
  histórico e composer reutilizável na página ERP e nos atalhos do CRM.
- Criado `WhatsappFloatingDock`, com altura limitada pela viewport, `min-h-0`,
  áreas internas roláveis e composer no rodapé; isso impede a quebra observada
  quando o painel é aberto dentro de CRM/gerencial.
- O balão do card CRM abre `/erp/whatsapp` com o contato selecionado, em vez de
  sair para `wa.me`; o mesmo painel é usado no dock flutuante.
- Criado `/api/erp/whatsapp/disparar-leads`: valida a empresa pela sessão,
  consulta somente os leads do tenant, usa a instância conectada, reserva cada
  envio pela RPC `whatsapp_reservar_envio` e envia um template por vez pela
  Cloud API. Não há limite artificial de quantidade: o conjunto é exatamente o
  filtro do vendedor na fase. Telefones inválidos são reportados individualmente.
- O Kanban ganhou a ação “Enviar template” em cada fase, com acompanhamento do
  resultado e link para o histórico de Conversas WhatsApp.

Nenhuma migration, alteração de dados existentes ou alteração de RLS foi feita.
Nenhuma mensagem real foi enviada durante a validação local.

## Validação

- `npx tsc --noEmit`: aprovado.
- Testes direcionados Kanban + rotas WhatsApp: **12 aprovados**.
- ESLint direcionado nos arquivos alterados: aprovado sem erros.
- O fluxo real de Meta/telefone conectado permanece dependente de homologação
  autenticada pelo titular; a validação local não substitui esse teste.

## Preservação e pendências

Tenant segue pela sessão e `empresa_id`; não foi presumido `auth.uid()` como
consultor. A reserva/cota já existente do SaaS e as políticas da Meta continuam
válidas. Recomenda-se homologar com poucos leads filtrados, conferir o histórico
após cada lote e não repetir registros com status `unknown` sem conferência.
