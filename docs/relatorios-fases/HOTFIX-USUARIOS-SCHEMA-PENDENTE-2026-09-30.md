# Hotfix — Usuários: compatibilidade com schema pendente

Data: 30/09/2026

## Incidente

No domínio operacional Racon Sorriso, salvar um usuário retornava à rota
`/admin/usuarios` com erro de servidor. O perfil `parceiro` está disponível no
formulário, porém não possuía o mapeamento para o papel N:N
`parceiro_comercial`, levando a uma busca de papel inválida no servidor.

Foi identificado ainda um segundo ponto de indisponibilidade: a página consulta
`empresa_usuarios.pode_estornar_contas`, criada pela migration 101. Quando a
coluna não está presente no schema exposto pelo Supabase, o erro de coluna
ausente não era reconhecido pelo fallback de compatibilidade e a renderização
da lista falhava após o redirecionamento.

## Correção

- O detector de compatibilidade agora reconhece explicitamente
  `pode_estornar_contas` como coluna operacional opcional.
- O perfil técnico `parceiro` passa a resolver o papel global
  `parceiro_comercial`, que é o papel já utilizado pelos fluxos públicos de
  parceiros e não herda permissões de `consultor`.
- A leitura volta ao contrato legado somente para ausência conhecida de coluna;
  erros de permissão, tenant ou outras colunas continuam visíveis.
- A criação de usuário tenta primeiro gravar todas as opções operacionais. Se
  essas colunas forem ausentes, grava apenas o vínculo canônico
  `empresa_usuarios` com empresa, usuário, papel, estado, origem e autor do
  convite.

## Segurança e preservação

- O tenant continua vindo de `requireTenantPermission` e o vínculo é sempre
  gravado com a `empresaAtiva` resolvida no servidor.
- Não há `empresa_id` vindo do formulário, fallback para empresa fixa ou uso de
  `usuarios.perfil` como autorização.
- A compatibilidade não concede a permissão de estorno: ela permanece falsa ou
  indisponível até a migration 101 ser aplicada.
- Nenhum usuário, credencial, vínculo ou fato histórico existente foi alterado.

## Validação

- Testes direcionados de compatibilidade e de relação explícita
  `empresa_usuarios → usuarios`: aprovados (3 testes).
- `npx tsc --noEmit`: executado; a base já possui três erros não relacionados
  em `src/app/erp/minhas-comissoes/page.tsx` e no tipo de
  `MinhasComissoesClientProps`.

## Implantação e reversão

A alteração é compatível tanto com schemas que possuem quanto com schemas que
ainda não possuem a migration 101. A aplicação pode ser revertida sem dados a
migrar; a correção de banco permanece forward-only pela migration 101, quando
for homologada no ambiente que estiver pendente.
