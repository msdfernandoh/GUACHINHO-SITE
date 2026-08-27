# Fase 147 — Domínios, DNS e ativação automática na Vercel

**Data:** 26/08/2026
**Migration:** `146_empresa_dominios_dns_operacional.sql`

## Problema encontrado

O cadastro antigo gravava somente `empresa_dominios.verificado = false`. Não
adicionava o domínio ao projeto Vercel, não consultava DNS, não verificava HTTPS,
não guardava diagnóstico e não permitia editar o host. Por isso qualquer domínio
permanecia indefinidamente como `PENDENTE`.

O domínio `raconsorriso.com.br` não possuía registro A público e não estava no
projeto quando foi auditado. Ele foi adicionado manualmente ao projeto
`guachinho-site`; o apontamento DNS ainda precisa ser criado no registrador.

Para esse domínio, a configuração prioritária retornada pela API da Vercel em
26/08/2026 foi:

- `A` no host `@` para `216.150.1.1`;
- `A` no host `@` para `216.150.16.1`.

As duas entradas pertencem à mesma alternativa prioritária informada pela
Vercel. A interface escolhe somente a alternativa adequada ao tipo do host:
registros A para domínio raiz ou CNAME para subdomínio. Alternativas diferentes
não são mais exibidas como se fossem cumulativas.

## Fluxo entregue

1. Platform cadastra o domínio uma vez e o vincula à empresa.
2. Com `VERCEL_API_TOKEN` configurado, o backend adiciona o domínio ao projeto
   `guachinho-site` e consulta a recomendação oficial da Vercel.
3. A tela mostra o registro exato que deve ser copiado no provedor DNS.
4. O operador pode corrigir domínio, tipo, situação principal e status ativo.
5. “Verificar agora” consulta DNS público e HTTPS sem permitir aprovação manual
   indevida.
6. Um cron autenticado repete a verificação a cada dez minutos.
7. O domínio só recebe `verificado = true` quando DNS e certificado HTTPS estão
   efetivamente disponíveis.

Os estados `status_vercel`, `status_dns` e `status_ssl` são independentes e a
última verificação, registros encontrados e erro ficam persistidos para suporte.

## Implantação e validação

A migration foi aplicada no Supabase de Produção. `VERCEL_API_TOKEN`,
`VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` e `CRON_SECRET` foram configurados no
ambiente Production da Vercel. O token permanece exclusivamente no servidor e
não é serializado para o navegador.

Validações executadas antes da publicação:

- `npm test`: 191 arquivos aprovados, 1.048 testes aprovados;
- `npm run lint:errors`: aprovado;
- `npx tsc --noEmit`: aprovado;
- `npm run build`: aprovado, incluindo `/api/cron/dominios`.

Sem credencial Vercel em outro ambiente, a tela continua funcional para
cadastro, edição, instrução e verificação, mas informa claramente que o domínio
precisa ser adicionado manualmente ao projeto.
