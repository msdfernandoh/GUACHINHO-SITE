-- 202 — Corrige destinos de comissões dos sócios sem apagar o histórico.
BEGIN;

-- A conta Gauchinho Particular pertence ao participante comercial Eroni Bolfe.
-- Com esse vínculo, os próximos pagamentos creditam automaticamente a conta correta.
UPDATE public.financeiro_contas_bancarias
SET participante_comercial_id = 'd32ca86d-e5e5-4355-8449-c31ee3586d13'::uuid,
    updated_at = now()
WHERE id = '69f8a1da-5c18-410c-b271-3609b75ea70d'::uuid
  AND empresa_id = '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid
  AND participante_comercial_id IS NULL;

-- Desfaz contabilmente a transferência indevida do pagamento do Fernando.
WITH nova AS (
  INSERT INTO public.financeiro_transferencias_contas(
    empresa_id,conta_origem_id,conta_destino_id,valor,data_transferencia,
    descricao,comprovante_referencia,idempotency_key,criado_por
  ) VALUES (
    '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid,
    '69f8a1da-5c18-410c-b271-3609b75ea70d'::uuid,
    'e53b8f7b-db22-4a5a-8696-833d0dda392c'::uuid,
    6187.50,'2026-09-01',
    'Reversão da transferência indevida da comissão de Fernando',
    'Pagamento 871098fa-555f-4081-b67b-60000b608785',
    'reversao-correcao-destino:871098fa-555f-4081-b67b-60000b608785',NULL
  ) ON CONFLICT (empresa_id,idempotency_key) DO NOTHING
  RETURNING *
)
INSERT INTO public.financeiro_conta_movimentos(
  empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,
  transferencia_conta_id,idempotency_key,criado_por
)
SELECT n.empresa_id,x.conta_id,x.tipo,'TRANSFERENCIA_INTERNA',n.valor,
       n.data_transferencia,n.descricao,n.id,x.chave,NULL
FROM nova n
CROSS JOIN LATERAL (VALUES
  (n.conta_origem_id,'SAIDA'::text,'reversao-destino-saida:'||n.id::text),
  (n.conta_destino_id,'ENTRADA'::text,'reversao-destino-entrada:'||n.id::text)
) x(conta_id,tipo,chave)
ON CONFLICT (empresa_id,idempotency_key) DO NOTHING;

-- Completa créditos ausentes de pagamentos confirmados na conta do beneficiário.
INSERT INTO public.financeiro_conta_movimentos(
  empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,
  pagamento_id,idempotency_key,criado_por
)
SELECT p.empresa_id,c.id,'ENTRADA',
       CASE WHEN s.id IS NULL THEN 'COMISSAO_PARTICIPANTE' ELSE 'COMISSAO_SOCIO' END,
       p.valor_liquido,p.data_pagamento,'Comissão recebida - '||p.competencia,
       p.id,'pagamento-entrada:'||p.id::text,NULL
FROM public.financeiro_pagamentos p
JOIN public.financeiro_contas_bancarias c
  ON c.empresa_id=p.empresa_id
 AND c.participante_comercial_id=p.participante_comercial_id
 AND c.ativo
JOIN public.participantes_comerciais pc
  ON pc.id=p.participante_comercial_id AND pc.empresa_id=p.empresa_id
LEFT JOIN public.empresa_socios s
  ON s.empresa_id=pc.empresa_id AND s.usuario_id=pc.usuario_id AND s.ativo
WHERE p.empresa_id='7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid
  AND p.status='confirmado' AND p.valor_liquido>0
  AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_conta_movimentos m
    WHERE m.empresa_id=p.empresa_id AND m.pagamento_id=p.id AND m.tipo='ENTRADA'
  )
ON CONFLICT (empresa_id,idempotency_key) DO NOTHING;

COMMIT;
NOTIFY pgrst,'reload schema';
