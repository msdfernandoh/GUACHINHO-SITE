-- A conversao preservou o responsavel da antiga Master como parceiro comercial,
-- papel que por desenho nao acessa o ERP administrativo. Para esta conversao
-- assistida e auditada, o unico usuario da origem deve manter o mesmo nivel
-- administrativo dentro do ERP compartilhado da Gauchinho.

BEGIN;

DO $$
DECLARE
  v_empresa_gauchinho constant uuid := '7170f38e-15dd-4b19-8588-51e9a9cf0d4c';
  v_empresa_origem constant uuid := '87df83a8-1d22-4bd1-9712-5cb08915c4a0';
  v_usuario constant uuid := '062a7336-468e-4f43-b3e0-c6b08aec400e';
  v_papel_admin uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.empresas
    WHERE id = v_empresa_origem
      AND ativo = false
      AND configuracoes->'conversao_parceiro'->>'destino_empresa_id' = v_empresa_gauchinho::text
  ) THEN
    RAISE EXCEPTION 'Conversao auditada Racon Sinop -> Gauchinho nao localizada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_usuarios
    WHERE empresa_id = v_empresa_origem
      AND usuario_id = v_usuario
      AND ativo = true
      AND is_responsavel_principal = true
  ) THEN
    RAISE EXCEPTION 'Responsavel original da Racon Sinop nao confere.';
  END IF;

  SELECT id INTO v_papel_admin
  FROM public.papeis
  WHERE codigo = 'admin_empresa'
    AND empresa_id IS NULL
    AND ativo = true
  LIMIT 1;

  IF v_papel_admin IS NULL THEN
    RAISE EXCEPTION 'Papel Administrador da Empresa nao localizado.';
  END IF;

  UPDATE public.empresa_usuarios
  SET papel_id = v_papel_admin,
      erp_modulos_visiveis = NULL,
      origem = 'CONVERSAO_MASTER_PARCEIRO_ADMIN_ASSISTIDA',
      updated_at = now()
  WHERE empresa_id = v_empresa_gauchinho
    AND usuario_id = v_usuario
    AND ativo = true
    AND origem = 'CONVERSAO_MASTER_PARCEIRO';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vinculo convertido do responsavel nao foi localizado.';
  END IF;

  INSERT INTO public.plataforma_auditoria(
    acao, entidade_tipo, entidade_id, campos_alterados, executado_por
  ) VALUES (
    'PROMOVER_RESPONSAVEL_PARCEIRO_ADMIN_ERP',
    'empresa_usuarios',
    v_usuario,
    jsonb_build_object(
      'empresa_id', v_empresa_gauchinho,
      'empresa_origem_id', v_empresa_origem,
      'papel_codigo', 'admin_empresa',
      'erp_modulos_visiveis', NULL,
      'motivo', 'Preservar acesso administrativo do unico responsavel da Master convertida'
    ),
    NULL
  );
END;
$$;

COMMIT;
NOTIFY pgrst, 'reload schema';
