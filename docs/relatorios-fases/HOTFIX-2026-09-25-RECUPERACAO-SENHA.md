# Hotfix — Recuperação e redefinição de senha (25/09/2026)

## Contexto

O link enviado pelo Supabase estava levando o usuário a `localhost:3000`, e a mensagem usava o modelo padrão em inglês. A redefinição do responsável principal na Plataforma podia exibir uma página de erro após a confirmação. Contas legadas sem identidade Auth recebiam uma senha inicial fixa durante a recuperação.

## Alterações no aplicativo

- A redefinição pela Plataforma gera senha aleatória de 16 caracteres, mantém a exigência de troca no próximo acesso e retorna falhas inesperadas ao formulário, sem recarregar a página da empresa após a mutação.
- O provisionamento de acesso direto e a recuperação de contas legadas deixam de usar senha fixa; ambos passam a gerar credenciais aleatórias.
- A definição da senha pelo próprio usuário atualiza senha e `exige_troca_senha` numa operação de Auth. Uma falha de ativação de convite legado é registrada sem informar falsamente que a troca de senha falhou.
- O modelo `supabase/templates/recovery.pt-BR.html` fornece assunto sugerido **Redefina sua senha — Gauchinho Consórcios** e texto em português, com link direto para `/auth/confirm` no domínio público de produção usando `TokenHash` de recuperação.

## Configuração externa aplicada

O modelo de e-mail e a URL de autenticação são configurações hospedadas no projeto Supabase, fora das migrations SQL. Em `eaeuoynprurmmulzhydt`, a **Site URL** foi alterada de `http://localhost:3000` para `https://www.gauchinhoconsorcios.com.br`. Foram cadastrados oito callbacks `/auth/confirm**` correspondentes aos domínios de produção de Gauchinho, admin, Racon Sinop, Racon Sorriso e Consórcio Multi. O Supabase confirmou o cadastro das oito URLs.

O modelo **Reset password** recebeu o assunto **Redefina sua senha — Gauchinho Consórcios** e o corpo em português de `supabase/templates/recovery.pt-BR.html`. A prévia mostrou o botão **Criar nova senha** e o Supabase confirmou `Successfully updated email template`. Não aplicar `supabase config push` a partir do `config.toml` mínimo deste repositório sem conciliar as demais configurações remotas.

## Verificação

- `vitest`: 18 testes passaram nos fluxos de recuperação, senha do responsável e definição de senha.
- `tsc --noEmit`: passou.
- Build Vercel de produção concluído e deploy `dpl_5Y15c6rDobLaGBuyovGzGfkfu78f` em estado Ready, incluindo os domínios público e administrativo.
- O formulário público aceitou uma solicitação de recuperação para o responsável apresentado nas evidências e exibiu a confirmação de envio. O token recebido não foi consumido.
- O callback público com token inválido respondeu com redirecionamento 307 para `/login` em produção, com a mensagem de link inválido; não houve redirecionamento para `localhost`.
- Não houve redefinição de senha de uma conta real durante a verificação.

## Dados e limites

Nenhuma migration nem alteração em tabelas de negócio. `usuarios`, `empresa_usuarios`, papéis e permissões são preservados. A entrega efetiva na caixa postal e o uso de um link válido ainda dependem da conferência do destinatário; o teste automatizado não acessou o e-mail recebido.
