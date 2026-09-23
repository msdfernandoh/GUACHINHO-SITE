# Fase 284 — PDFs independentes por grupo

## Objetivo

Permitir que uma proposta com vários grupos gere arquivos PDF autônomos, um
por grupo, quando essa for a forma de apresentação comercial escolhida.

## Entregas

- Nova opção **Arquivos independentes** no modal de proposta multigrupo.
- Um PDF completo por grupo, cada qual com capa, resumo, detalhamento e
  encerramento próprios.
- Cotas selecionadas do mesmo grupo permanecem juntas no mesmo arquivo.
- Os arquivos são gravados no bucket privado `propostas-pdf`, sob
  `<proposta_id>/independentes/<lote>-<grupo>.pdf`.
- Metadados de cada emissão entram em `propostas_arquivos` como `pdf_gerado`,
  tornando os documentos acessíveis no histórico do card CRM.
- A resposta da geração retorna links assinados individuais, exibidos como
  downloads separados na barra de resumo do simulador.

## Segurança

O upload usa o identificador da proposta como primeiro segmento do caminho,
mantendo as políticas tenant-aware do bucket. Os objetos permanecem privados e
os links de download têm expiração.
