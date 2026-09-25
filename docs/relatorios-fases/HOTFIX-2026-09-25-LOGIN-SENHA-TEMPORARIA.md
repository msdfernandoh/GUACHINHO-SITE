# Hotfix — Login com senha temporária (25/09/2026)

## Diagnóstico

Após a emissão de nova senha no SaaS, o envio do formulário de login em
`raconsorriso.com.br` exibia uma página genérica de erro. Os registros Vercel
mostraram `Failed to find Server Action` no `POST /login`, indicando que a aba
enviou o identificador de uma implantação anterior. O mesmo aviso apareceu em
`POST /platform/empresas/...` na Plataforma. A conta de Auth consultada ainda
não tinha `last_sign_in_at`, consistente com falha antes de chamar o Supabase.

## Correção

- O formulário de login usa `POST /auth/login`, cujo endereço permanece igual
  entre implantações.
- A rota autentica no Supabase e encaminha a senha temporária para a troca
  obrigatória em `/definir-senha`.
- Erros de credenciais aparecem em português; o destino de retorno é limitado
  a caminhos internos.
- O proxy permite o POST de autenticação no host da Plataforma, mantendo a
  autorização normal das páginas protegidas.

## Verificação

- Testes da rota de login e da política do host da Plataforma: 9 passaram.
- TypeScript `tsc --noEmit`: passou.
- Nenhuma senha real foi lida, usada ou redefinida durante o diagnóstico.
- Nenhuma migration ou mudança em dados de negócio.
