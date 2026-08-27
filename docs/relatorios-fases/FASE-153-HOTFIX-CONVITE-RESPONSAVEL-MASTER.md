# Fase 153 — Hotfix do convite do responsável da Master Franquia

Data: 27/08/2026  
Escopo: Platform SaaS, identidade, vínculo N:N e experiência de onboarding.

## Problema confirmado

O cadastro criava corretamente o vínculo em `empresa_usuarios`, inclusive com
`is_responsavel_principal = true`, mas falhava ao localizar a identidade para o
convite e as telas exibiam zero usuários.

A causa era dupla:

1. `empresa_usuarios` possui duas chaves estrangeiras para `usuarios`:
   `usuario_id` e `convidado_por`. Consultas PostgREST sem o nome explícito da
   constraint eram ambíguas (`PGRST201`).
2. A ficha da Master Franquia solicitava `usuarios.status`, coluna inexistente,
   invalidando a consulta completa mesmo com vínculo persistido.

O vínculo já criado para a SORRISO foi preservado; nenhuma exclusão, recriação
ou alteração destrutiva foi realizada.

## Correções entregues

- Convite resolve primeiro `empresa_usuarios.usuario_id` e depois consulta
  `usuarios.id`, sem depender de embedding ambíguo.
- Reenvio usa a mesma resolução explícita e idempotente.
- Listagem global e ficha da Master usam
  `usuarios!empresa_usuarios_usuario_id_fkey`.
- A leitura inválida de `usuarios.status` foi substituída por `usuarios.ativo`.
- A ação iniciada na ficha leva `empresa_id`, abre o modal com a Master correta,
  marca automaticamente o primeiro usuário como responsável e oferece retorno
  à mesma ficha.
- As páginas de usuários e da empresa são revalidadas após convite/reenvio.
- O teste de contrato de relações N:N passou a cobrir também as telas Platform e
  impede regressão para `usuario:usuarios(...)` sem constraint.

## Banco e segurança

Não há mudança estrutural nem SQL pendente nesta fase. A correção respeita a
identidade em `usuarios` e a autorização tenant em `empresa_usuarios`; não usa
`usuarios.company_id` e não promove o responsável a Platform Superadmin.

## Critérios de aceite

- vínculo existente aparece na ficha da SORRISO e na listagem global;
- convite pode ser enviado/repetido sem criar vínculo duplicado;
- empresa em treinamento pode receber seu primeiro responsável;
- a Master selecionada na origem não é trocada pela primeira opção alfabética;
- build e regressão de relações são obrigatórios antes da publicação.

## Validação executada

- consulta administrativa no Supabase confirmou o vínculo da SORRISO com
  `status = CONVIDADO` e `is_responsavel_principal = true`;
- a relação explícita por `empresa_usuarios_usuario_id_fkey` retornou a
  identidade esperada;
- `npm run test:regression`: 1.062 testes aprovados e 37 testes remotos opt-in
  ignorados;
- `npm run build`: aprovado;
- `npm run lint`: 0 erros e 344 avisos legados, dentro do limite controlado.
