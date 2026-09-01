# Fase 211 — Acesso ao detalhe de Contratações no ERP

## Problema

A listagem de Contratações aceitava usuários com `gerenciar_propostas` ou
`formalizar_vendas`, mas o detalhe exigia diretamente `formalizar_vendas`. Quem tinha
acesso legítimo de conferência conseguia ver o botão e recebia uma exceção de servidor
ao abrir a contratação.

## Correção

- Lista, layout e detalhe usam o mesmo guard canônico `requireErpRouteAccess("contratacoes")`.
- Usuários com acesso ao módulo podem abrir e conferir a contratação.
- A confirmação final continua exigindo `formalizar_vendas`, `admin_empresa` ou
  `super_admin`; o Server Action mantém a validação tenant-aware existente.
- Sem essa permissão, a tela mostra uma orientação clara, desabilita a confirmação e a
  listagem usa o rótulo `Conferir contratação` em vez de prometer formalização.
- Nenhuma permissão foi ampliada implicitamente e não houve migration.

## Validação

- Cinco testes direcionados aprovados.
- TypeScript sem emissão aprovado.
- ESLint sem erros nos arquivos alterados; permaneceram apenas avisos preexistentes.
