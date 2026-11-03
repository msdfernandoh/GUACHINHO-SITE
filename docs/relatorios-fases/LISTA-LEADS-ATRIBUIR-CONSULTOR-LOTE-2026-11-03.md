# Lista de leads — aplicar consultor aos selecionados — 03/11/2026

Botão existente Atribuir foi tornado explícito: Aplicar consultor aos selecionados,
com contagem e destaque azul. Botão Selecionar todos desta lista e instrução
visível complementam os checkboxes individuais. Aplicação requer seleção e consultor.

Action valida IDs no tenant e consultor elegível na empresa ativa, deduplica IDs,
retorna quantidade de registros efetivamente atualizados e relata eventual
atribuição parcial em vez de sucesso total. Histórico somente para linhas retornadas.
Invalida Lista/CRM/Pipeline e atualiza a lista após sucesso.
Preserva regras de leitura/escrita e RLS; não habilita service role.
Sem migration ou alteração de leads reais na validação.
TypeScript aprovado; homologação autenticada pendente.
