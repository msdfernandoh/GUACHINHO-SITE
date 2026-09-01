-- Fase 193: onboarding integrado de parceiro, modelo publicado e conversao segura de Master vazia.

ALTER TABLE public.parceiro_sites
  ADD COLUMN IF NOT EXISTS site_modelo_id uuid REFERENCES public.site_modelos(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS parceiro_sites_site_modelo_idx
  ON public.parceiro_sites(site_modelo_id)
  WHERE site_modelo_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rpc_platform_criar_organizacao_site_parceiro(
  p_empresa_id uuid,
  p_organizacao_parceira_id uuid DEFAULT NULL,
  p_nova_organizacao_nome text DEFAULT NULL,
  p_nova_organizacao_cnpj text DEFAULT NULL,
  p_slug text DEFAULT NULL,
  p_nome_site text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_canal text DEFAULT 'SUBDOMINIO',
  p_identidade_visual_modo text DEFAULT 'HERDAR_MASTER',
  p_site_modelo_id uuid DEFAULT NULL,
  p_cor_primaria text DEFAULT NULL,
  p_cor_secundaria text DEFAULT NULL,
  p_cor_destaque text DEFAULT NULL,
  p_logo_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_org_id uuid := p_organizacao_parceira_id;
  v_site_id uuid;
  v_modelo public.site_modelos%rowtype;
  v_renderer text := 'institucional_v1';
  v_atual uuid;
  v_proximo uuid;
  v_visitados uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id) THEN
    RAISE EXCEPTION 'Master Franquia anfitria inexistente.';
  END IF;

  IF v_org_id IS NULL THEN
    IF nullif(trim(coalesce(p_nova_organizacao_nome, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Selecione uma organizacao ou informe o nome da nova parceira.';
    END IF;
    INSERT INTO public.organizacoes_parceiras(
      empresa_id, tipo, nome_fantasia, cnpj, status, whatsapp, created_by_usuario_id
    ) VALUES (
      p_empresa_id, 'PARCEIRO_COMERCIAL', trim(p_nova_organizacao_nome),
      public.normalize_digits(p_nova_organizacao_cnpj), 'ATIVA',
      nullif(trim(coalesce(p_whatsapp, '')), ''), public.current_usuario_id()
    ) RETURNING id INTO v_org_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.organizacoes_parceiras
    WHERE id = v_org_id AND empresa_id = p_empresa_id AND status = 'ATIVA'
  ) THEN
    RAISE EXCEPTION 'Organizacao parceira ausente, inativa ou de outro tenant.';
  END IF;

  v_site_id := public.rpc_platform_criar_site_parceiro(
    p_empresa_id, v_org_id, p_slug, p_nome_site, p_whatsapp, p_canal,
    p_identidade_visual_modo, p_cor_primaria, p_cor_secundaria,
    p_cor_destaque, p_logo_url
  );

  IF p_identidade_visual_modo = 'PERSONALIZADA' THEN
    IF p_site_modelo_id IS NULL THEN
      RAISE EXCEPTION 'Selecione um modelo publicado para personalizar o site.';
    END IF;
    SELECT * INTO v_modelo FROM public.site_modelos
    WHERE id = p_site_modelo_id AND status = 'PUBLICADO';
    IF NOT FOUND THEN RAISE EXCEPTION 'Modelo de site inexistente ou nao publicado.'; END IF;

    v_atual := v_modelo.id;
    LOOP
      IF v_atual = ANY(v_visitados) OR cardinality(v_visitados) >= 12 THEN
        RAISE EXCEPTION 'Ciclo ou profundidade invalida na familia do modelo.';
      END IF;
      v_visitados := array_append(v_visitados, v_atual);
      SELECT codigo, modelo_origem_id INTO v_renderer, v_proximo
      FROM public.site_modelos WHERE id = v_atual;
      EXIT WHEN v_proximo IS NULL;
      v_atual := v_proximo;
    END LOOP;
    IF v_renderer = 'racon_inspired' THEN v_renderer := 'racon_inspired';
    ELSE v_renderer := 'institucional_v1'; END IF;

    UPDATE public.parceiro_sites
    SET site_modelo_id = v_modelo.id,
        template_codigo = v_renderer,
        branding = branding || jsonb_build_object(
          'site_modelo_id', v_modelo.id,
          'site_modelo_nome', v_modelo.nome,
          'modelo_identidade', coalesce(v_modelo.identidade_visual, '{}'::jsonb)
        )
    WHERE id = v_site_id AND empresa_id = p_empresa_id;
  END IF;

  RETURN jsonb_build_object('organizacao_id', v_org_id, 'site_id', v_site_id);
END;
$$;

-- Converte apenas Masters sem fatos operacionais. A origem fica suspensa e auditavel.
CREATE OR REPLACE FUNCTION public.rpc_platform_converter_master_em_parceira(
  p_empresa_origem_id uuid,
  p_empresa_destino_id uuid,
  p_site_modelo_id uuid DEFAULT NULL,
  p_confirmacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_origem public.empresas%rowtype;
  v_result jsonb;
  v_org_id uuid;
  v_site_id uuid;
  v_modelo_id uuid;
  v_dominio record;
  v_vinculo record;
  v_papel_id uuid;
  v_participante_id uuid;
  v_total bigint;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.'; END IF;
  IF p_confirmacao IS DISTINCT FROM 'CONVERTER PARA PARCEIRO' THEN
    RAISE EXCEPTION 'Confirmacao explicita invalida.';
  END IF;
  IF p_empresa_origem_id = p_empresa_destino_id THEN RAISE EXCEPTION 'Origem e anfitria devem ser diferentes.'; END IF;

  SELECT * INTO v_origem FROM public.empresas WHERE id = p_empresa_origem_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Master de origem inexistente.'; END IF;
  PERFORM 1 FROM public.empresas WHERE id = p_empresa_destino_id AND ativo = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'A Master anfitria precisa estar ativa.'; END IF;
  IF coalesce(v_origem.configuracoes->'conversao_parceiro'->>'destino_empresa_id', '') <> '' THEN
    RAISE EXCEPTION 'Esta Master ja foi convertida em parceira.';
  END IF;

  SELECT
    (SELECT count(*) FROM public.leads WHERE empresa_id=p_empresa_origem_id) +
    (SELECT count(*) FROM public.propostas WHERE empresa_id=p_empresa_origem_id) +
    (SELECT count(*) FROM public.contratacoes_online WHERE empresa_id=p_empresa_origem_id) +
    (SELECT count(*) FROM public.vendas WHERE empresa_id=p_empresa_origem_id) +
    (SELECT count(*) FROM public.caixa_movimentos WHERE empresa_id=p_empresa_origem_id)
  INTO v_total;
  IF v_total > 0 THEN
    RAISE EXCEPTION 'Conversao automatica bloqueada: a Master possui % fatos operacionais. Use migracao assistida com auditoria.', v_total;
  END IF;

  SELECT modelo_id INTO v_modelo_id FROM public.empresa_site_modelos
  WHERE empresa_id=p_empresa_origem_id;
  v_modelo_id := coalesce(p_site_modelo_id, v_modelo_id);

  SELECT * INTO v_dominio FROM public.empresa_dominios
  WHERE empresa_id=p_empresa_origem_id AND principal=true
  ORDER BY ativo DESC, verificado DESC LIMIT 1;

  v_result := public.rpc_platform_criar_organizacao_site_parceiro(
    p_empresa_destino_id, NULL, v_origem.nome_fantasia, v_origem.cnpj,
    v_origem.slug, v_origem.nome_fantasia, coalesce(v_origem.whatsapp, v_origem.telefone),
    CASE WHEN v_dominio.id IS NULL THEN 'SUBDOMINIO' ELSE 'DOMINIO' END,
    'PERSONALIZADA', v_modelo_id, NULL, NULL, NULL, NULL
  );
  v_org_id := (v_result->>'organizacao_id')::uuid;
  v_site_id := (v_result->>'site_id')::uuid;

  IF v_dominio.id IS NOT NULL THEN
    UPDATE public.empresa_dominios SET ativo=false, principal=false WHERE empresa_id=p_empresa_origem_id;
    INSERT INTO public.parceiro_site_dominios(
      empresa_id, parceiro_site_id, valor, tipo, principal, verificado, status, ssl_status,
      dns_instrucoes, created_by_usuario_id
    ) VALUES (
      p_empresa_destino_id, v_site_id, lower(regexp_replace(v_dominio.valor, '^www\.', '')),
      'DOMINIO_PROPRIO', true, coalesce(v_dominio.verificado,false),
      CASE WHEN v_dominio.verificado THEN 'ATIVO' ELSE 'PENDENTE_DNS' END,
      CASE WHEN coalesce(v_dominio.status_ssl,'') IN ('READY','ATIVO') THEN 'READY' ELSE 'PENDING' END,
      coalesce(v_dominio.dns_instrucoes,'{}'::jsonb), public.current_usuario_id()
    );
  END IF;

  SELECT eu.usuario_id, u.nome, u.email INTO v_vinculo
  FROM public.empresa_usuarios eu JOIN public.usuarios u ON u.id=eu.usuario_id
  WHERE eu.empresa_id=p_empresa_origem_id AND eu.ativo=true
  ORDER BY eu.is_responsavel_principal DESC, eu.created_at ASC LIMIT 1;
  IF v_vinculo.usuario_id IS NOT NULL THEN
    SELECT id INTO v_papel_id FROM public.papeis
    WHERE codigo='parceiro_comercial' AND empresa_id IS NULL AND ativo=true;
    IF NOT EXISTS (SELECT 1 FROM public.empresa_usuarios WHERE empresa_id=p_empresa_destino_id AND usuario_id=v_vinculo.usuario_id AND ativo=true) THEN
      INSERT INTO public.empresa_usuarios(empresa_id,usuario_id,papel_id,ativo,origem,status,erp_modulos_visiveis)
      VALUES(p_empresa_destino_id,v_vinculo.usuario_id,v_papel_id,true,'CONVERSAO_MASTER_PARCEIRO','ATIVO','{}'::text[]);
    END IF;
    SELECT id INTO v_participante_id FROM public.participantes_comerciais
    WHERE empresa_id=p_empresa_destino_id AND usuario_id=v_vinculo.usuario_id AND status='ATIVO';
    IF v_participante_id IS NULL THEN
      INSERT INTO public.participantes_comerciais(empresa_id,usuario_id,nome,email,telefone,whatsapp,status,cargo)
      VALUES(p_empresa_destino_id,v_vinculo.usuario_id,v_vinculo.nome,v_vinculo.email,
        v_origem.telefone,v_origem.whatsapp,'ATIVO','Responsavel parceiro') RETURNING id INTO v_participante_id;
    END IF;
    INSERT INTO public.participante_tipos(participante_id,empresa_id,tipo_codigo)
    VALUES(v_participante_id,p_empresa_destino_id,'RESPONSAVEL_PARCEIRO') ON CONFLICT DO NOTHING;
    INSERT INTO public.participante_organizacoes(empresa_id,participante_id,organizacao_parceira_id,funcao,principal,responsavel_principal,ativo)
    VALUES(p_empresa_destino_id,v_participante_id,v_org_id,'Responsavel principal',true,true,true)
    ON CONFLICT(participante_id,organizacao_parceira_id) DO UPDATE SET ativo=true,principal=true,responsavel_principal=true;
  END IF;

  UPDATE public.empresas SET status='suspenso', ativo=false,
    configuracoes=jsonb_set(coalesce(configuracoes,'{}'::jsonb),'{conversao_parceiro}',jsonb_build_object(
      'destino_empresa_id',p_empresa_destino_id,'organizacao_id',v_org_id,'site_id',v_site_id,'convertida_em',now()
    ),true)
  WHERE id=p_empresa_origem_id;

  INSERT INTO public.plataforma_auditoria(acao,entidade_tipo,entidade_id,campos_alterados,executado_por)
  VALUES('CONVERTER_MASTER_EM_PARCEIRA','empresas',p_empresa_origem_id,jsonb_build_object(
    'destino_empresa_id',p_empresa_destino_id,'organizacao_id',v_org_id,'site_id',v_site_id,'fatos_operacionais',v_total
  ),auth.uid());
  RETURN jsonb_build_object('organizacao_id',v_org_id,'site_id',v_site_id,'empresa_origem_preservada',p_empresa_origem_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_platform_definir_modelo_site_parceiro(
  p_empresa_id uuid,
  p_site_id uuid,
  p_site_modelo_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_modelo public.site_modelos%rowtype;
  v_atual uuid;
  v_proximo uuid;
  v_renderer text;
  v_visitados uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parceiro_sites WHERE id=p_site_id AND empresa_id=p_empresa_id) THEN
    RAISE EXCEPTION 'Site parceiro inexistente ou de outro tenant.';
  END IF;
  SELECT * INTO v_modelo FROM public.site_modelos WHERE id=p_site_modelo_id AND status='PUBLICADO';
  IF NOT FOUND THEN RAISE EXCEPTION 'Modelo de site inexistente ou nao publicado.'; END IF;
  v_atual := v_modelo.id;
  LOOP
    IF v_atual = ANY(v_visitados) OR cardinality(v_visitados) >= 12 THEN RAISE EXCEPTION 'Familia de modelo invalida.'; END IF;
    v_visitados := array_append(v_visitados,v_atual);
    SELECT codigo,modelo_origem_id INTO v_renderer,v_proximo FROM public.site_modelos WHERE id=v_atual;
    EXIT WHEN v_proximo IS NULL;
    v_atual := v_proximo;
  END LOOP;
  IF v_renderer <> 'racon_inspired' THEN v_renderer := 'institucional_v1'; END IF;
  UPDATE public.parceiro_sites SET site_modelo_id=v_modelo.id,template_codigo=v_renderer,
    branding=branding||jsonb_build_object('site_modelo_id',v_modelo.id,'site_modelo_nome',v_modelo.nome,'modelo_identidade',coalesce(v_modelo.identidade_visual,'{}'::jsonb))
  WHERE id=p_site_id AND empresa_id=p_empresa_id;
  INSERT INTO public.plataforma_auditoria(acao,entidade_tipo,entidade_id,campos_alterados,executado_por)
  VALUES('DEFINIR_MODELO_SITE_PARCEIRO','parceiro_sites',p_site_id,jsonb_build_object('empresa_id',p_empresa_id,'site_modelo_id',p_site_modelo_id,'renderer',v_renderer),auth.uid());
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_platform_criar_organizacao_site_parceiro(uuid,uuid,text,text,text,text,text,text,text,uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_criar_organizacao_site_parceiro(uuid,uuid,text,text,text,text,text,text,text,uuid,text,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_platform_converter_master_em_parceira(uuid,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_converter_master_em_parceira(uuid,uuid,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_platform_definir_modelo_site_parceiro(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_definir_modelo_site_parceiro(uuid,uuid,uuid) TO authenticated;
