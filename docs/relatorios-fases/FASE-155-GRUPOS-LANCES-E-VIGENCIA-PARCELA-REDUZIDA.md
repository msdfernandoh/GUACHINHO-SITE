# Fase 155 — Grupos: lances e vigência informativa da parcela reduzida

## Objetivo

Unificar o cadastro estrutural de grupos no ERP e na Plataforma sem duplicar o
catálogo que o site já consome. A entrega separa modalidade de lance, modalidade
de parcela e faixa de comissão, preservando todos os grupos e snapshots antigos.

## Decisões aplicadas

- `grupos_modalidades_lance` continua sendo a coleção canônica compartilhada.
- Foi acrescentada somente `base_referencia`, com `SALDO_DEVEDOR` como padrão
  compatível e `CREDITO` como alternativa por modalidade.
- Lance registra máximo embutido e recurso próprio mínimo separadamente. Essa
  composição é informação comercial e não seleciona parcela integral/reduzida.
- O percentual efetivo da parcela reduzida pertence ao grupo. A faixa da
  comissão continua automática: integral 100%, reduzida 60–99% ou até 59%.
- Novos grupos podem registrar vigência até contemplação ou até a assembleia X.
  Na segunda opção, X é a última assembleia reduzida e a integral começa em X+1.
- O botão “50% do prazo” é somente um facilitador de preenchimento.
- A data da primeira assembleia é obrigatória em toda nova inserção.
- Grupos legados recebem `NULL` nas novas regras e não ganham textos ou efeitos.

## Fluxo ERP e governança

O ERP cria imediatamente um grupo `LOCAL/PENDENTE_PLATFORM`, preservando o mesmo
UUID para continuidade do cadastro interno. A solicitação contém data, percentual
reduzido, vigência e a coleção de lances. Na aprovação, a Platform atualiza e
promove esse mesmo grupo para `GLOBAL`, cria os créditos aprovados e publica o
catálogo para as demais franquias. Não há cópia ou troca de identidade.

## Site e proposta

O motor do site aplica percentuais de lance sobre a base cadastrada. A interface
mostra máximo embutido, recurso próprio mínimo e base separadamente. O snapshot
da proposta preserva as modalidades informativas disponíveis e a regra do grupo.
Quando a vigência é por assembleia, a proposta calcula a data da assembleia X+1
a partir da primeira assembleia e informa que contemplação anterior antecipa a
integralização. Nenhum recálculo financeiro novo foi introduzido.

## Banco e segurança

- Migration `153_grupos_regras_comerciais_informativas.sql`, forward-only.
- Constraints para base do lance, regra de vigência e assembleia limite.
- Trigger de obrigatoriedade da primeira assembleia apenas em novos `INSERT`s.
- RPCs permanecem protegidas por `can_write_tenant_internal` no ERP e
  `is_platform_superadmin()` na publicação global.
- Payload do tenant permanece limitado por lista positiva.

## Verificações

- TypeScript: `npx tsc --noEmit`.
- ESLint: `npm run lint:errors`.
- Suíte completa: 201 arquivos e 1.079 testes aprovados; 9 arquivos e 37 testes ignorados conforme configuração existente.
- Build Next.js de produção: aprovado, 150 páginas geradas.
