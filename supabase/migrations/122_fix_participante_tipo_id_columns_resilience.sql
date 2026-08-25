-- Migration 122: Resiliência de Colunas participante_tipo_id e Blindagem de Triggers de Vendas/Comissões
BEGIN;

-- 1. Garantir coluna participante_tipo_id em todas as tabelas comerciais e de comissão
ALTER TABLE public.participantes_comerciais ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;
ALTER TABLE public.contratacoes_online ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;
ALTER TABLE public.venda_participantes ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;
ALTER TABLE public.comissao_regras_participantes ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;
ALTER TABLE public.comissao_previsoes_participantes ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;
ALTER TABLE public.participante_comissao_perfis ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;
ALTER TABLE public.participante_tipos ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;

-- 2. Atualizar trigger venda_participantes_before_write para ser 100% resiliente
CREATE OR REPLACE FUNCTION public.venda_participantes_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.empresa_id := COALESCE(NEW.empresa_id, (SELECT empresa_id FROM public.vendas WHERE id = NEW.venda_id));

  -- Se o participante não tinha o tipo cadastrado, adiciona automaticamente no catálogo
  IF NEW.participante_comercial_id IS NOT NULL AND NEW.tipo_atuacao IS NOT NULL AND NEW.empresa_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.participante_tipos (empresa_id, participante_id, tipo_codigo)
      VALUES (NEW.empresa_id, NEW.participante_comercial_id, NEW.tipo_atuacao)
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Atualizar vendas_criar_participantes_comerciais com tratamento de exceção completo
CREATE OR REPLACE FUNCTION public.vendas_criar_participantes_comerciais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_contratacao record;
  v_tipo text;
  v_secundario_tipo text;
BEGIN
  IF NEW.contratacao_id IS NULL THEN RETURN NEW; END IF;

  SELECT participante_comercial_id, participante_secundario_id, participante_secundario_fracao_percentual
    INTO v_contratacao
  FROM public.contratacoes_online
  WHERE id = NEW.contratacao_id AND empresa_id = NEW.empresa_id;

  IF v_contratacao.participante_comercial_id IS NULL THEN RETURN NEW; END IF;

  -- Identifica o papel do participante principal
  SELECT COALESCE(
    (SELECT papel_tipo FROM public.participante_comissao_perfis WHERE empresa_id = NEW.empresa_id AND participante_id = v_contratacao.participante_comercial_id AND ativo LIMIT 1),
    (SELECT tipo_codigo FROM public.participante_tipos WHERE empresa_id = NEW.empresa_id AND participante_id = v_contratacao.participante_comercial_id LIMIT 1),
    'CONSULTOR'
  ) INTO v_tipo;

  -- Garante tipo cadastrado
  BEGIN
    INSERT INTO public.participante_tipos (empresa_id, participante_id, tipo_codigo)
    VALUES (NEW.empresa_id, v_contratacao.participante_comercial_id, v_tipo)
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Insere o participante principal na venda
  BEGIN
    INSERT INTO public.venda_participantes(empresa_id, venda_id, participante_comercial_id, papel, tipo_atuacao)
    VALUES (NEW.empresa_id, NEW.id, v_contratacao.participante_comercial_id, 'PARTICIPANTE_PRINCIPAL', v_tipo);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Se houver participante secundário (SDR / Parceiro / Coparticipante)
  IF v_contratacao.participante_secundario_id IS NOT NULL THEN
    SELECT COALESCE(
      (SELECT papel_tipo FROM public.participante_comissao_perfis WHERE empresa_id = NEW.empresa_id AND participante_id = v_contratacao.participante_secundario_id AND ativo LIMIT 1),
      (SELECT tipo_codigo FROM public.participante_tipos WHERE empresa_id = NEW.empresa_id AND participante_id = v_contratacao.participante_secundario_id LIMIT 1),
      'SDR'
    ) INTO v_secundario_tipo;

    BEGIN
      INSERT INTO public.participante_tipos (empresa_id, participante_id, tipo_codigo)
      VALUES (NEW.empresa_id, v_contratacao.participante_secundario_id, v_secundario_tipo)
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    BEGIN
      INSERT INTO public.venda_participantes(
        empresa_id, venda_id, participante_comercial_id, papel, tipo_atuacao, fracao_comissao_percentual
      )
      VALUES (
        NEW.empresa_id, NEW.id, v_contratacao.participante_secundario_id, 'PARTICIPANTE_SECUNDARIO',
        v_secundario_tipo, v_contratacao.participante_secundario_fracao_percentual
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
