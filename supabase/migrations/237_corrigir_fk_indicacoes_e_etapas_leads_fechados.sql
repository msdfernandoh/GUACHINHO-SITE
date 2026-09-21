-- Migration 237: Corrigir FK de programa_indicacoes para ON DELETE CASCADE
-- e sincronizar etapa_id e fechado de leads que já fecharam mas estão em etapas divergentes.

-- 1. Atualiza FK de programa_indicacoes para permitir exclusão em cascata pelo admin
DO 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'programa_indicacoes_lead_id_fkey'
  ) THEN
    ALTER TABLE public.programa_indicacoes
      DROP CONSTRAINT programa_indicacoes_lead_id_fkey;
  END IF;

  ALTER TABLE public.programa_indicacoes
    ADD CONSTRAINT programa_indicacoes_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;
END ;

-- 2. Sincroniza leads que já fecharam / ganharam mas constam em etapas antigas ('novo_lead', etc.)
DO 
DECLARE
  v_empresa RECORD;
  v_etapa_fechado uuid;
BEGIN
  FOR v_empresa IN SELECT id FROM public.empresas LOOP
    SELECT id INTO v_etapa_fechado
    FROM public.crm_funil_etapas
    WHERE empresa_id = v_empresa.id AND slug = 'venda_fechada'
    LIMIT 1;

    IF v_etapa_fechado IS NOT NULL THEN
      -- Atualiza todos os leads que possuem status ganho/fechado para a etapa de venda fechada
      UPDATE public.leads
      SET
        etapa_id = v_etapa_fechado,
        status = 'Venda fechada',
        fechado = true,
        data_fechamento = COALESCE(data_fechamento, CURRENT_DATE)
      WHERE empresa_id = v_empresa.id
        AND (
          LOWER(TRIM(status)) IN ('ganho', 'fechado', 'venda fechada', 'venda_fechada')
          OR fechado = true
        );
    END IF;
  END LOOP;
END ;