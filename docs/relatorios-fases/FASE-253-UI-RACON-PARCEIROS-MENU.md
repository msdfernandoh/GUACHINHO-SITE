# Fase 253 — UI Racon e menu de parceiros

## Diagnóstico

A aparência configurável de páginas operacionais aplicava `--visual-title` e `--visual-text` do fundo claro sobre banners azuis da área de parceiros. Isso gerava títulos escuros, destaques com pouco contraste e CTA azul sobre cartão azul. A navegação precisava ganhar uma entrada própria para parceiros e podia incluir `Seguradoras` conforme o catálogo publicado.

## Implementação

- Banners do programa e das modalidades definem tokens inversos brancos e azul muito claro.
- O cartão de Network usa gradiente Racon e CTA branco com texto azul.
- Cartões azuis de projeção mantêm textos brancos.
- A navegação Racon remove `Seguradoras`, preserva `Programa de Indicação` e cria a entrada adicional `Seja parceiro`, apontando para `/parceiros`.
- A normalização atua somente na família Racon e não modifica menus nem cores do site Gauchinho.
- O cálculo puro de parcela do CRM foi isolado de `dashboard-query` para impedir que um componente cliente importe dependências de servidor; isso restabelece o build de produção que havia quebrado no commit anterior do funil.

## Validação

- Teste unitário cobre remoção, renomeação e destino do menu.
- Lint direcionado e TypeScript executados após a alteração.
- Build completo Next.js aprovado.
- Revisão visual realizada na versão pública anterior para reproduzir os contrastes incorretos; nova revisão desktop e mobile deve ser feita após o deploy.

