-- Migration 085: Plataforma SaaS - Catálogo Operacional Oficial de Grupos
-- Transforma Grupo no catálogo operacional da Administradora:
-- 1. Capacidade total e Vagas disponíveis gerenciáveis
-- 2. Dados estatísticos/lances informativos com histórico auditado (GLOBAL x LOCAL)
-- 3. Modalidades do Grupo e overrides por Cota com modos reduzidos (Fixo / Personalizado)
-- 4. Inserção de cotas em lote e exclusão segura preservando vendas e simulações
-- Forward-only: Preserva 001-084, tabelas, dados, snapshots e histórico intactos.

BEGIN;

-- 1. Campos operacionais e estatísticos em grupos_consorcio
ALTER TABLE public.grupos_consorcio
  ADD COLUMN IF NOT EXISTS capacidade_total integer DEFAULT 0 CHECK (capacidade_total >= 0),
  ADD COLUMN IF NOT EXISTS vagas_disponiveis integer DEFAULT 0 CHECK (vagas_disponiveis >= 0),
  ADD COLUMN IF NOT EXISTS vagas_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS vagas_atualizado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dados_estatisticos jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dados_estatisticos_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS dados_estatisticos_atualizado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- 2. Overrides de modalidade por cota individual
ALTER TABLE public.grupo_cota_modalidade_valores
  ADD COLUMN IF NOT EXISTS habilitado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS modo_reduzido text DEFAULT 'padrao';

-- 3. Histórico de auditoria estatística e operacional do Grupo
CREATE TABLE IF NOT EXISTS public.grupo_estatisticas_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE RESTRICT,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  fonte text NOT NULL CHECK (fonte IN ('GLOBAL', 'LOCAL')),
  campo text NOT NULL,
  valor_anterior jsonb,
  valor_novo jsonb,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grupo_estatisticas_historico_grupo_id
  ON public.grupo_estatisticas_historico(grupo_id, created_at DESC);

ALTER TABLE public.grupo_estatisticas_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grupo_estatisticas_historico_read ON public.grupo_estatisticas_historico;
CREATE POLICY grupo_estatisticas_historico_read
  ON public.grupo_estatisticas_historico
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS grupo_estatisticas_historico_platform_write ON public.grupo_estatisticas_historico;
CREATE POLICY grupo_estatisticas_historico_platform_write
  ON public.grupo_estatisticas_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_superadmin()
    OR (empresa_id IS NOT NULL AND public.can_write_tenant_internal(empresa_id))
  );

-- 4. Overrides locais no ERP (empresa_grupos_config)
ALTER TABLE public.empresa_grupos_config
  ADD COLUMN IF NOT EXISTS usar_dados_globais boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dados_estatisticos_locais jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vagas_disponiveis_locais integer;

-- 5. Atualização da view de prontidão de produtos para considerar override por cota
CREATE OR REPLACE VIEW public.catalogo_produtos_prontidao AS
SELECT
  c.id AS grupo_cota_id,
  c.grupo_id,
  c.ativo,
  count(*) FILTER (WHERE gm.ativo) AS modalidades_exigidas,
  count(mv.id) FILTER (WHERE gm.ativo AND mv.ativo AND mv.habilitado AND mv.valor_parcela > 0) AS modalidades_configuradas,
  (
    c.ativo
    AND c.valor_credito > 0
    AND count(*) FILTER (WHERE gm.ativo) > 0
    AND count(*) FILTER (WHERE gm.ativo) = count(mv.id) FILTER (WHERE gm.ativo AND mv.ativo AND mv.habilitado AND mv.valor_parcela > 0)
  ) AS pronto_para_venda
FROM public.grupos_cotas c
LEFT JOIN public.grupos_modalidades_disponiveis gm ON gm.grupo_id = c.grupo_id
LEFT JOIN public.grupo_cota_modalidade_valores mv ON mv.grupo_cota_id = c.id AND mv.administradora_modalidade_id = gm.administradora_modalidade_id
GROUP BY c.id, c.grupo_id, c.ativo, c.valor_credito;

GRANT SELECT ON public.catalogo_produtos_prontidao TO authenticated, service_role;

-- 6. RPC para salvar / atualizar dados cadastrais e operacionais do Grupo
CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_grupo(
  p_id uuid,
  p_administradora_id uuid,
  p_tipo_administradora_id uuid,
  p_codigo_grupo text,
  p_status text,
  p_ativo boolean,
  p_prazo_total integer,
  p_taxa_administrativa numeric,
  p_fundo_reserva numeric,
  p_seguro_percentual numeric,
  p_capacidade_total integer,
  p_vagas_disponiveis integer,
  p_permite_lance_embutido boolean,
  p_percentual_lance_embutido numeric,
  p_observacoes text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_admin record;
  v_tipo record;
  v_user_id uuid;
  v_old record;
  v_saved record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode gerenciar Grupos';
  END IF;

  SELECT * INTO v_admin FROM public.administradoras WHERE id = p_administradora_id;
  IF v_admin.id IS NULL THEN
    RAISE EXCEPTION 'Administradora não encontrada';
  END IF;

  SELECT * INTO v_tipo FROM public.administradora_tipos
  WHERE id = p_tipo_administradora_id AND administradora_id = p_administradora_id;
  IF v_tipo.id IS NULL THEN
    RAISE EXCEPTION 'Tipo não pertence à Administradora selecionada';
  END IF;

  IF trim(p_codigo_grupo) = '' THEN
    RAISE EXCEPTION 'Código/Número do Grupo é obrigatório';
  END IF;

  SELECT id INTO v_user_id FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1;

  IF p_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.grupos_consorcio WHERE id = p_id FOR UPDATE;
    IF v_old.id IS NULL THEN
      RAISE EXCEPTION 'Grupo não encontrado para atualização';
    END IF;

    UPDATE public.grupos_consorcio
    SET
      administradora_id = p_administradora_id,
      administradora = v_admin.nome,
      tipo_administradora_id = p_tipo_administradora_id,
      modalidade = v_tipo.nome,
      codigo_grupo = trim(p_codigo_grupo),
      status = coalesce(p_status, 'Disponível'),
      ativo = coalesce(p_ativo, true),
      prazo_total = p_prazo_total,
      taxa_administrativa_percentual = p_taxa_administrativa,
      fundo_reserva_percentual = p_fundo_reserva,
      seguro_percentual = p_seguro_percentual,
      capacidade_total = coalesce(p_capacidade_total, 0),
      vagas_disponiveis = coalesce(p_vagas_disponiveis, 0),
      vagas_atualizado_em = CASE WHEN p_vagas_disponiveis IS DISTINCT FROM v_old.vagas_disponiveis THEN now() ELSE v_old.vagas_atualizado_em END,
      vagas_atualizado_por = CASE WHEN p_vagas_disponiveis IS DISTINCT FROM v_old.vagas_disponiveis THEN v_user_id ELSE v_old.vagas_atualizado_por END,
      permite_lance_embutido = coalesce(p_permite_lance_embutido, false),
      percentual_lance_embutido = p_percentual_lance_embutido,
      observacoes = p_observacoes,
      updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_saved;

    -- Registrar histórico de taxas e vagas se alterados
    IF p_vagas_disponiveis IS DISTINCT FROM v_old.vagas_disponiveis THEN
      INSERT INTO public.grupo_estatisticas_historico(
        grupo_id, usuario_id, fonte, campo, valor_anterior, valor_novo, observacao
      ) VALUES (
        p_id, v_user_id, 'GLOBAL', 'vagas_disponiveis',
        to_jsonb(v_old.vagas_disponiveis), to_jsonb(p_vagas_disponiveis), 'Atualização de vagas disponíveis'
      );
    END IF;

    IF p_capacidade_total IS DISTINCT FROM v_old.capacidade_total
       OR p_taxa_administrativa IS DISTINCT FROM v_old.taxa_administrativa_percentual
       OR p_fundo_reserva IS DISTINCT FROM v_old.fundo_reserva_percentual
       OR p_seguro_percentual IS DISTINCT FROM v_old.seguro_percentual THEN
      INSERT INTO public.grupo_estatisticas_historico(
        grupo_id, usuario_id, fonte, campo, valor_anterior, valor_novo, observacao
      ) VALUES (
        p_id, v_user_id, 'GLOBAL', 'dados_cadastrais',
        jsonb_build_object('capacidade', v_old.capacidade_total, 'taxa_adm', v_old.taxa_administrativa_percentual, 'fr', v_old.fundo_reserva_percentual, 'seguro', v_old.seguro_percentual),
        jsonb_build_object('capacidade', p_capacidade_total, 'taxa_adm', p_taxa_administrativa, 'fr', p_fundo_reserva, 'seguro', p_seguro_percentual),
        'Atualização cadastral do grupo'
      );
    END IF;

  ELSE
    INSERT INTO public.grupos_consorcio(
      administradora_id, administradora, tipo_administradora_id, modalidade,
      codigo_grupo, status, ativo, prazo_total, taxa_administrativa_percentual,
      fundo_reserva_percentual, seguro_percentual, capacidade_total, vagas_disponiveis,
      vagas_atualizado_em, vagas_atualizado_por, permite_lance_embutido,
      percentual_lance_embutido, observacoes, origem_governanca, status_governanca
    ) VALUES (
      p_administradora_id, v_admin.nome, p_tipo_administradora_id, v_tipo.nome,
      trim(p_codigo_grupo), coalesce(p_status, 'Disponível'), coalesce(p_ativo, true),
      p_prazo_total, p_taxa_administrativa, p_fundo_reserva, p_seguro_percentual,
      coalesce(p_capacidade_total, 0), coalesce(p_vagas_disponiveis, 0),
      now(), v_user_id, coalesce(p_permite_lance_embutido, false),
      p_percentual_lance_embutido, p_observacoes, 'GLOBAL', 'GLOBAL'
    ) RETURNING * INTO v_saved;

    INSERT INTO public.grupo_estatisticas_historico(
      grupo_id, usuario_id, fonte, campo, valor_anterior, valor_novo, observacao
    ) VALUES (
      v_saved.id, v_user_id, 'GLOBAL', 'criacao',
      NULL, jsonb_build_object('codigo', v_saved.codigo_grupo, 'admin', v_admin.nome), 'Criação do Grupo Global'
    );
  END IF;

  PERFORM public.platform_catalogo_auditar('salvar', 'grupos_consorcio', v_saved.id, '["codigo_grupo","capacidade_total","vagas_disponiveis","taxas"]'::jsonb);

  RETURN to_jsonb(v_saved);
END $$;

-- 7. RPC para cadastro / atualização de cotas em lote com herança de modalidades
CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_cotas_lote(
  p_grupo_id uuid,
  p_valores_credito numeric[]
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_grupo record;
  v_user_id uuid;
  v_credito numeric;
  v_cota_id uuid;
  v_modalidade record;
  v_inseridos integer := 0;
  v_atualizados integer := 0;
  v_novos_ids uuid[] := '{}';
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode cadastrar cotas em lote';
  END IF;

  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = p_grupo_id;
  IF v_grupo.id IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  SELECT id INTO v_user_id FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1;

  FOREACH v_credito IN ARRAY p_valores_credito LOOP
    IF v_credito > 0 THEN
      SELECT id INTO v_cota_id FROM public.grupos_cotas
      WHERE grupo_id = p_grupo_id AND abs(valor_credito - v_credito) < 0.01
      LIMIT 1;

      IF v_cota_id IS NOT NULL THEN
        UPDATE public.grupos_cotas
        SET ativo = true, status = 'Disponível', updated_at = now()
        WHERE id = v_cota_id;
        v_atualizados := v_atualizados + 1;
      ELSE
        INSERT INTO public.grupos_cotas(grupo_id, valor_credito, valor_parcela, status, ativo)
        VALUES (p_grupo_id, v_credito, 0, 'Disponível', true)
        RETURNING id INTO v_cota_id;
        v_inseridos := v_inseridos + 1;
      END IF;

      v_novos_ids := array_append(v_novos_ids, v_cota_id);

      -- Inicializar valores para modalidades ativas do grupo caso não existam
      FOR v_modalidade IN
        SELECT gm.administradora_modalidade_id, gm.configuracao
        FROM public.grupos_modalidades_disponiveis gm
        WHERE gm.grupo_id = p_grupo_id AND gm.ativo
      LOOP
        INSERT INTO public.grupo_cota_modalidade_valores(
          grupo_cota_id, administradora_modalidade_id, valor_parcela, habilitado, ativo
        ) VALUES (
          v_cota_id, v_modalidade.administradora_modalidade_id, 1, true, true
        )
        ON CONFLICT (grupo_cota_id, administradora_modalidade_id)
        DO UPDATE SET ativo = true, updated_at = now();
      END LOOP;
    END IF;
  END LOOP;

  INSERT INTO public.grupo_estatisticas_historico(
    grupo_id, usuario_id, fonte, campo, valor_anterior, valor_novo, observacao
  ) VALUES (
    p_grupo_id, v_user_id, 'GLOBAL', 'cotas_lote',
    NULL, jsonb_build_object('total_processado', array_length(p_valores_credito, 1), 'inseridos', v_inseridos, 'atualizados', v_atualizados),
    'Cadastro de cotas em lote'
  );

  PERFORM public.platform_catalogo_auditar('cotas_lote', 'grupos_consorcio', p_grupo_id, jsonb_build_object('inseridos', v_inseridos, 'atualizados', v_atualizados));

  RETURN jsonb_build_object('sucesso', true, 'inseridos', v_inseridos, 'atualizados', v_atualizados, 'cotas', v_novos_ids);
END $$;

-- 8. RPC para configurar modalidades disponíveis no Grupo
CREATE OR REPLACE FUNCTION public.rpc_platform_configurar_modalidades_grupo(
  p_grupo_id uuid,
  p_modalidades_config jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_grupo record;
  v_user_id uuid;
  v_item jsonb;
  v_mod_id uuid;
  v_ativo boolean;
  v_cfg jsonb;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode configurar modalidades do Grupo';
  END IF;

  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = p_grupo_id;
  IF v_grupo.id IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  SELECT id INTO v_user_id FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_modalidades_config) LOOP
    v_mod_id := (v_item->>'modalidade_id')::uuid;
    v_ativo := coalesce((v_item->>'ativo')::boolean, true);
    v_cfg := coalesce(v_item->'configuracao', '{}'::jsonb);

    INSERT INTO public.grupos_modalidades_disponiveis(
      grupo_id, administradora_modalidade_id, ativo, configuracao, updated_at
    ) VALUES (
      p_grupo_id, v_mod_id, v_ativo, v_cfg, now()
    )
    ON CONFLICT (grupo_id, administradora_modalidade_id)
    DO UPDATE SET
      ativo = v_ativo,
      configuracao = v_cfg,
      updated_at = now();

    -- Se modalidade foi desativada no nível Grupo, desativa para todas as cotas do grupo
    IF NOT v_ativo THEN
      UPDATE public.grupo_cota_modalidade_valores mv
      SET habilitado = false, updated_at = now()
      FROM public.grupos_cotas gc
      WHERE gc.id = mv.grupo_cota_id
        AND gc.grupo_id = p_grupo_id
        AND mv.administradora_modalidade_id = v_mod_id;
    END IF;
  END LOOP;

  INSERT INTO public.grupo_estatisticas_historico(
    grupo_id, usuario_id, fonte, campo, valor_anterior, valor_novo, observacao
  ) VALUES (
    p_grupo_id, v_user_id, 'GLOBAL', 'modalidades',
    NULL, p_modalidades_config, 'Atualização de modalidades disponíveis no Grupo'
  );

  PERFORM public.platform_catalogo_auditar('modalidades', 'grupos_consorcio', p_grupo_id, p_modalidades_config);

  RETURN jsonb_build_object('sucesso', true);
END $$;

-- 9. RPC para salvar override de modalidade em cota individual
CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_cota_modalidade(
  p_grupo_cota_id uuid,
  p_modalidade_id uuid,
  p_valor_parcela numeric,
  p_habilitado boolean,
  p_modo_reduzido text,
  p_percentual_reducao numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_cota record;
  v_saved record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin';
  END IF;

  SELECT * INTO v_cota FROM public.grupos_cotas WHERE id = p_grupo_cota_id;
  IF v_cota.id IS NULL THEN
    RAISE EXCEPTION 'Cota não encontrada';
  END IF;

  INSERT INTO public.grupo_cota_modalidade_valores(
    grupo_cota_id, administradora_modalidade_id, valor_parcela,
    habilitado, modo_reduzido, percentual_reducao, ativo, updated_at
  ) VALUES (
    p_grupo_cota_id, p_modalidade_id, coalesce(p_valor_parcela, 0),
    coalesce(p_habilitado, true), coalesce(p_modo_reduzido, 'padrao'),
    p_percentual_reducao, true, now()
  )
  ON CONFLICT (grupo_cota_id, administradora_modalidade_id)
  DO UPDATE SET
    valor_parcela = coalesce(p_valor_parcela, grupo_cota_modalidade_valores.valor_parcela),
    habilitado = coalesce(p_habilitado, grupo_cota_modalidade_valores.habilitado),
    modo_reduzido = coalesce(p_modo_reduzido, grupo_cota_modalidade_valores.modo_reduzido),
    percentual_reducao = p_percentual_reducao,
    ativo = true,
    updated_at = now()
  RETURNING * INTO v_saved;

  RETURN to_jsonb(v_saved);
END $$;

-- 10. RPC para salvar dados estatísticos / lances do Grupo (GLOBAL ou LOCAL)
CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_estatisticas_grupo(
  p_grupo_id uuid,
  p_empresa_id uuid,
  p_fonte text,
  p_dados_estatisticos jsonb,
  p_vagas_disponiveis integer,
  p_usar_dados_globais boolean
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_grupo record;
  v_user_id uuid;
  v_old_stats jsonb;
  v_old_vagas integer;
BEGIN
  SELECT id INTO v_user_id FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1;

  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = p_grupo_id;
  IF v_grupo.id IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  IF upper(p_fonte) = 'GLOBAL' THEN
    IF NOT public.is_platform_superadmin() THEN
      RAISE EXCEPTION 'Somente Platform Superadmin pode alterar estatísticas GLOBAIS';
    END IF;

    v_old_stats := v_grupo.dados_estatisticos;
    v_old_vagas := v_grupo.vagas_disponiveis;

    UPDATE public.grupos_consorcio
    SET
      dados_estatisticos = p_dados_estatisticos,
      dados_estatisticos_atualizado_em = now(),
      dados_estatisticos_atualizado_por = v_user_id,
      vagas_disponiveis = coalesce(p_vagas_disponiveis, vagas_disponiveis),
      vagas_atualizado_em = CASE WHEN p_vagas_disponiveis IS DISTINCT FROM vagas_disponiveis THEN now() ELSE vagas_atualizado_em END,
      vagas_atualizado_por = CASE WHEN p_vagas_disponiveis IS DISTINCT FROM vagas_disponiveis THEN v_user_id ELSE vagas_atualizado_por END,
      updated_at = now()
    WHERE id = p_grupo_id;

    INSERT INTO public.grupo_estatisticas_historico(
      grupo_id, empresa_id, usuario_id, fonte, campo, valor_anterior, valor_novo, observacao
    ) VALUES (
      p_grupo_id, NULL, v_user_id, 'GLOBAL', 'estatisticas',
      v_old_stats, p_dados_estatisticos, 'Atualização de estatísticas globais'
    );

  ELSE
    -- Atualização LOCAL no ERP da Empresa
    IF p_empresa_id IS NULL OR NOT public.can_write_tenant_internal(p_empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para atualizar estatísticas locais desta empresa';
    END IF;

    INSERT INTO public.empresa_grupos_config(
      empresa_id, grupo_id, usar_dados_globais, dados_estatisticos_locais,
      vagas_disponiveis_locais, updated_at
    ) VALUES (
      p_empresa_id, p_grupo_id, coalesce(p_usar_dados_globais, true),
      p_dados_estatisticos, p_vagas_disponiveis, now()
    )
    ON CONFLICT (empresa_id, grupo_id)
    DO UPDATE SET
      usar_dados_globais = coalesce(p_usar_dados_globais, empresa_grupos_config.usar_dados_globais),
      dados_estatisticos_locais = p_dados_estatisticos,
      vagas_disponiveis_locais = coalesce(p_vagas_disponiveis, empresa_grupos_config.vagas_disponiveis_locais),
      updated_at = now();

    INSERT INTO public.grupo_estatisticas_historico(
      grupo_id, empresa_id, usuario_id, fonte, campo, valor_anterior, valor_novo, observacao
    ) VALUES (
      p_grupo_id, p_empresa_id, v_user_id, 'LOCAL', 'estatisticas',
      NULL, p_dados_estatisticos, 'Atualização de estatísticas locais da empresa'
    );
  END IF;

  RETURN jsonb_build_object('sucesso', true);
END $$;

-- 11. RPC para exclusão segura de cota / produto
CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_cota_produto(
  p_grupo_cota_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_cota record;
  v_usado boolean := false;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin';
  END IF;

  SELECT * INTO v_cota FROM public.grupos_cotas WHERE id = p_grupo_cota_id;
  IF v_cota.id IS NULL THEN
    RAISE EXCEPTION 'Cota não encontrada';
  END IF;

  SELECT (
    EXISTS (SELECT 1 FROM public.vendas WHERE opcao_cota_id = p_grupo_cota_id)
    OR EXISTS (SELECT 1 FROM public.simulacoes_grupos_itens WHERE grupo_cota_id = p_grupo_cota_id)
  ) INTO v_usado;

  IF v_usado THEN
    UPDATE public.grupos_cotas
    SET ativo = false, status = 'Inativo', updated_at = now()
    WHERE id = p_grupo_cota_id;
    RETURN jsonb_build_object('sucesso', true, 'acao', 'INATIVADO', 'mensagem', 'Cota possui histórico e foi inativada');
  ELSE
    DELETE FROM public.grupo_cota_modalidade_valores WHERE grupo_cota_id = p_grupo_cota_id;
    DELETE FROM public.grupos_cotas WHERE id = p_grupo_cota_id;
    RETURN jsonb_build_object('sucesso', true, 'acao', 'EXCLUIDO', 'mensagem', 'Cota excluída definitivamente');
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.rpc_platform_salvar_grupo(uuid,uuid,uuid,text,text,boolean,integer,numeric,numeric,numeric,integer,integer,boolean,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_salvar_grupo(uuid,uuid,uuid,text,text,boolean,integer,numeric,numeric,numeric,integer,integer,boolean,numeric,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_platform_salvar_cotas_lote(uuid,numeric[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_salvar_cotas_lote(uuid,numeric[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_platform_configurar_modalidades_grupo(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_configurar_modalidades_grupo(uuid,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_platform_salvar_cota_modalidade(uuid,uuid,numeric,boolean,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_salvar_cota_modalidade(uuid,uuid,numeric,boolean,text,numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_platform_salvar_estatisticas_grupo(uuid,uuid,text,jsonb,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_salvar_estatisticas_grupo(uuid,uuid,text,jsonb,integer,boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_platform_excluir_cota_produto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_excluir_cota_produto(uuid) TO authenticated, service_role;

COMMIT;
