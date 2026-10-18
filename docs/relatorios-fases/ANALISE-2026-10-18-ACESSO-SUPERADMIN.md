# Diagnóstico — acesso do Superadmin à Plataforma SaaS

Data: 18/10/2026. Escopo: GAUCHINHO SITE. Diagnóstico somente leitura em produção.

Atualização posterior: recuperação autorizada e aplicada, conforme
`HOTFIX-2026-10-18-RECUPERACAO-SUPERADMIN.md`. Os resultados abaixo descrevem
o estado anterior à correção.

## Conclusão comprovada

A identidade de `msdfernando@gmail.com` está ativa, com e-mail confirmado e
registro recente de autenticação. O único vínculo em `empresa_usuarios` está
ativo, mas aponta para `admin_empresa`, escopo `COMPANY`. O host global exige
`super_admin`, escopo `PLATFORM`; portanto a mensagem relatada pelo titular,
`Acesso restrito ao PLATFORM_SUPERADMIN.`, corresponde à autorização negada
depois da autenticação.

O perfil legado `usuarios.perfil = master` continua presente, mas não concede
acesso à Plataforma. Nenhum vínculo com papel `super_admin` foi encontrado na
consulta global de `empresa_usuarios`; o papel global em `papeis` existe e está
ativo. A migration 043 previa explicitamente esse e-mail como Superadmin.

## Evidências coletadas

Consultas administrativas somente leitura no Supabase canônico
`eaeuoynprurmmulzhydt`, sem exibir chaves, senhas ou tokens:

- `usuarios.id`: `31617f5c-42c7-4f08-ba5a-38323eacbffd`.
- `usuarios.auth_user_id`: `5dfd1ca3-ee2c-43a1-b294-8d11c698a434`.
- `usuarios.ativo = true`; identidade Auth com e-mail confirmado e sem indicação
  de banimento no retorno consultado; sem exigência de troca de senha nos metadados.
- `last_sign_in_at = 2026-10-18T13:24:59.825498Z` (09:24:59 em Cuiabá).
- Vínculo: `f9ad413a-1447-4c8f-bd6b-00a588ebe756`.
- Empresa: `7170f38e-15dd-4b19-8588-51e9a9cf0d4c`.
- Papel atual: `1ebf0f18-59d7-474d-bae3-99f5f5bac010`, `admin_empresa`,
  `COMPANY`, ativo.
- Papel global existente: `ed7a21e5-d275-43cc-a0e1-f901935701a4`,
  `super_admin`, `PLATFORM`, ativo, `empresa_id = null`.
- Última atualização do vínculo: `2026-10-09T14:42:15.16682Z`
  (09/10/2026 às 10:42:15 em Cuiabá). Esse horário não comprova quando o papel mudou.
- HTTP anônimo: `/` e `/platform` retornaram 307 para `/login?next=%2Fplatform`;
  `/login?next=/platform` retornou 200. HTTPS e página de login estavam operacionais.

Não foi criada sessão de teste nem executado login com a senha do titular.
Não houve chamada à RPC sob a sessão dele: a conclusão combina o estado
relacional consultado, a definição versionada da autorização e o erro informado.

## Origem provável e limite de atribuição

Em `gauchinho-app/src/app/admin/usuarios/actions.ts`, o mapa
`PERFIL_PARA_PAPEL.master = admin_empresa` e a action
`updateUsuarioPerfilAction` regravam `empresa_usuarios.papel_id` ao salvar
configurações do usuário. O carregamento do alvo não inclui o papel global
atual e não há preservação explícita desse papel nessa action. Esse fluxo é
capaz de converter um Superadmin legado em administrador da empresa, mesmo
quando o formulário continua exibindo o perfil técnico master.

Isso é uma hipótese para a origem histórica, não atribuição comprovada. As
consultas a `plataforma_auditoria` e `audit_logs_central` pelos IDs do usuário
e vínculo não retornaram registros. A janela de 09/10/2026 14:40–14:44 UTC
também não retornou evento de `empresa_usuarios` na auditoria Platform.
Não é possível determinar o autor, a operação exata ou a data da troca do papel
com essas evidências.

## Correção recomendada, ainda não executada

1. Preparar recuperação auditada da autoridade global da identidade original,
   preservando vínculos, senha, participação comercial e dados de todas as empresas.
2. Conciliar a recuperação com `validar_papel_empresa_usuario` (migration 145):
   o trigger versionado rejeita atribuir papel PLATFORM a vínculo tenant.
   Não recomendar um UPDATE isolado de `papel_id`, desativação geral de triggers
   ou abertura do host para administradores comuns. A proteção do último
   administrador empresarial da migration 126 também deve ser respeitada.
3. Proteger edição de usuários contra perda acidental da autoridade global e
   perda do último Superadmin; registrar autoria e alteração de papel.
4. Validar a autorização canônica e o acesso autenticado a `/platform`, além
   da preservação do ERP e bloqueio dos papéis comuns.

Esta análise não aplicou recuperação, migration, implantação ou alteração de
permissões, senha, sessão ou dados de negócio. Somente este relatório e o
registro de diagnóstico na arquitetura foram adicionados localmente.
