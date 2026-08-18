-- 080: catalogo canonico Grupo N:N Modalidades e valores de produto por modalidade.
-- Forward-only: preserva colunas legadas, vendas, snapshots e previsoes existentes.

BEGIN;

CREATE TABLE public.grupos_modalidades_disponiveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE RESTRICT,
  administradora_modalidade_id uuid NOT NULL REFERENCES public.administradora_modalidades_comissao(id) ON DELETE RESTRICT,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0 CHECK (ordem >= 0),
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(configuracao) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, administradora_modalidade_id)
);

CREATE TABLE public.grupo_cota_modalidade_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_cota_id uuid NOT NULL REFERENCES public.grupos_cotas(id) ON DELETE RESTRICT,
  administradora_modalidade_id uuid NOT NULL REFERENCES public.administradora_modalidades_comissao(id) ON DELETE RESTRICT,
  valor_parcela numeric(15,2) NOT NULL CHECK (valor_parcela > 0),
  percentual_reducao numeric(7,4) CHECK (percentual_reducao IS NULL OR (percentual_reducao > 0 AND percentual_reducao <= 100)),
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(configuracao) = 'object'),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_cota_id, administradora_modalidade_id)
);

COMMENT ON COLUMN public.grupos_consorcio.modalidade_comissao_id IS
  'LEGADO 076: modalidade singular preservada somente para compatibilidade historica. Novas vendas usam grupos_modalidades_disponiveis.';
COMMENT ON TABLE public.grupos_modalidades_disponiveis IS
  'Modalidades de pagamento da Administradora disponibilizadas pelo Grupo; inativar em vez de excluir quando houver uso historico.';
COMMENT ON TABLE public.grupo_cota_modalidade_valores IS
  'Valor oficial manual da parcela de um produto comercial (grupos_cotas) em cada modalidade habilitada do Grupo.';

CREATE OR REPLACE FUNCTION public.validar_catalogo_modalidade_grupo()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_administradora_grupo uuid; v_administradora_modalidade uuid;
BEGIN
  SELECT administradora_id INTO v_administradora_grupo FROM public.grupos_consorcio WHERE id=NEW.grupo_id;
  SELECT administradora_id INTO v_administradora_modalidade FROM public.administradora_modalidades_comissao WHERE id=NEW.administradora_modalidade_id;
  IF v_administradora_grupo IS NULL OR v_administradora_modalidade IS NULL OR v_administradora_grupo<>v_administradora_modalidade THEN
    RAISE EXCEPTION 'Modalidade nao pertence a Administradora do Grupo';
  END IF;
  NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER grupos_modalidades_validar BEFORE INSERT OR UPDATE ON public.grupos_modalidades_disponiveis
FOR EACH ROW EXECUTE FUNCTION public.validar_catalogo_modalidade_grupo();

CREATE OR REPLACE FUNCTION public.validar_valor_modalidade_produto()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_grupo uuid;
BEGIN
  SELECT grupo_id INTO v_grupo FROM public.grupos_cotas WHERE id=NEW.grupo_cota_id;
  IF v_grupo IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.grupos_modalidades_disponiveis gm
    WHERE gm.grupo_id=v_grupo AND gm.administradora_modalidade_id=NEW.administradora_modalidade_id AND gm.ativo
  ) THEN RAISE EXCEPTION 'Modalidade nao esta ativa para o Grupo deste produto'; END IF;
  NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER grupo_cota_modalidade_valor_validar BEFORE INSERT OR UPDATE ON public.grupo_cota_modalidade_valores
FOR EACH ROW EXECUTE FUNCTION public.validar_valor_modalidade_produto();

CREATE OR REPLACE FUNCTION public.proteger_produto_comercial_utilizado()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.vendas WHERE opcao_cota_id=OLD.id)
    OR EXISTS(SELECT 1 FROM public.simulacoes_grupos_itens WHERE grupo_cota_id=OLD.id) THEN
    RAISE EXCEPTION 'Produto comercial utilizado nao pode ser excluido; inative-o';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER grupos_cotas_proteger_historico BEFORE DELETE ON public.grupos_cotas
FOR EACH ROW EXECUTE FUNCTION public.proteger_produto_comercial_utilizado();

-- O singular da 076 vira somente uma disponibilidade inicialmente conhecida.
-- Nao inferimos as demais modalidades nem migramos colunas de parcela ambiguas.
INSERT INTO public.grupos_modalidades_disponiveis(grupo_id,administradora_modalidade_id,ativo,ordem,configuracao)
SELECT g.id,g.modalidade_comissao_id,true,0,jsonb_build_object('origem','BACKFILL_MODALIDADE_SINGULAR_076','revisao_platform_pendente',true)
FROM public.grupos_consorcio g
JOIN public.administradora_modalidades_comissao m ON m.id=g.modalidade_comissao_id AND m.administradora_id=g.administradora_id
ON CONFLICT(grupo_id,administradora_modalidade_id) DO NOTHING;

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS modalidade_comissao_id uuid REFERENCES public.administradora_modalidades_comissao(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS valor_parcela_modalidade numeric(15,2) CHECK (valor_parcela_modalidade IS NULL OR valor_parcela_modalidade > 0);

CREATE OR REPLACE FUNCTION public.comissao_v2_enriquecer_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_grupo record; v_tipo record; v_modalidade record; v_valor record; v_modalidade_texto text;
BEGIN
  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id=NEW.grupo_id;
  IF v_grupo.tipo_administradora_id IS NULL THEN
    RAISE EXCEPTION 'Grupo com CONFIGURACAO PENDENTE: Tipo oficial obrigatorio para nova venda';
  END IF;
  v_modalidade_texto:=COALESCE(NEW.modalidade_comissao_id::text,NEW.snapshot_venda->>'modalidade_comissao_id',NEW.snapshot_venda#>>'{dados_simulacao,modalidade_comissao_id}');
  IF v_modalidade_texto IS NULL OR v_modalidade_texto !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Modalidade escolhida e obrigatoria para nova venda; nao pode ser inferida do Grupo';
  END IF;
  NEW.modalidade_comissao_id:=v_modalidade_texto::uuid;
  SELECT * INTO v_tipo FROM public.administradora_tipos WHERE id=v_grupo.tipo_administradora_id AND administradora_id=NEW.administradora_id AND ativo;
  SELECT m.* INTO v_modalidade FROM public.administradora_modalidades_comissao m
    JOIN public.grupos_modalidades_disponiveis gm ON gm.administradora_modalidade_id=m.id AND gm.grupo_id=NEW.grupo_id AND gm.ativo
    WHERE m.id=NEW.modalidade_comissao_id AND m.administradora_id=NEW.administradora_id AND m.ativo;
  IF v_tipo.id IS NULL OR v_modalidade.id IS NULL THEN RAISE EXCEPTION 'Tipo/Modalidade indisponiveis para Grupo e Administradora da venda'; END IF;
  IF NEW.opcao_cota_id IS NULL THEN RAISE EXCEPTION 'Produto comercial obrigatorio para nova venda V2'; END IF;
  SELECT mv.* INTO v_valor FROM public.grupo_cota_modalidade_valores mv JOIN public.grupos_cotas c ON c.id=mv.grupo_cota_id
    WHERE mv.grupo_cota_id=NEW.opcao_cota_id AND c.grupo_id=NEW.grupo_id AND c.ativo AND mv.administradora_modalidade_id=NEW.modalidade_comissao_id AND mv.ativo;
  IF v_valor.id IS NULL THEN RAISE EXCEPTION 'Produto com CONFIGURACAO PENDENTE: valor da modalidade escolhida nao cadastrado'; END IF;
  NEW.valor_parcela_modalidade:=v_valor.valor_parcela;
  NEW.parcela:=v_valor.valor_parcela;
  NEW.snapshot_venda:=COALESCE(NEW.snapshot_venda,'{}'::jsonb)||jsonb_build_object(
    'tipo_administradora_id',v_tipo.id,'tipo_administradora_codigo',v_tipo.codigo,
    'modalidade_comissao_id',v_modalidade.id,'modalidade_comissao_codigo',v_modalidade.codigo,
    'grupo_id',NEW.grupo_id,'opcao_cota_id',NEW.opcao_cota_id,
    'valor_credito',NEW.valor_credito,'valor_parcela_modalidade',v_valor.valor_parcela,
    'valor_produto_modalidade_id',v_valor.id,'plano_condicao',lower(v_modalidade.codigo));
  RETURN NEW;
END $$;

ALTER TABLE public.grupos_modalidades_disponiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_cota_modalidade_valores ENABLE ROW LEVEL SECURITY;
CREATE POLICY grupos_modalidades_read ON public.grupos_modalidades_disponiveis FOR SELECT TO authenticated USING(true);
CREATE POLICY grupos_modalidades_platform_write ON public.grupos_modalidades_disponiveis FOR ALL TO authenticated
  USING(public.is_platform_superadmin()) WITH CHECK(public.is_platform_superadmin());
CREATE POLICY produto_modalidade_valores_read ON public.grupo_cota_modalidade_valores FOR SELECT TO authenticated USING(true);
CREATE POLICY produto_modalidade_valores_platform_write ON public.grupo_cota_modalidade_valores FOR ALL TO authenticated
  USING(public.is_platform_superadmin()) WITH CHECK(public.is_platform_superadmin());

CREATE OR REPLACE VIEW public.catalogo_produtos_prontidao AS
SELECT c.id grupo_cota_id,c.grupo_id,c.ativo,
  count(*) FILTER(WHERE gm.ativo) modalidades_exigidas,
  count(mv.id) FILTER(WHERE gm.ativo AND mv.ativo AND mv.valor_parcela>0) modalidades_configuradas,
  (c.ativo AND c.valor_credito>0 AND count(*) FILTER(WHERE gm.ativo)>0 AND
   count(*) FILTER(WHERE gm.ativo)=count(mv.id) FILTER(WHERE gm.ativo AND mv.ativo AND mv.valor_parcela>0)) pronto_para_venda
FROM public.grupos_cotas c
LEFT JOIN public.grupos_modalidades_disponiveis gm ON gm.grupo_id=c.grupo_id
LEFT JOIN public.grupo_cota_modalidade_valores mv ON mv.grupo_cota_id=c.id AND mv.administradora_modalidade_id=gm.administradora_modalidade_id
GROUP BY c.id,c.grupo_id,c.ativo,c.valor_credito;

GRANT SELECT ON public.catalogo_produtos_prontidao TO authenticated,service_role;

-- A 076 compilou estas rotinas contra a modalidade singular do Grupo. Mantemos
-- sua logica financeira intacta e trocamos somente a fonte de Tipo/Modalidade
-- pelo snapshot imutavel da venda. Assim nao duplicamos percentuais nem curvas.
DO $migration$
DECLARE v_oid oid; v_def text; v_nome text;
BEGIN
  FOREACH v_nome IN ARRAY ARRAY['rpc_gerar_previsoes_comissao_v2','comissao_v2_gerar_participante_manual'] LOOP
    SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=v_nome ORDER BY p.oid DESC LIMIT 1;
    IF v_oid IS NULL THEN RAISE EXCEPTION 'Funcao 076 ausente: %',v_nome; END IF;
    v_def:=pg_get_functiondef(v_oid);
    v_def:=replace(v_def,'v_grupo.tipo_administradora_id','(v_venda.snapshot_venda->>''tipo_administradora_id'')::uuid');
    v_def:=replace(v_def,'v_grupo.modalidade_comissao_id','(v_venda.snapshot_venda->>''modalidade_comissao_id'')::uuid');
    EXECUTE v_def;
  END LOOP;
END $migration$;

CREATE OR REPLACE FUNCTION public.rpc_gerar_previsoes_comissao(p_empresa_id uuid,p_venda_id uuid,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_v2 boolean;
BEGIN
  SELECT v.snapshot_venda ? 'tipo_administradora_id' AND v.snapshot_venda ? 'modalidade_comissao_id' INTO v_v2
  FROM public.vendas v WHERE v.id=p_venda_id AND v.empresa_id=p_empresa_id;
  IF COALESCE(v_v2,false) THEN
    RETURN public.rpc_gerar_previsoes_comissao_v2(p_empresa_id,p_venda_id,p_idempotency_key);
  END IF;
  RETURN public.rpc_gerar_previsoes_comissao_legado(p_empresa_id,p_venda_id,p_idempotency_key);
END $$;

COMMIT;
