-- 180: alinha o vocabulario do historico com a formalizacao multicotas e
-- reconcilia a quantidade assinada que foi encoberta pelo default legado 1.
BEGIN;

ALTER TABLE public.contratacoes_formalizacao_historico
  DROP CONSTRAINT IF EXISTS contratacoes_formalizacao_historico_evento_check;
ALTER TABLE public.contratacoes_formalizacao_historico
  ADD CONSTRAINT contratacoes_formalizacao_historico_evento_check CHECK (evento IN (
    'CONFERENCIA_INICIADA',
    'DADOS_COMERCIAIS_AJUSTADOS',
    'PENDENCIA_REGISTRADA',
    'FORMALIZADA',
    'VENDA_FORMALIZADA',
    'COTAS_DEFINITIVAS_GERADAS',
    'NUMERO_COTA_ATUALIZADO',
    'INVALIDADA'
  ));

-- A coluna foi adicionada com default 1 na fase 168. Para contratações ainda
-- não formalizadas, recupera somente uma quantidade explícita e válida do
-- snapshot comercial; não altera vendas nem cotas já existentes.
WITH quantidades AS (
  SELECT c.id,
    COALESCE(
      CASE WHEN c.dados_simulacao->>'quantidade_cotas_formalizacao' ~ '^[0-9]+$'
        THEN (c.dados_simulacao->>'quantidade_cotas_formalizacao')::integer END,
      CASE WHEN c.dados_simulacao#>>'{selecoes,0,config,quantidadeCotas}' ~ '^[0-9]+$'
        THEN (c.dados_simulacao#>>'{selecoes,0,config,quantidadeCotas}')::integer END,
      CASE WHEN c.dados_simulacao#>>'{selecoes,0,resultado,quantidadeCotas}' ~ '^[0-9]+$'
        THEN (c.dados_simulacao#>>'{selecoes,0,resultado,quantidadeCotas}')::integer END,
      CASE WHEN c.dados_simulacao#>>'{totais,totalCotas}' ~ '^[0-9]+$'
        THEN (c.dados_simulacao#>>'{totais,totalCotas}')::integer END
    ) AS quantidade
  FROM public.contratacoes_online c
  WHERE c.quantidade_cotas = 1
    AND NOT EXISTS (
      SELECT 1 FROM public.vendas v
      WHERE v.empresa_id=c.empresa_id AND v.contratacao_id=c.id
    )
)
UPDATE public.contratacoes_online c
SET quantidade_cotas=q.quantidade, updated_at=now()
FROM quantidades q
WHERE c.id=q.id AND q.quantidade BETWEEN 2 AND 100;

COMMIT;
NOTIFY pgrst, 'reload schema';
