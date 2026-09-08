# Hotfix — contraste dos rótulos no formulário de eventos

Data: 04/09/2026

## Entrega

Os rótulos do formulário público de inscrição em eventos agora usam texto
branco e negrito, incluindo os campos condicionais de acompanhante e a opção
"Levar acompanhante". A alteração é exclusivamente visual e está isolada ao
formulário público; dados, validações e formulários administrativos permanecem
inalterados.

## Validação

- Inspeção do componente `src/components/public/eventos/evento-inscricao-form.tsx`:
  todos os rótulos visíveis usam `text-white` e `font-bold`.
