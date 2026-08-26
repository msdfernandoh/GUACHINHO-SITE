-- 132 — Modelo de site canônico por empresa e restauração do site Gauchinho.
-- A atribuição vive exclusivamente em empresa_site_modelos; empresa_branding
-- mantém apenas identidade visual e conteúdo editável do tenant.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_platform_alterar_modelo_empresa(
  p_empresa_id uuid,
  p_novo_modelo_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modelo public.site_modelos%ROWTYPE;
  v_modelo_anterior_id uuid;
  v_status_vinculo text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.empresas e WHERE e.id = p_empresa_id FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  SELECT *
    INTO v_modelo
    FROM public.site_modelos
   WHERE id = p_novo_modelo_id
     AND status = 'PUBLICADO';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modelo de site não encontrado ou não publicado.';
  END IF;

  SELECT esm.modelo_id, esm.status
    INTO v_modelo_anterior_id, v_status_vinculo
    FROM public.empresa_site_modelos esm
   WHERE esm.empresa_id = p_empresa_id
   FOR UPDATE;

  IF v_status_vinculo IS NULL THEN
    SELECT CASE
      WHEN eb.status_publicacao = 'PUBLICADO' THEN 'PUBLICADO'
      ELSE 'RASCUNHO'
    END
      INTO v_status_vinculo
      FROM public.empresa_branding eb
     WHERE eb.empresa_id = p_empresa_id;
  END IF;

  INSERT INTO public.empresa_site_modelos (
    empresa_id,
    modelo_id,
    status,
    updated_at
  ) VALUES (
    p_empresa_id,
    p_novo_modelo_id,
    coalesce(v_status_vinculo, 'RASCUNHO'),
    now()
  )
  ON CONFLICT (empresa_id) DO UPDATE
    SET modelo_id = excluded.modelo_id,
        updated_at = now();

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'ALTERAR_MODELO_SITE_EMPRESA',
    'empresa_site_modelos',
    p_empresa_id,
    jsonb_build_object(
      'modelo_anterior_id', v_modelo_anterior_id,
      'modelo_novo_id', p_novo_modelo_id,
      'modelo_novo_codigo', v_modelo.codigo,
      'modelo_novo_nome', v_modelo.nome
    ),
    auth.uid()
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_platform_alterar_modelo_empresa(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_platform_alterar_modelo_empresa(uuid, uuid)
  TO authenticated, service_role;

-- A primeira empresa usa o runtime operacional Gauchinho e o seu modelo próprio.
UPDATE public.empresas
   SET configuracoes = jsonb_set(
         coalesce(configuracoes, '{}'::jsonb),
         '{site_publico}',
         coalesce(configuracoes->'site_publico', '{}'::jsonb)
           || jsonb_build_object('operacional_habilitado', true),
         true
       ),
       updated_at = now()
 WHERE slug = 'gauchinho';

INSERT INTO public.empresa_site_modelos (empresa_id, modelo_id, status, updated_at)
SELECT e.id, sm.id, 'PUBLICADO', now()
  FROM public.empresas e
  JOIN public.site_modelos sm ON sm.codigo = 'gauchinho_default'
 WHERE e.slug = 'gauchinho'
   AND sm.status = 'PUBLICADO'
ON CONFLICT (empresa_id) DO UPDATE
  SET modelo_id = excluded.modelo_id,
      status = 'PUBLICADO',
      updated_at = now();

COMMIT;
