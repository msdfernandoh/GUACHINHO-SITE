# Fase 244 — Landing de Parceiros na Identidade Racon Sinop

## Entrega

As landings `/parceiros`, `/parceiros/microfranqueado`, `/parceiros/gerador-de-negocios` e `/parceiros/gerador-de-possibilidades` agora resolvem a família visual do tenant antes da renderização.

No domínio/modelo Racon Sinop (`racon_inspired`), as páginas passam a usar a identidade clara, azul e institucional da marca, com hero em gradiente azul, cards claros, CTAs azuis e tipografia de contraste. No modelo padrão Gauchinho, o visual escuro e dourado existente é preservado.

## Motor compartilhado

O conteúdo comercial, simuladores, cálculos de projeção, rotas de cadastro e API continuam únicos. A escolha visual vem apenas de `isRaconModel(tenant.siteModel)`, que já respeita a resolução de domínio e parceiro do SaaS. Assim, o Racon Sinop usa o mesmo motor de captação sem criar tabela, comissão, cadastro ou regra comercial paralela.

## Validação

- `npm run lint:errors`: aprovado.
- `npx tsc --noEmit`: a execução alcançou erro pré-existente fora deste escopo em `src/app/admin/crm/pipeline/page.tsx`, que chama uma função com quatro argumentos quando a assinatura atual aceita três.
