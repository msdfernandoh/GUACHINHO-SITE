-- 139 — Catálogo escalável: créditos, categorias N:N e autonomia local segura.
--
-- Invariantes:
-- * grupos/categorias/créditos oficiais continuam globais;
-- * a franquia só reduz disponibilidade e mantém uma alteração candidata local;
-- * nenhuma parcela pronta é exigida no catálogo: o site calcula a partir do
--   crédito, prazo, taxas, seguro e modalidades habilitadas;
-- * zero vagas não despublica o grupo.
BEGIN;

CREATE TABLE IF NOT EXISTS public.catalogo_grupo_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE CHECK (codigo = upper(codigo) AND codigo ~ '^[A-Z0-9_]+$'),
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grupos_categorias (
  grupo_id uuid NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE RESTRICT,
  categoria_id uuid NOT NULL REFERENCES public.catalogo_grupo_categorias(id) ON DELETE RESTRICT,
  principal boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grupo_id, categoria_id)
);

INSERT INTO public.catalogo_grupo_categorias(codigo,nome,ordem)
VALUES
  ('IMOVEL','Imóvel',10),
  ('AUTOMOVEL','Automóvel',20),
  ('MOTO','Moto',30),
  ('CAMINHAO','Caminhão / Carreta',40),
  ('SERVICOS','Serviços',50),
  ('OUTROS','Outros',90)
ON CONFLICT (codigo) DO UPDATE SET nome=excluded.nome, ordem=excluded.ordem, ativo=true, updated_at=now();

-- Backfill determinístico e não destrutivo. Um segundo vínculo (por exemplo,
-- Automóvel + Moto) é acrescentado depois pela Platform, sem duplicar o grupo.
INSERT INTO public.grupos_categorias(grupo_id,categoria_id,principal,ordem)
SELECT g.id, c.id, true, 0
FROM public.grupos_consorcio g
LEFT JOIN public.administradora_tipos t ON t.id=g.tipo_administradora_id
JOIN public.catalogo_grupo_categorias c ON c.codigo = CASE
  WHEN lower(coalesce(t.nome,g.modalidade,'')) LIKE '%moto%' THEN 'MOTO'
  WHEN lower(coalesce(t.nome,g.modalidade,'')) LIKE '%imóv%'
    OR lower(coalesce(t.nome,g.modalidade,'')) LIKE '%imov%' THEN 'IMOVEL'
  WHEN lower(coalesce(t.nome,g.modalidade,'')) LIKE '%caminh%'
    OR lower(coalesce(t.nome,g.modalidade,'')) LIKE '%carreta%' THEN 'CAMINHAO'
  WHEN lower(coalesce(t.nome,g.modalidade,'')) LIKE '%servi%' THEN 'SERVICOS'
  WHEN lower(coalesce(t.nome,g.modalidade,'')) LIKE '%auto%'
    OR lower(coalesce(t.nome,g.modalidade,'')) LIKE '%veíc%'
    OR lower(coalesce(t.nome,g.modalidade,'')) LIKE '%veic%' THEN 'AUTOMOVEL'
  ELSE 'OUTROS' END
ON CONFLICT (grupo_id,categoria_id) DO NOTHING;

ALTER TABLE public.empresa_grupos_config
  ADD COLUMN IF NOT EXISTS modalidade_integral_habilitada boolean,
  ADD COLUMN IF NOT EXISTS modalidade_reduzida_habilitada boolean,
  ADD COLUMN IF NOT EXISTS modalidade_personalizada_habilitada boolean,
  ADD COLUMN IF NOT EXISTS status_vagas_local text NOT NULL DEFAULT 'HERDAR',
  ADD COLUMN IF NOT EXISTS alteracao_catalogo_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS alteracao_catalogo_status text NOT NULL DEFAULT 'SEM_ALTERACAO';

DO $$ BEGIN
  ALTER TABLE public.empresa_grupos_config ADD CONSTRAINT empresa_grupos_config_status_vagas_check
    CHECK (status_vagas_local IN ('HERDAR','DISPONIVEL','AGUARDANDO_NOVAS_VAGAS'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.empresa_grupos_config ADD CONSTRAINT empresa_grupos_config_alteracao_status_check
    CHECK (alteracao_catalogo_status IN ('SEM_ALTERACAO','RASCUNHO_LOCAL','PENDENTE_PLATFORM','EM_ANALISE','DEVOLVIDA','APROVADA','REJEITADA'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.catalogo_grupo_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  grupo_id uuid REFERENCES public.grupos_consorcio(id) ON DELETE RESTRICT,
  administradora_id uuid NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
  tipo_administradora_id uuid NOT NULL REFERENCES public.administradora_tipos(id) ON DELETE RESTRICT,
  codigo_grupo text NOT NULL CHECK (length(trim(codigo_grupo)) > 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDENTE_PLATFORM' CHECK (status IN ('RASCUNHO_LOCAL','PENDENTE_PLATFORM','EM_ANALISE','DEVOLVIDA','APROVADA','REJEITADA')),
  chave_idempotencia text NOT NULL,
  criado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  decidido_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  decisao_observacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  decidido_em timestamptz,
  UNIQUE (empresa_id,chave_idempotencia)
);
CREATE INDEX IF NOT EXISTS catalogo_grupo_solicitacoes_fila_idx
  ON public.catalogo_grupo_solicitacoes(status,criado_em);
CREATE INDEX IF NOT EXISTS catalogo_grupo_solicitacoes_empresa_idx
  ON public.catalogo_grupo_solicitacoes(empresa_id,status,criado_em DESC);

ALTER TABLE public.catalogo_grupo_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_grupo_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalogo_grupo_categorias_read ON public.catalogo_grupo_categorias;
CREATE POLICY catalogo_grupo_categorias_read ON public.catalogo_grupo_categorias
FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS grupos_categorias_read ON public.grupos_categorias;
CREATE POLICY grupos_categorias_read ON public.grupos_categorias
FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalogo_grupo_solicitacoes_platform_read ON public.catalogo_grupo_solicitacoes;
CREATE POLICY catalogo_grupo_solicitacoes_platform_read ON public.catalogo_grupo_solicitacoes
FOR SELECT TO authenticated USING (public.is_platform_superadmin());
DROP POLICY IF EXISTS catalogo_grupo_solicitacoes_tenant_read ON public.catalogo_grupo_solicitacoes;
CREATE POLICY catalogo_grupo_solicitacoes_tenant_read ON public.catalogo_grupo_solicitacoes
FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));

-- Prontidão de crédito não depende mais de parcela pré-calculada.
CREATE OR REPLACE VIEW public.catalogo_produtos_prontidao AS
SELECT
  c.id AS grupo_cota_id,
  c.grupo_id,
  c.ativo,
  count(*) FILTER (WHERE gm.ativo) AS modalidades_exigidas,
  count(*) FILTER (WHERE gm.ativo) AS modalidades_configuradas,
  (
    c.ativo
    AND c.valor_credito > 0
    AND g.ativo
    AND g.status <> 'Inativo'
    AND coalesce(g.prazo_total,0) > 0
    AND g.taxa_administrativa_percentual IS NOT NULL
    AND count(*) FILTER (WHERE gm.ativo) > 0
  ) AS pronto_para_venda
FROM public.grupos_cotas c
JOIN public.grupos_consorcio g ON g.id=c.grupo_id
LEFT JOIN public.grupos_modalidades_disponiveis gm ON gm.grupo_id=c.grupo_id
GROUP BY c.id,c.grupo_id,c.ativo,c.valor_credito,g.ativo,g.status,g.prazo_total,g.taxa_administrativa_percentual;

CREATE OR REPLACE FUNCTION public.rpc_platform_configurar_categorias_grupo(
  p_grupo_id uuid,
  p_codigos text[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_codigo text; v_categoria uuid; v_total integer:=0;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.grupos_consorcio WHERE id=p_grupo_id) THEN RAISE EXCEPTION 'Grupo não encontrado'; END IF;
  IF coalesce(array_length(p_codigos,1),0)=0 THEN RAISE EXCEPTION 'Selecione ao menos uma categoria'; END IF;
  DELETE FROM public.grupos_categorias WHERE grupo_id=p_grupo_id;
  FOREACH v_codigo IN ARRAY p_codigos LOOP
    SELECT id INTO v_categoria FROM public.catalogo_grupo_categorias WHERE codigo=upper(trim(v_codigo)) AND ativo;
    IF v_categoria IS NULL THEN RAISE EXCEPTION 'Categoria inválida: %',v_codigo; END IF;
    INSERT INTO public.grupos_categorias(grupo_id,categoria_id,principal,ordem)
    VALUES(p_grupo_id,v_categoria,v_total=0,v_total) ON CONFLICT DO NOTHING;
    v_total:=v_total+1;
  END LOOP;
  RETURN jsonb_build_object('grupo_id',p_grupo_id,'categorias',v_total);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_configurar_grupo_franquia(
  p_empresa_id uuid,
  p_grupo_id uuid,
  p_visivel boolean,
  p_destaque boolean,
  p_ordem integer,
  p_titulo_comercial text,
  p_descricao_comercial text,
  p_integral boolean,
  p_reduzida boolean,
  p_personalizada boolean,
  p_status_vagas text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF NOT coalesce(p_integral,false) AND NOT coalesce(p_reduzida,false) AND NOT coalesce(p_personalizada,false) THEN
    RAISE EXCEPTION 'Ao menos uma modalidade deve permanecer habilitada';
  END IF;
  IF p_personalizada AND NOT p_reduzida THEN RAISE EXCEPTION 'Personalizada depende da modalidade reduzida'; END IF;
  IF p_status_vagas NOT IN ('HERDAR','DISPONIVEL','AGUARDANDO_NOVAS_VAGAS') THEN RAISE EXCEPTION 'Status de vagas inválido'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.grupos_consorcio g
    JOIN public.empresa_administradoras ea ON ea.administradora_id=g.administradora_id
    WHERE g.id=p_grupo_id AND ea.empresa_id=p_empresa_id AND ea.status='ATIVA'
  ) THEN RAISE EXCEPTION 'Grupo fora da concessão ativa da empresa'; END IF;
  INSERT INTO public.empresa_grupos_config(
    empresa_id,grupo_id,visivel,destaque,ordem,titulo_comercial,descricao_comercial,
    modalidade_integral_habilitada,modalidade_reduzida_habilitada,
    modalidade_personalizada_habilitada,status_vagas_local,updated_at
  ) VALUES(
    p_empresa_id,p_grupo_id,coalesce(p_visivel,true),coalesce(p_destaque,false),p_ordem,
    nullif(trim(p_titulo_comercial),''),nullif(trim(p_descricao_comercial),''),
    p_integral,p_reduzida,p_personalizada,p_status_vagas,now()
  ) ON CONFLICT(empresa_id,grupo_id) DO UPDATE SET
    visivel=excluded.visivel,destaque=excluded.destaque,ordem=excluded.ordem,
    titulo_comercial=excluded.titulo_comercial,descricao_comercial=excluded.descricao_comercial,
    modalidade_integral_habilitada=excluded.modalidade_integral_habilitada,
    modalidade_reduzida_habilitada=excluded.modalidade_reduzida_habilitada,
    modalidade_personalizada_habilitada=excluded.modalidade_personalizada_habilitada,
    status_vagas_local=excluded.status_vagas_local,updated_at=now();
  RETURN jsonb_build_object('empresa_id',p_empresa_id,'grupo_id',p_grupo_id,'salvo',true);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_submeter_alteracao_grupo_franquia(
  p_empresa_id uuid,
  p_grupo_id uuid,
  p_administradora_id uuid,
  p_tipo_administradora_id uuid,
  p_codigo_grupo text,
  p_payload jsonb,
  p_chave_idempotencia text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_usuario uuid; v_id uuid; v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF nullif(trim(p_chave_idempotencia),'') IS NULL THEN RAISE EXCEPTION 'Chave de idempotência obrigatória'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.empresa_administradoras WHERE empresa_id=p_empresa_id AND administradora_id=p_administradora_id AND status='ATIVA') THEN
    RAISE EXCEPTION 'Administradora não concedida à empresa';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.administradora_tipos WHERE id=p_tipo_administradora_id AND administradora_id=p_administradora_id AND ativo) THEN
    RAISE EXCEPTION 'Tipo não pertence à administradora';
  END IF;
  IF p_grupo_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.grupos_consorcio WHERE id=p_grupo_id AND administradora_id=p_administradora_id) THEN
    RAISE EXCEPTION 'Grupo não pertence à administradora';
  END IF;
  -- Lista positiva: o tenant não injeta IDs, governança ou campos históricos.
  v_payload:=jsonb_strip_nulls(jsonb_build_object(
    'status',p_payload->'status',
    'ativo',p_payload->'ativo',
    'prazo_total',p_payload->'prazo_total',
    'taxa_administrativa_percentual',p_payload->'taxa_administrativa_percentual',
    'fundo_reserva_percentual',p_payload->'fundo_reserva_percentual',
    'seguro_percentual',p_payload->'seguro_percentual',
    'seguro_habilitado',p_payload->'seguro_habilitado',
    'capacidade_total',p_payload->'capacidade_total',
    'vagas_disponiveis',p_payload->'vagas_disponiveis',
    'permite_lance_embutido',p_payload->'permite_lance_embutido',
    'percentual_lance_embutido',p_payload->'percentual_lance_embutido',
    'observacoes',p_payload->'observacoes',
    'creditos',p_payload->'creditos',
    'categorias',p_payload->'categorias'
  ));
  SELECT id INTO v_usuario FROM public.usuarios WHERE auth_user_id=auth.uid() LIMIT 1;
  INSERT INTO public.catalogo_grupo_solicitacoes(
    empresa_id,grupo_id,administradora_id,tipo_administradora_id,codigo_grupo,payload,
    chave_idempotencia,criado_por_usuario_id
  ) VALUES(p_empresa_id,p_grupo_id,p_administradora_id,p_tipo_administradora_id,trim(p_codigo_grupo),v_payload,p_chave_idempotencia,v_usuario)
  ON CONFLICT(empresa_id,chave_idempotencia) DO UPDATE SET atualizado_em=now()
  RETURNING id INTO v_id;
  IF p_grupo_id IS NOT NULL THEN
    INSERT INTO public.empresa_grupos_config(empresa_id,grupo_id,alteracao_catalogo_payload,alteracao_catalogo_status,updated_at)
    VALUES(p_empresa_id,p_grupo_id,v_payload,'PENDENTE_PLATFORM',now())
    ON CONFLICT(empresa_id,grupo_id) DO UPDATE SET alteracao_catalogo_payload=excluded.alteracao_catalogo_payload,
      alteracao_catalogo_status='PENDENTE_PLATFORM',updated_at=now();
  END IF;
  RETURN jsonb_build_object('id',v_id,'status','PENDENTE_PLATFORM','aplicacao_local',p_grupo_id IS NOT NULL);
END $$;

-- O catálogo central grava somente créditos. Nenhuma parcela ou override por
-- crédito é materializado; o motor do site calcula a proposta no momento certo.
CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_cotas_lote(
  p_grupo_id uuid,
  p_valores_credito numeric[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_credito numeric; v_id uuid; v_inseridos integer:=0; v_atualizados integer:=0;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin pode cadastrar créditos'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.grupos_consorcio WHERE id=p_grupo_id) THEN RAISE EXCEPTION 'Grupo não encontrado'; END IF;
  FOREACH v_credito IN ARRAY coalesce(p_valores_credito,'{}'::numeric[]) LOOP
    IF v_credito > 0 THEN
      SELECT id INTO v_id FROM public.grupos_cotas
      WHERE grupo_id=p_grupo_id AND abs(valor_credito-v_credito)<0.01 LIMIT 1;
      IF v_id IS NULL THEN
        INSERT INTO public.grupos_cotas(grupo_id,valor_credito,valor_parcela,status,ativo)
        VALUES(p_grupo_id,v_credito,0,'Disponível',true) RETURNING id INTO v_id;
        v_inseridos:=v_inseridos+1;
      ELSE
        UPDATE public.grupos_cotas SET ativo=true,status='Disponível',updated_at=now() WHERE id=v_id;
        v_atualizados:=v_atualizados+1;
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('grupo_id',p_grupo_id,'inseridos',v_inseridos,'reativados',v_atualizados);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_decidir_solicitacao_grupo(
  p_solicitacao_id uuid,
  p_decisao text,
  p_observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_s public.catalogo_grupo_solicitacoes%ROWTYPE;
  v_g public.grupos_consorcio%ROWTYPE;
  v_salvo jsonb;
  v_grupo_id uuid;
  v_usuario uuid;
  v_creditos numeric[];
  v_categorias text[];
  v_decisao text:=upper(trim(p_decisao));
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
  IF v_decisao NOT IN ('APROVAR','DEVOLVER','REJEITAR') THEN RAISE EXCEPTION 'Decisão inválida'; END IF;
  SELECT * INTO v_s FROM public.catalogo_grupo_solicitacoes WHERE id=p_solicitacao_id FOR UPDATE;
  IF v_s.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_s.status IN ('APROVADA','REJEITADA') THEN RAISE EXCEPTION 'Solicitação já encerrada'; END IF;
  SELECT id INTO v_usuario FROM public.usuarios WHERE auth_user_id=auth.uid() LIMIT 1;

  IF v_decisao='APROVAR' THEN
    IF v_s.grupo_id IS NOT NULL THEN
      SELECT * INTO v_g FROM public.grupos_consorcio WHERE id=v_s.grupo_id FOR UPDATE;
      IF v_g.id IS NULL THEN RAISE EXCEPTION 'Grupo oficial não encontrado'; END IF;
    END IF;
    v_salvo:=public.rpc_platform_salvar_grupo(
      p_id=>v_s.grupo_id,
      p_administradora_id=>v_s.administradora_id,
      p_tipo_administradora_id=>v_s.tipo_administradora_id,
      p_codigo_grupo=>v_s.codigo_grupo,
      p_status=>coalesce(v_s.payload->>'status',v_g.status,'Disponível'),
      p_ativo=>coalesce((v_s.payload->>'ativo')::boolean,v_g.ativo,true),
      p_prazo_total=>coalesce((v_s.payload->>'prazo_total')::integer,v_g.prazo_total),
      p_taxa_administrativa=>coalesce((v_s.payload->>'taxa_administrativa_percentual')::numeric,v_g.taxa_administrativa_percentual,0),
      p_fundo_reserva=>coalesce((v_s.payload->>'fundo_reserva_percentual')::numeric,v_g.fundo_reserva_percentual,0),
      p_seguro_percentual=>coalesce((v_s.payload->>'seguro_percentual')::numeric,v_g.seguro_percentual,0),
      p_capacidade_total=>coalesce((v_s.payload->>'capacidade_total')::integer,v_g.capacidade_total,0),
      p_vagas_disponiveis=>coalesce((v_s.payload->>'vagas_disponiveis')::integer,v_g.vagas_disponiveis,0),
      p_permite_lance_embutido=>coalesce((v_s.payload->>'permite_lance_embutido')::boolean,v_g.permite_lance_embutido,false),
      p_percentual_lance_embutido=>coalesce((v_s.payload->>'percentual_lance_embutido')::numeric,v_g.percentual_lance_embutido,0),
      p_observacoes=>coalesce(v_s.payload->>'observacoes',v_g.observacoes),
      p_data_primeira_assembleia=>v_g.data_primeira_assembleia
    );
    v_grupo_id:=(v_salvo->>'id')::uuid;
    IF jsonb_typeof(v_s.payload->'creditos')='array' THEN
      SELECT array_agg(valor) INTO v_creditos
      FROM (SELECT (jsonb_array_elements_text(v_s.payload->'creditos'))::numeric AS valor) q WHERE valor>0;
      IF coalesce(array_length(v_creditos,1),0)>0 THEN PERFORM public.rpc_platform_salvar_cotas_lote(v_grupo_id,v_creditos); END IF;
    END IF;
    IF jsonb_typeof(v_s.payload->'categorias')='array' THEN
      SELECT array_agg(upper(trim(valor))) INTO v_categorias
      FROM jsonb_array_elements_text(v_s.payload->'categorias') q(valor);
      IF coalesce(array_length(v_categorias,1),0)>0 THEN PERFORM public.rpc_platform_configurar_categorias_grupo(v_grupo_id,v_categorias); END IF;
    END IF;
    UPDATE public.empresa_grupos_config SET alteracao_catalogo_payload='{}'::jsonb,
      alteracao_catalogo_status='APROVADA',updated_at=now()
    WHERE empresa_id=v_s.empresa_id AND grupo_id=v_grupo_id;
  END IF;

  UPDATE public.catalogo_grupo_solicitacoes SET
    status=CASE v_decisao WHEN 'APROVAR' THEN 'APROVADA' WHEN 'DEVOLVER' THEN 'DEVOLVIDA' ELSE 'REJEITADA' END,
    decidido_por_usuario_id=v_usuario,decisao_observacao=nullif(trim(p_observacao),''),
    decidido_em=now(),atualizado_em=now(),grupo_id=coalesce(v_grupo_id,grupo_id)
  WHERE id=v_s.id;
  IF v_s.grupo_id IS NOT NULL AND v_decisao<>'APROVAR' THEN
    UPDATE public.empresa_grupos_config SET alteracao_catalogo_status=CASE v_decisao WHEN 'DEVOLVER' THEN 'DEVOLVIDA' ELSE 'REJEITADA' END,updated_at=now()
    WHERE empresa_id=v_s.empresa_id AND grupo_id=v_s.grupo_id;
  END IF;
  RETURN jsonb_build_object('id',v_s.id,'decisao',v_decisao,'grupo_id',coalesce(v_grupo_id,v_s.grupo_id));
END $$;

REVOKE ALL ON TABLE public.catalogo_grupo_categorias,public.grupos_categorias,public.catalogo_grupo_solicitacoes FROM PUBLIC,anon;
GRANT SELECT ON public.catalogo_grupo_categorias,public.grupos_categorias,public.catalogo_grupo_solicitacoes TO authenticated;
GRANT SELECT ON public.catalogo_produtos_prontidao TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_platform_configurar_categorias_grupo(uuid,text[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_platform_configurar_categorias_grupo(uuid,text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_configurar_grupo_franquia(uuid,uuid,boolean,boolean,integer,text,text,boolean,boolean,boolean,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_configurar_grupo_franquia(uuid,uuid,boolean,boolean,integer,text,text,boolean,boolean,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_submeter_alteracao_grupo_franquia(uuid,uuid,uuid,uuid,text,jsonb,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_submeter_alteracao_grupo_franquia(uuid,uuid,uuid,uuid,text,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_platform_salvar_cotas_lote(uuid,numeric[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_platform_salvar_cotas_lote(uuid,numeric[]) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_platform_decidir_solicitacao_grupo(uuid,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_platform_decidir_solicitacao_grupo(uuid,text,text) TO authenticated;

COMMIT;
NOTIFY pgrst,'reload schema';
