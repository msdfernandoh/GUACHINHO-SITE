-- 116: Validação resiliente e tolerante de faixas em rpc_platform_salvar_curva_estorno
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_curva_estorno(
  p_administradora_id uuid,
  p_nome text,
  p_descricao text,
  p_status text,
  p_vigencia_inicio date,
  p_vigencia_fim date,
  p_faixas jsonb,
  p_todos_tipos boolean,
  p_tipos uuid[],
  p_todas_modalidades boolean,
  p_modalidades uuid[],
  p_curva_id uuid DEFAULT NULL,
  p_nova_versao boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_curva record;
  v_f jsonb;
  v_versao integer;
  v_mes int;
  v_pct numeric;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin';
  END IF;

  IF length(trim(coalesce(p_nome,'')))<2 OR p_vigencia_inicio IS NULL THEN
    RAISE EXCEPTION 'Nome e início da vigência são obrigatórios';
  END IF;

  IF upper(trim(p_status)) NOT IN ('RASCUNHO','HOMOLOGADA','INATIVA') THEN
    RAISE EXCEPTION 'Status da Curva inválido';
  END IF;

  IF p_vigencia_fim IS NOT NULL AND p_vigencia_fim < p_vigencia_inicio THEN
    RAISE EXCEPTION 'Fim da vigência anterior ao início';
  END IF;

  IF jsonb_typeof(p_faixas) <> 'array' OR jsonb_array_length(p_faixas) = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos uma faixa';
  END IF;

  -- Validação tolerante com limpeza de '%' e espaços
  FOR v_f IN SELECT value FROM jsonb_array_elements(p_faixas) LOOP
    BEGIN
      v_mes := (regexp_replace(coalesce(v_f->>'mes',''), '[^0-9]', '', 'g'))::int;
      v_pct := (replace(replace(trim(coalesce(v_f->>'percentual','')), '%', ''), ',', '.'))::numeric;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Faixa de mês/percentual inválida';
    END;

    IF v_mes IS NULL OR v_mes < 1 OR v_pct IS NULL OR v_pct < 0 OR v_pct > 100 THEN
      RAISE EXCEPTION 'Faixa de mês/percentual inválida';
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM jsonb_array_elements(p_faixas)) <> (
    SELECT count(DISTINCT (regexp_replace(coalesce(e->>'mes',''), '[^0-9]', '', 'g'))::int)
    FROM jsonb_array_elements(p_faixas) e
  ) THEN
    RAISE EXCEPTION 'Mês duplicado na curva';
  END IF;

  IF NOT p_todos_tipos AND coalesce(array_length(p_tipos,1),0)=0 THEN
    RAISE EXCEPTION 'Selecione ao menos um Tipo';
  END IF;

  IF NOT p_todas_modalidades AND coalesce(array_length(p_modalidades,1),0)=0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma Modalidade';
  END IF;

  IF EXISTS(SELECT 1 FROM unnest(coalesce(p_tipos,'{}')) x WHERE NOT EXISTS(SELECT 1 FROM public.administradora_tipos t WHERE t.id=x AND t.administradora_id=p_administradora_id)) THEN
    RAISE EXCEPTION 'Tipo pertence a outra Administradora';
  END IF;

  IF EXISTS(SELECT 1 FROM unnest(coalesce(p_modalidades,'{}')) x WHERE NOT EXISTS(SELECT 1 FROM public.administradora_modalidades_comissao m WHERE m.id=x AND m.administradora_id=p_administradora_id)) THEN
    RAISE EXCEPTION 'Modalidade pertence a outra Administradora';
  END IF;

  IF p_curva_id IS NOT NULL AND NOT p_nova_versao THEN
    SELECT * INTO v_curva FROM public.administradora_curvas_estorno WHERE id=p_curva_id AND administradora_id=p_administradora_id FOR UPDATE;
    IF v_curva.id IS NULL THEN RAISE EXCEPTION 'Curva não encontrada'; END IF;
    IF v_curva.status<>'RASCUNHO' OR EXISTS(SELECT 1 FROM public.comissao_regras_franquia WHERE curva_estorno_id=v_curva.id) THEN
      RAISE EXCEPTION 'Curva homologada ou utilizada exige Nova versão';
    END IF;

    UPDATE public.administradora_curvas_estorno
    SET nome=trim(p_nome),
        descricao=nullif(trim(coalesce(p_descricao,'')),''),
        status=upper(trim(p_status)),
        ativa=upper(trim(p_status))<>'INATIVA',
        vigencia_inicio=p_vigencia_inicio,
        vigencia_fim=p_vigencia_fim,
        aplicavel_todos_tipos=p_todos_tipos,
        aplicavel_todas_modalidades=p_todas_modalidades,
        updated_at=now()
    WHERE id=v_curva.id
    RETURNING * INTO v_curva;

    DELETE FROM public.administradora_curva_estorno_faixas WHERE curva_id=v_curva.id;
    DELETE FROM public.administradora_curva_tipos WHERE curva_id=v_curva.id;
    DELETE FROM public.administradora_curva_modalidades WHERE curva_id=v_curva.id;
  ELSE
    SELECT coalesce(max(versao),0)+1 INTO v_versao
    FROM public.administradora_curvas_estorno
    WHERE administradora_id=p_administradora_id AND lower(trim(nome))=lower(trim(p_nome));

    INSERT INTO public.administradora_curvas_estorno(
      administradora_id,nome,descricao,versao,vigencia_inicio,vigencia_fim,ativa,encerra_na_contemplacao,status,aplicavel_todos_tipos,aplicavel_todas_modalidades
    ) VALUES (
      p_administradora_id,trim(p_nome),nullif(trim(coalesce(p_descricao,'')),''),v_versao,p_vigencia_inicio,p_vigencia_fim,upper(trim(p_status))<>'INATIVA',true,upper(trim(p_status)),p_todos_tipos,p_todas_modalidades
    ) RETURNING * INTO v_curva;
  END IF;

  FOR v_f IN SELECT value FROM jsonb_array_elements(p_faixas) LOOP
    v_mes := (regexp_replace(coalesce(v_f->>'mes',''), '[^0-9]', '', 'g'))::int;
    v_pct := (replace(replace(trim(coalesce(v_f->>'percentual','')), '%', ''), ',', '.'))::numeric;
    INSERT INTO public.administradora_curva_estorno_faixas(curva_id,mes_relativo,percentual_estorno)
    VALUES(v_curva.id, v_mes, v_pct);
  END LOOP;

  IF NOT p_todos_tipos THEN
    INSERT INTO public.administradora_curva_tipos(curva_id,tipo_id)
    SELECT v_curva.id, x FROM unnest(p_tipos) x;
  END IF;

  IF NOT p_todas_modalidades THEN
    INSERT INTO public.administradora_curva_modalidades(curva_id,modalidade_id)
    SELECT v_curva.id, x FROM unnest(p_modalidades) x;
  END IF;

  PERFORM public.platform_catalogo_auditar(
    CASE WHEN p_nova_versao THEN 'nova_versao' ELSE 'salvar' END,
    'administradora_curvas_estorno',
    v_curva.id,
    '["nome","descricao","status","vigencia","faixas","tipos","modalidades"]'
  );

  RETURN to_jsonb(v_curva);
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
