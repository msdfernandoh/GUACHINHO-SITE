-- 167 — Consolida o lote duplicado do grupo 1553 e torna a proteção de
-- duplicidade compatível com a promoção LOCAL -> GLOBAL.
BEGIN;

CREATE OR REPLACE FUNCTION public.trg_bloquear_grupo_local_duplicado()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  -- UPDATE OF também dispara quando o valor atribuído não mudou. A aprovação
  -- republica os dados cadastrais antes de promover o grupo; nesse caso não há
  -- uma nova chave natural a validar.
  IF NEW.origem_governanca = 'LOCAL'
     AND NEW.empresa_origem_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR OLD.empresa_origem_id IS DISTINCT FROM NEW.empresa_origem_id
       OR OLD.administradora_id IS DISTINCT FROM NEW.administradora_id
       OR upper(trim(OLD.codigo_grupo)) IS DISTINCT FROM upper(trim(NEW.codigo_grupo))
       OR OLD.origem_governanca IS DISTINCT FROM NEW.origem_governanca
     ) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      NEW.empresa_origem_id::text || ':' || coalesce(NEW.administradora_id::text, '') || ':' || upper(trim(NEW.codigo_grupo)), 0
    ));
    IF EXISTS (
      SELECT 1 FROM public.grupos_consorcio g
      WHERE g.empresa_origem_id = NEW.empresa_origem_id
        AND g.administradora_id IS NOT DISTINCT FROM NEW.administradora_id
        AND upper(trim(g.codigo_grupo)) = upper(trim(NEW.codigo_grupo))
        AND g.origem_governanca = 'LOCAL'
        AND g.id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'Grupo local % já cadastrado nesta empresa', NEW.codigo_grupo USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_principal constant uuid := '579f1785-3175-449c-9add-3d7ad13ab93f';
  v_duplicados constant uuid[] := ARRAY[
    '7a4c5ec1-43e5-48c1-b81e-45023aa5e4a3'::uuid,
    '9ba8fbd7-169a-44b6-8d56-19805170198a'::uuid,
    'b30b488f-7868-4a72-90af-7d4d8265a711'::uuid,
    '9dbe5cc3-467a-4be9-976f-7453fcb5a644'::uuid,
    'a4fab9cb-e307-4a67-9217-3327d9c8543e'::uuid,
    '74bcd035-c52d-41f6-98fe-73cd6c5485db'::uuid,
    'c803c724-bf95-4d0f-8af6-ec121ec42332'::uuid,
    '1d83aba5-8968-4a1d-b404-988e11946a7f'::uuid
  ];
  v_payload jsonb;
BEGIN
  -- O reparo é deliberadamente específico e idempotente. Se o lote já tiver
  -- sido consolidado, não faz nada. Se o estado divergir, falha sem apagar.
  IF NOT EXISTS (SELECT 1 FROM public.grupos_consorcio WHERE id = ANY(v_duplicados)) THEN
    RETURN;
  END IF;

  SELECT s.payload INTO v_payload
  FROM public.catalogo_grupo_solicitacoes s
  WHERE s.grupo_id = v_principal AND s.status = 'PENDENTE_PLATFORM';

  IF v_payload IS NULL
     OR (SELECT count(*) FROM public.grupos_consorcio g
         WHERE g.id = ANY(v_duplicados)
           AND g.empresa_origem_id = '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid
           AND g.administradora_id = 'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
           AND upper(trim(g.codigo_grupo)) = '1553 IMÓVEL'
           AND g.origem_governanca = 'LOCAL') <> 8
     OR (SELECT count(*) FROM public.catalogo_grupo_solicitacoes s
         WHERE s.grupo_id = ANY(v_duplicados)
           AND s.status = 'PENDENTE_PLATFORM'
           AND s.payload = v_payload) <> 8 THEN
    RAISE EXCEPTION 'Lote duplicado 1553 divergiu da auditoria; consolidação cancelada';
  END IF;

  IF EXISTS (SELECT 1 FROM public.simulacoes_grupos_itens WHERE grupo_id = ANY(v_duplicados))
     OR EXISTS (SELECT 1 FROM public.contratacoes_online WHERE grupo_id = ANY(v_duplicados))
     OR EXISTS (SELECT 1 FROM public.vendas WHERE grupo_id = ANY(v_duplicados))
     OR EXISTS (SELECT 1 FROM public.erp_assembleias_grupo WHERE grupo_id = ANY(v_duplicados))
     OR EXISTS (SELECT 1 FROM public.simulacoes_grupos_itens i
                JOIN public.grupos_cotas c ON c.id = i.grupo_cota_id
                WHERE c.grupo_id = ANY(v_duplicados))
     OR EXISTS (SELECT 1 FROM public.vendas v
                JOIN public.grupos_cotas c ON c.id = v.opcao_cota_id
                WHERE c.grupo_id = ANY(v_duplicados)) THEN
    RAISE EXCEPTION 'Uma duplicata do grupo 1553 possui uso comercial; consolidação cancelada';
  END IF;

  DELETE FROM public.catalogo_grupo_solicitacoes WHERE grupo_id = ANY(v_duplicados);
  DELETE FROM public.grupos_governanca_historico WHERE grupo_id = ANY(v_duplicados);
  DELETE FROM public.grupos_modalidades_disponiveis WHERE grupo_id = ANY(v_duplicados);
  DELETE FROM public.grupo_estatisticas_historico WHERE grupo_id = ANY(v_duplicados);
  DELETE FROM public.grupos_vinculacoes_legadas_historico WHERE grupo_consorcio_id = ANY(v_duplicados);
  DELETE FROM public.grupos_categorias WHERE grupo_id = ANY(v_duplicados);
  DELETE FROM public.grupos_creditos_reajustes WHERE grupo_id = ANY(v_duplicados);
  DELETE FROM public.grupos_consorcio WHERE id = ANY(v_duplicados);
END;
$$;

COMMENT ON FUNCTION public.trg_bloquear_grupo_local_duplicado() IS
  'Serializa e bloqueia novas chaves naturais locais, sem impedir atualização idempotente ou promoção para o catálogo global.';

COMMIT;
NOTIFY pgrst, 'reload schema';
