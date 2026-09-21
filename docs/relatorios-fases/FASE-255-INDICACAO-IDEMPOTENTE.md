# Fase 255 — Envio idempotente de indicação

## Diagnóstico

O teste utilizou um telefone que já possuía `programa_indicacoes` pendente. A restrição canônica `UNIQUE (empresa_id, lead_id)` protege a atribuição da indicação e da futura comissão, mas a interface apresentava apenas uma mensagem genérica.

## Correção

- O envio agora consulta a indicação existente antes de inserir.
- Reenvios pendentes do mesmo indicador atualizam os dados comerciais e terminam com sucesso.
- Quando o lead pertence a outro indicador, o app informa claramente que o telefone já foi cadastrado por outro participante.
- O aviso oferece `Alterar telefone`, retorna ao primeiro passo e limpa somente o número conflitante, preservando as demais respostas do formulário.
- Indicações com venda ou fluxo em andamento continuam protegidas contra sobrescrita.
- Erros inesperados de banco passam a registrar código e contexto técnico no servidor, sem expor dados sensíveis ao navegador.

## Preservação

A restrição de unicidade e a atribuição canônica da comissão foram mantidas. Nenhuma duplicidade de comissão é criada.
