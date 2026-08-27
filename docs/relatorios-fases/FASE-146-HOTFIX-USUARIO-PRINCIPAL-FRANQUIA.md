# Fase 146 — Hotfix do usuário principal da franquia

**Data:** 26/08/2026  
**Escopo:** Platform `/platform/usuarios`, identidade, convite e papel tenant  
**Migration:** `145_fix_convite_usuario_principal_franquia.sql`

## Diagnóstico

A RPC `rpc_platform_convidar_usuario` tentava criar a identidade em
`public.usuarios` com `perfil = 'consultor'`. A constraint histórica
`usuarios_perfil_check` aceita somente `master`, `srd`, `imobiliaria` e
`visualizador`, causando o erro exibido na tela e abortando o vínculo do
responsável principal.

Também foram encontrados dois problemas correlatos: a lista de papéis incluía
o `super_admin` de escopo `PLATFORM`, inadequado para uma franquia; e o modal era
fechado mesmo quando a server action retornava erro.

## Correção entregue

- a identidade-base nova usa `usuarios.perfil = 'visualizador'`, valor neutro e
  válido; a autorização real continua em `empresa_usuarios.papel_id`;
- papéis de escopo `PLATFORM` foram removidos dos seletores tenant;
- papéis customizados só aparecem na própria franquia;
- trigger no banco rejeita papel global ou pertencente a outra empresa mesmo
  que a interface seja contornada;
- o modal só fecha depois de sucesso e mantém o erro visível para correção;
- a listagem é revalidada após cadastro, edição ou troca de responsável;
- o convite agora é enviado pelo Supabase Auth, sem senha criada pelo operador;
- `auth.users.id` é ligado a `usuarios.auth_user_id` e a página
  `/definir-senha` conclui a ativação do vínculo;
- o reenvio usa o fluxo de recuperação seguro quando a identidade Auth já
  existe;
- falha de e-mail não apaga o vínculo: ele permanece `CONVIDADO` e pode ser
  reenviado após correção.

## Garantias de segurança

O responsável principal não recebe privilégio de Platform. Ele recebe um papel
`COMPANY` global reutilizável ou um papel customizado da própria empresa. A
ativação do convite atualiza somente vínculos cuja identidade canônica possui
`usuarios.auth_user_id = auth.uid()`.

## Verificações

- 11 testes direcionados e 1.044 testes da suíte completa aprovados;
- TypeScript sem erros;
- ESLint sem erros;
- build Next.js de produção concluído, incluindo `/definir-senha`;
- incompatibilidade TypeScript paralela em `tenant/context.ts`, recebida da
  `main` durante o rebase, corrigida removendo o perfil legado inexistente
  `admin` (o perfil válido de administração continua `master` e o papel tenant
  continua canônico em `empresa_usuarios`);
- migration `145` aplicada no Supabase de Produção após confirmação de
  alinhamento remoto `001–144`.
