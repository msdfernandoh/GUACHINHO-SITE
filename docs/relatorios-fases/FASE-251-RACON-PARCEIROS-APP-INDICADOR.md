# Fase 251 — Parceiros e app de indicação Racon

## Diagnóstico

No host `raconsinop.com.br`, o proxy resolvia corretamente o site parceiro, mas reescrevia `/parceiros` para a home institucional. A landing, o cadastro e o app instalável não eram alcançados como fluxo Racon. Login, recuperação, telas mobile e manifesto continham marca fixa da Gauchinho.

## Alterações

- O proxy preserva as rotas do programa e o manifesto, mantendo os headers confiáveis do tenant e do site parceiro.
- Landing, cadastro, app de indicação e extrato usam o modelo visual azul, branco e turquesa quando o site resolvido é Racon. O conteúdo funcional permanece compartilhado.
- Login, recuperação e manifesto exibem o nome do site resolvido; o ícone PWA Racon existente tem 512 × 512 pixels.
- Os links continuam relativos ao host de origem. Não houve migration nem alteração de dados.

## Validação

- Teste de contrato das rotas e identidade: aprovado.
- TypeScript das alterações desta fase: sem erros; a checagem global apontou erros em arquivos de CRM alterados paralelamente nesta árvore de trabalho.
- Verificação pública anterior à publicação: `/parceiros` no host Racon exibia a home institucional e o login do app exibia Gauchinho, reproduzindo o defeito.

## Limite operacional

A publicação deve ser confirmada no domínio Racon após o deploy para verificar roteamento, manifesto e identidade finais.
