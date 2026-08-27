-- 149: Cadastro completo da Master Franquia e bootstrap seguro do primeiro responsável.
-- Mudanças aditivas, preservando empresas e vínculos já existentes.
BEGIN;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text;

COMMENT ON COLUMN public.empresas.cep IS 'CEP normalizado com 8 dígitos da sede da Master Franquia.';
COMMENT ON COLUMN public.empresas.endereco IS 'Logradouro da sede da Master Franquia.';

-- Atualização cadastral ampliada. A assinatura nova evita quebrar consumidores
-- históricos da RPC anterior e é resolvida pelo PostgREST pelos nomes dos parâmetros.
CREATE OR REPLACE FUNCTION public.rpc_platform_atualizar_dados_empresa(
  p_empresa_id uuid,
  p_nome_fantasia text,
  p_razao_social text,
  p_cnpj text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_cep text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_numero text DEFAULT NULL,
  p_complemento text DEFAULT NULL,
  p_bairro text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id) THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  UPDATE public.empresas SET
    nome_fantasia = coalesce(nullif(trim(p_nome_fantasia), ''), nome_fantasia),
    razao_social = coalesce(nullif(trim(p_razao_social), ''), razao_social),
    cnpj = nullif(regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'), ''),
    telefone = nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), ''),
    whatsapp = nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), ''),
    email = nullif(lower(trim(p_email)), ''),
    cep = nullif(regexp_replace(coalesce(p_cep, ''), '\D', '', 'g'), ''),
    endereco = nullif(trim(p_endereco), ''),
    numero = nullif(trim(p_numero), ''),
    complemento = nullif(trim(p_complemento), ''),
    bairro = nullif(trim(p_bairro), ''),
    cidade = nullif(trim(p_cidade), ''),
    estado = nullif(upper(trim(p_estado)), ''),
    updated_at = now()
  WHERE id = p_empresa_id;

  INSERT INTO public.plataforma_auditoria(acao, entidade_tipo, entidade_id, campos_alterados, executado_por)
  VALUES (
    'ATUALIZAR_DADOS_EMPRESA', 'empresas', p_empresa_id,
    jsonb_build_object(
      'nome_fantasia', p_nome_fantasia, 'razao_social', p_razao_social,
      'cnpj', p_cnpj, 'telefone', p_telefone, 'whatsapp', p_whatsapp,
      'email', p_email, 'cep', p_cep, 'endereco', p_endereco,
      'numero', p_numero, 'complemento', p_complemento, 'bairro', p_bairro,
      'cidade', p_cidade, 'estado', p_estado
    ), auth.uid()
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_platform_atualizar_dados_empresa(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_atualizar_dados_empresa(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text)
  TO authenticated, service_role;

-- Onboarding atômico com endereço. Reutiliza o provisionamento canônico anterior
-- e completa a sede dentro da mesma transação da chamada RPC.
CREATE OR REPLACE FUNCTION public.rpc_platform_onboarding_master_franquia(
  p_nome_fantasia text,
  p_razao_social text,
  p_slug text,
  p_cnpj text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_modelo_site_id uuid DEFAULT NULL,
  p_usar_logo_propria boolean DEFAULT false,
  p_logo_url text DEFAULT NULL,
  p_menus_habilitados jsonb DEFAULT '[]'::jsonb,
  p_erp_habilitado boolean DEFAULT true,
  p_modulos_erp text[] DEFAULT '{}'::text[],
  p_limite_usuarios integer DEFAULT 10,
  p_responsavel_nome text DEFAULT NULL,
  p_responsavel_email text DEFAULT NULL,
  p_responsavel_telefone text DEFAULT NULL,
  p_administradoras_ids uuid[] DEFAULT '{}'::uuid[],
  p_plano_id uuid DEFAULT NULL,
  p_sites_parceiros_contratados integer DEFAULT 0,
  p_sites_dominio_proprio_contratados integer DEFAULT 0,
  p_cep text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_numero text DEFAULT NULL,
  p_complemento text DEFAULT NULL,
  p_bairro text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_empresa_id uuid;
BEGIN
  v_empresa_id := public.rpc_platform_onboarding_master_franquia(
    p_nome_fantasia, p_razao_social, p_slug, p_cnpj, p_email, p_telefone,
    p_whatsapp, p_cidade, p_estado, p_modelo_site_id, p_usar_logo_propria,
    p_logo_url, p_menus_habilitados, p_erp_habilitado, p_modulos_erp,
    p_limite_usuarios, p_responsavel_nome, p_responsavel_email,
    p_responsavel_telefone, p_administradoras_ids, p_plano_id,
    p_sites_parceiros_contratados, p_sites_dominio_proprio_contratados
  );

  UPDATE public.empresas SET
    cnpj = nullif(regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'), ''),
    telefone = nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), ''),
    whatsapp = nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), ''),
    email = nullif(lower(trim(p_email)), ''),
    cep = nullif(regexp_replace(coalesce(p_cep, ''), '\D', '', 'g'), ''),
    endereco = nullif(trim(p_endereco), ''), numero = nullif(trim(p_numero), ''),
    complemento = nullif(trim(p_complemento), ''), bairro = nullif(trim(p_bairro), ''),
    cidade = nullif(trim(p_cidade), ''), estado = nullif(upper(trim(p_estado)), '')
  WHERE id = v_empresa_id;

  RETURN v_empresa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_platform_onboarding_master_franquia(text,text,text,text,text,text,text,text,text,uuid,boolean,text,jsonb,boolean,text[],integer,text,text,text,uuid[],uuid,integer,integer,text,text,text,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_onboarding_master_franquia(text,text,text,text,text,text,text,text,text,uuid,boolean,text,jsonb,boolean,text[],integer,text,text,text,uuid[],uuid,integer,integer,text,text,text,text,text)
  TO authenticated, service_role;

-- O Platform Superadmin precisa cadastrar o primeiro responsável enquanto a
-- franquia ainda está em treinamento. A ativação continua exigindo esse vínculo.
DO $$
DECLARE v_def text; v_nova text;
BEGIN
  SELECT pg_get_functiondef('public.rpc_platform_convidar_usuario(uuid,text,text,uuid,text[],boolean)'::regprocedure)
    INTO v_def;
  v_nova := replace(
    v_def,
    'WHERE id = p_empresa_id AND ativo = true',
    'WHERE id = p_empresa_id'
  );
  IF v_nova = v_def THEN
    RAISE EXCEPTION 'Definição inesperada de rpc_platform_convidar_usuario; bootstrap não aplicado.';
  END IF;
  EXECUTE v_nova;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';
