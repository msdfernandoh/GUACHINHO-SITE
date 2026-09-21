# Fase 254 — Sessão consistente e troca de usuário no app do indicador

## Problema

O painel do indicador aceitava um participante vinculado ao usuário, mas a finalização da indicação repetia a busca com critérios diferentes. Cadastros legados com status em capitalização distinta ou mais de um vínculo histórico podiam abrir o painel e falhar no envio com “cadastro de indicador não foi localizado”. O painel também não oferecia uma saída visível da conta.

## Implementação

- Criado um resolvedor único e multi-tenant para localizar os participantes do usuário autenticado e escolher o vínculo que possui indicador ativo na mesma empresa.
- Normalizada a leitura do status legado sem alterar ou excluir dados existentes.
- Cadastros antigos que possuem usuário autenticado, participante ativo, CPF e telefone válidos têm o vínculo ausente de `programa_indicadores` recomposto de forma idempotente; o participante também recebe o tipo `INDICADOR`.
- Painel e envio agora usam a mesma resolução de sessão e de indicador.
- Adicionada a ação `Trocar usuário`, que encerra a sessão e retorna ao login do app.
- Atualizada a pergunta de capacidade mensal para “Qual valor disponível mensal para investimento?” e ajustado o resumo final.

## Segurança e dados

- A resolução parte do contexto autenticado e restringe todas as consultas por `empresa_id` e `usuario_id`.
- Nenhum cadastro legado foi removido, mesclado ou sobrescrito.
- O cliente administrativo é usado somente no servidor, depois da validação do contexto autenticado.

## Validação

- Contrato automatizado da fase cobre tenant, usuário, indicador ativo, logout e texto da pergunta.
- Typecheck, testes direcionados e build de produção executados antes da publicação.
