# Hotfix 282 — Modal de PDFs estável no Pipeline CRM

## Problema

O painel de visualização e upload de PDFs era renderizado dentro do card do
Kanban. O card possui transformação para interação/arraste, o que cria um
contexto próprio de composição para elementos `fixed` e resultava em recortes,
sobreposição e piscadas no modal.

## Correção

- O diálogo agora usa portal para `document.body`, acima de todo o Pipeline.
- O clique no fundo e a tecla Escape fecham somente o diálogo.
- A consulta das propostas usa carregamento explícito, sem `startTransition`
  aninhado durante upload e atualização da lista.

## Resultado

O modal permanece centralizado, sem competir com os cards, enquanto o usuário
visualiza, baixa ou envia PDFs para o histórico da proposta.
