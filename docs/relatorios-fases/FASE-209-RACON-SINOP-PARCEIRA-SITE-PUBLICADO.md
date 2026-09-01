# Fase 209 — Racon Sinop como parceira com site publicado

## Diagnóstico

O fluxo de conversão chamava a criação do site com `auth.uid()` no campo
`parceiro_sites.created_by_usuario_id`. Esse campo referencia `usuarios.id`, não
`auth.users.id`, causando a violação da chave estrangeira.

A auditoria confirmou para Racon Sinop:

- zero leads, propostas, contratações, vendas e movimentos de caixa;
- um usuário ativo;
- domínio `raconsinop.com.br` principal, ativo, verificado e com SSL `READY`;
- modelo **Racon Inspired** publicado.

## Correção e conversão

- A RPC passa a resolver `public.current_usuario_id()` e valida que o usuário
  interno está ativo antes de criar o site.
- A conversão assistida é interrompida se surgir qualquer fato operacional.
- O domínio precisa continuar pronto antes da alteração.
- O site parceiro é criado como `PUBLICADO`, com modelo `racon_inspired`.
- O domínio é transferido para o site parceiro mantendo estado ativo e SSL
  pronto, sem mudança necessária na publicação da Vercel.
- O host canônico foi alinhado para `www.raconsinop.com.br`, que já é o destino
  principal configurado na Vercel, eliminando o ciclo de redirecionamento entre
  `www` e o domínio raiz.
- O redirecionamento canônico fica sob responsabilidade exclusiva da Vercel;
  ele foi desativado no runtime Next.js para não duplicar a política do provedor.
- O usuário passa a operar como parceiro dentro do ERP da Gauchinho; o tenant
  anterior fica suspenso e preservado para auditoria.

## Segurança

A operação usa IDs auditados, confirmação explícita, validação do domínio,
modelo e ausência de fatos. Em ambientes sem esses registros, a etapa de dados
é ignorada sem criar cadastros artificiais.
