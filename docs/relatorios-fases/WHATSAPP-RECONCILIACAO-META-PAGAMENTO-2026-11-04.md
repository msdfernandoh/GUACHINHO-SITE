# Relatório de fase — Reconciliação de telefone WhatsApp confirmado pela Meta

**Data:** 04/11/2026  
**Escopo:** tela Platform → WhatsApp → Contas e instâncias e fluxo Embedded Signup.

## Diagnóstico

O endpoint de conexão tratava qualquer falha posterior à troca do código como
falha total e atualizava a instância para `erro`. Isso podia ocorrer depois de
a Meta já ter aceitado o token e ativado o `phone_number_id`, especialmente
quando o Embedded Signup interrompia a configuração de cobrança/assinatura.
Assim, o telefone podia estar ativo na Meta e inativo apenas na leitura local.

## Correção

- O fluxo agora guarda o token temporariamente durante a conexão.
- Se uma etapa posterior falhar, consulta novamente o `phone_number_id` na Graph
  API com `display_phone_number`, `verified_name`, `quality_rating` e `status`.
- Se a Meta confirmar o telefone, `salvarConexao` persiste WABA, telefone, token,
  número exibido e status `conectado`; a pendência de pagamento/assinatura não
  derruba mais a ativação local.
- Só marca `erro` quando a reconciliação secundária também não confirma o
  telefone, com mensagem específica para autorização, ativos ou pagamento.
- A ação server-side `sincronizar_meta` permite reconfirmar uma instância já
  persistida, sem alterar RLS, tenant ou dados históricos.

Não foi feita migration nem alteração remota de dados durante esta fase.

## Validação

- `npx tsc --noEmit`: aprovado.
- A suíte direcionada anterior de CRM/WhatsApp permanece aprovada (12/12).
- Nenhum envio ou alteração de cobrança foi executado na Meta pelo teste local.

## Limite operacional conhecido

Se a tentativa original falhou antes de o sistema persistir qualquer token,
não é possível reconfirmar o telefone retroativamente sem uma nova autorização
da Meta. Nesse caso, basta repetir a conexão; se o telefone for confirmado pela
Meta e a cobrança ficar pendente, o novo fluxo salvará a instância como ativa.
