# Fase 200 — Reajuste anual canônico dos grupos

O grupo passa a guardar uma única regra anual compartilhada pelo SaaS, ERP e
catálogo público. A regra é explicitamente **FIXO**, com percentual obrigatório,
ou **VARIAVEL**, com nome do índice/alíquota obrigatório. A constraint do banco
impede combinações incompletas ou contraditórias.

Grupos anteriores permanecem com os três campos nulos até edição explícita;
nenhum índice ou percentual foi presumido e nenhum crédito histórico foi
recalculado. O cadastro ERP aplica a regra imediatamente apenas em grupo local.
Para grupos globais, a informação acompanha a solicitação tenant-aware e só é
publicada depois da aprovação Platform. O cadastro global da Platform grava a
mesma estrutura canônica.

O catálogo público apresenta a regra junto ao número do grupo nas visões desktop
e móvel. Esta fase é informativa: ela documenta a condição contratual e não
executa automaticamente o reajuste dos créditos já cadastrados.
