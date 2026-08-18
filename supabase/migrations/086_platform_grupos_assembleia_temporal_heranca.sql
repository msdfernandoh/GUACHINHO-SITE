-- Migration 086: Suporte a data da 1ª assembleia, cálculo temporal de prazo/assembleias e herança de padrões de modalidades da Administradora.
-- Forward-only; preserva todas as vendas, snapshots, regras de comissão e integridade relacional.

-- 1. Adicionar data_primeira_assembleia em grupos_consorcio
ALTER TABLE public.grupos_consorcio
  ADD COLUMN IF NOT EXISTS data_primeira_assembleia date;

-- 2. Adicionar campos de configuração padrão em administradora_modalidades_comissao
ALTER TABLE public.administradora_modalidades_comissao
  ADD COLUMN IF NOT EXISTS modo_reduzido_padrao text DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS percentual_padrao numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS percentual_minimo numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS percentual_maximo numeric DEFAULT NULL;

-- 3. Atualizar padrões das modalidades Racon existentes
UPDATE public.administradora_modalidades_comissao
SET modo_reduzido_padrao = 'fixo',
    percentual_padrao = 100,
    percentual_minimo = 100,
    percentual_maximo = 100
WHERE codigo = 'INTEGRAL' AND percentual_padrao IS NULL;

UPDATE public.administradora_modalidades_comissao
SET modo_reduzido_padrao = 'fixo',
    percentual_padrao = 60,
    percentual_minimo = 60,
    percentual_maximo = 99
WHERE codigo = 'REDUZIDA_60_99' AND percentual_padrao IS NULL;

UPDATE public.administradora_modalidades_comissao
SET modo_reduzido_padrao = 'fixo',
    percentual_padrao = 50,
    percentual_minimo = 30,
    percentual_maximo = 59
WHERE codigo = 'REDUZIDA_ABAIXO_59' AND percentual_padrao IS NULL;

-- 4. Atualizar RPC rpc_platform_salvar_grupo para receber p_data_primeira_assembleia
CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_grupo(
  p_id uuid DEFAULT NULL,
  p_administradora_id uuid DEFAULT NULL,
  p_tipo_administradora_id uuid DEFAULT NULL,
  p_codigo_grupo text DEFAULT NULL,
  p_status text DEFAULT 'Disponível',
  p_ativo boolean DEFAULT true,
  p_prazo_total integer DEFAULT NULL,
  p_taxa_administrativa numeric DEFAULT 0,
  p_fundo_reserva numeric DEFAULT 0,
  p_seguro_percentual numeric DEFAULT 0,
  p_capacidade_total integer DEFAULT 0,
  p_vagas_disponiveis integer DEFAULT 0,
  p_permite_lance_embutido boolean DEFAULT false,
  p_percentual_lance_embutido numeric DEFAULT 0,
  p_observacoes text DEFAULT NULL,
  p_data_primeira_assembleia date DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_grupo record;
  v_codigo text := upper(trim(p_codigo_grupo));
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode cadastrar ou editar Grupos Globais';
  END IF;

  IF p_administradora_id IS NULL THEN
    RAISE EXCEPTION 'Administradora é obrigatória';
  END IF;

  IF p_tipo_administradora_id IS NULL THEN
    RAISE EXCEPTION 'Tipo oficial da Administradora é obrigatório';
  END IF;

  IF v_codigo IS NULL OR length(v_codigo) = 0 THEN
    RAISE EXCEPTION 'Código/Número do Grupo é obrigatório';
  END IF;

  IF p_id IS NULL THEN
    -- Inserção de novo grupo
    IF EXISTS (
      SELECT 1 FROM public.grupos_consorcio
      WHERE administradora_id = p_administradora_id AND upper(trim(codigo_grupo)) = v_codigo
    ) THEN
      RAISE EXCEPTION 'Já existe um Grupo com o número % nesta Administradora', v_codigo;
    END IF;

    INSERT INTO public.grupos_consorcio (
      administradora_id,
      tipo_administradora_id,
      codigo_grupo,
      status,
      ativo,
      prazo_total,
      taxa_administrativa_percentual,
      fundo_reserva_percentual,
      seguro_percentual,
      capacidade_total,
      vagas_disponiveis,
      vagas_atualizado_em,
      vagas_atualizado_por,
      permite_lance_embutido,
      percentual_lance_embutido,
      observacoes,
      origem_governanca,
      status_governanca,
      data_primeira_assembleia
    ) VALUES (
      p_administradora_id,
      p_tipo_administradora_id,
      v_codigo,
      p_status,
      p_ativo,
      p_prazo_total,
      p_taxa_administrativa,
      p_fundo_reserva,
      p_seguro_percentual,
      p_capacidade_total,
      p_vagas_disponiveis,
      CASE WHEN p_vagas_disponiveis > 0 THEN now() ELSE NULL END,
      CASE WHEN p_vagas_disponiveis > 0 THEN public.current_usuario_id() ELSE NULL END,
      p_permite_lance_embutido,
      p_percentual_lance_embutido,
      p_observacoes,
      'PLATFORM',
      'GLOBAL',
      p_data_primeira_assembleia
    ) RETURNING * INTO v_grupo;

    -- Vincular automaticamente as modalidades da Administradora ao novo grupo com herança dos padrões
    INSERT INTO public.grupos_modalidades_disponiveis (
      grupo_id,
      administradora_modalidade_id,
      ativo,
      ordem,
      configuracao
    )
    SELECT
      v_grupo.id,
      m.id,
      true,
      1,
      jsonb_build_object(
        'origem', 'ADMINISTRADORA_PADRAO',
        'modo_reduzido', coalesce(m.modo_reduzido_padrao, 'fixo'),
        'percentual_padrao', m.percentual_padrao,
        'percentual_minimo', m.percentual_minimo,
        'percentual_maximo', m.percentual_maximo
      )
    FROM public.administradora_modalidades_comissao m
    WHERE m.administradora_id = p_administradora_id AND m.ativo;

  ELSE
    -- Atualização de grupo existente
    IF EXISTS (
      SELECT 1 FROM public.grupos_consorcio
      WHERE administradora_id = p_administradora_id AND upper(trim(codigo_grupo)) = v_codigo AND id <> p_id
    ) THEN
      RAISE EXCEPTION 'Já existe outro Grupo com o número % nesta Administradora', v_codigo;
    END IF;

    UPDATE public.grupos_consorcio
    SET administradora_id = p_administradora_id,
        tipo_administradora_id = p_tipo_administradora_id,
        codigo_grupo = v_codigo,
        status = p_status,
        ativo = p_ativo,
        prazo_total = p_prazo_total,
        taxa_administrativa_percentual = p_taxa_administrativa,
        fundo_reserva_percentual = p_fundo_reserva,
        seguro_percentual = p_seguro_percentual,
        capacidade_total = p_capacidade_total,
        vagas_disponiveis = p_vagas_disponiveis,
        vagas_atualizado_em = CASE WHEN vagas_disponiveis IS DISTINCT FROM p_vagas_disponiveis THEN now() ELSE vagas_atualizado_em END,
        vagas_atualizado_por = CASE WHEN vagas_disponiveis IS DISTINCT FROM p_vagas_disponiveis THEN public.current_usuario_id() ELSE vagas_atualizado_por END,
        permite_lance_embutido = p_permite_lance_embutido,
        percentual_lance_embutido = p_percentual_lance_embutido,
        observacoes = p_observacoes,
        data_primeira_assembleia = p_data_primeira_assembleia,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_grupo;
  END IF;

  RETURN to_jsonb(v_grupo);
END $$;
