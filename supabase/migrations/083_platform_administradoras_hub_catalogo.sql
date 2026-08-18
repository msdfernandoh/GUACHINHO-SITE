-- 083: Hub Platform de Administradoras.
-- Governanca forward-only sobre o motor canonico 060-063/076-080.

BEGIN;

ALTER TABLE public.administradoras
  ADD COLUMN IF NOT EXISTS descricao_institucional text;

ALTER TABLE public.administradora_modalidades_comissao
  ADD COLUMN IF NOT EXISTS aplicavel_todos_tipos boolean NOT NULL DEFAULT true;

CREATE TABLE public.administradora_modalidade_tipos (
  modalidade_id uuid NOT NULL REFERENCES public.administradora_modalidades_comissao(id) ON DELETE CASCADE,
  tipo_id uuid NOT NULL REFERENCES public.administradora_tipos(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (modalidade_id,tipo_id)
);

ALTER TABLE public.administradora_curvas_estorno
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS aplicavel_todos_tipos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS aplicavel_todas_modalidades boolean NOT NULL DEFAULT true;

CREATE TABLE public.administradora_curva_tipos (
  curva_id uuid NOT NULL REFERENCES public.administradora_curvas_estorno(id) ON DELETE CASCADE,
  tipo_id uuid NOT NULL REFERENCES public.administradora_tipos(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (curva_id,tipo_id)
);

CREATE TABLE public.administradora_curva_modalidades (
  curva_id uuid NOT NULL REFERENCES public.administradora_curvas_estorno(id) ON DELETE CASCADE,
  modalidade_id uuid NOT NULL REFERENCES public.administradora_modalidades_comissao(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (curva_id,modalidade_id)
);

ALTER TABLE public.comissao_regras_franquia
  ADD COLUMN IF NOT EXISTS curva_estorno_id uuid REFERENCES public.administradora_curvas_estorno(id) ON DELETE RESTRICT;

CREATE TABLE public.administradora_modelos_comissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  administradora_id uuid NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
  tipo_id uuid NOT NULL REFERENCES public.administradora_tipos(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  descricao text,
  versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  percentual_total_referencia numeric(8,4) NOT NULL CHECK (percentual_total_referencia > 0),
  status text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','HOMOLOGADO','INATIVO','SUBSTITUIDO')),
  regra_franquia_origem_id uuid REFERENCES public.comissao_regras_franquia(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (administradora_id,nome,versao)
);

CREATE TABLE public.administradora_modelo_modalidades (
  modelo_id uuid NOT NULL REFERENCES public.administradora_modelos_comissao(id) ON DELETE CASCADE,
  modalidade_id uuid NOT NULL REFERENCES public.administradora_modalidades_comissao(id) ON DELETE RESTRICT,
  regra_franquia_origem_id uuid REFERENCES public.comissao_regras_franquia(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (modelo_id,modalidade_id)
);

CREATE INDEX administradora_modalidade_tipos_tipo_idx ON public.administradora_modalidade_tipos(tipo_id);
CREATE INDEX administradora_curva_tipos_tipo_idx ON public.administradora_curva_tipos(tipo_id);
CREATE INDEX administradora_curva_modalidades_modalidade_idx ON public.administradora_curva_modalidades(modalidade_id);
CREATE INDEX administradora_modelos_admin_status_idx ON public.administradora_modelos_comissao(administradora_id,status);
CREATE INDEX administradora_modelo_modalidades_modalidade_idx ON public.administradora_modelo_modalidades(modalidade_id);

ALTER TABLE public.comissao_programas DROP CONSTRAINT IF EXISTS comissao_programas_status_v2_check;
ALTER TABLE public.comissao_programas ADD CONSTRAINT comissao_programas_status_v2_check
  CHECK (status IN ('RASCUNHO','ATIVO','INATIVO','SUBSTITUIDO'));

CREATE OR REPLACE FUNCTION public.platform_catalogo_auditar(p_acao text,p_entidade text,p_id uuid,p_campos jsonb DEFAULT '[]'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_usuario uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
  SELECT id INTO v_usuario FROM public.usuarios WHERE auth_user_id=auth.uid() LIMIT 1;
  INSERT INTO public.plataforma_auditoria(usuario_id,acao,entidade_tipo,entidade_id,campos_alterados)
  VALUES(v_usuario,lower(trim(p_acao)),trim(p_entidade),p_id,coalesce(p_campos,'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.rpc_salvar_tipo_administradora(
 p_administradora_id uuid,p_nome text,p_ativo boolean DEFAULT true,p_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_codigo text;v_row record;
BEGIN
 IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.administradoras WHERE id=p_administradora_id) THEN RAISE EXCEPTION 'Administradora não encontrada';END IF;
 IF length(trim(coalesce(p_nome,'')))<2 THEN RAISE EXCEPTION 'Nome do Tipo é obrigatório';END IF;
 v_codigo:=public.codigo_catalogo_administradora(p_nome);
 IF EXISTS(SELECT 1 FROM public.administradora_tipos WHERE administradora_id=p_administradora_id AND id IS DISTINCT FROM p_id AND ativo AND public.codigo_catalogo_administradora(nome)=v_codigo) THEN RAISE EXCEPTION 'Já existe Tipo ativo logicamente equivalente';END IF;
 IF p_id IS NULL THEN
  IF v_codigo='' THEN RAISE EXCEPTION 'Nome não gera código técnico válido';END IF;
  WHILE EXISTS(SELECT 1 FROM public.administradora_tipos WHERE administradora_id=p_administradora_id AND codigo=v_codigo) LOOP v_codigo:=v_codigo||'_'||substr(replace(gen_random_uuid()::text,'-',''),1,6);END LOOP;
  INSERT INTO public.administradora_tipos(administradora_id,codigo,nome,ativo) VALUES(p_administradora_id,v_codigo,trim(p_nome),p_ativo) RETURNING * INTO v_row;
 ELSE
  UPDATE public.administradora_tipos SET nome=trim(p_nome),ativo=p_ativo,updated_at=now() WHERE id=p_id AND administradora_id=p_administradora_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Tipo não encontrado nesta Administradora';END IF;
 END IF;
 PERFORM public.platform_catalogo_auditar(CASE WHEN p_id IS NULL THEN 'criar' ELSE 'editar' END,'administradora_tipos',v_row.id,'["nome","ativo"]');
 RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_salvar_modalidade_administradora(
 p_administradora_id uuid,p_nome text,p_descricao text DEFAULT NULL,p_ativo boolean DEFAULT true,p_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_codigo text;v_row record;
BEGIN
 IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.administradoras WHERE id=p_administradora_id) THEN RAISE EXCEPTION 'Administradora não encontrada';END IF;
 IF length(trim(coalesce(p_nome,'')))<2 THEN RAISE EXCEPTION 'Nome da Modalidade é obrigatório';END IF;
 v_codigo:=public.codigo_catalogo_administradora(p_nome);
 IF EXISTS(SELECT 1 FROM public.administradora_modalidades_comissao WHERE administradora_id=p_administradora_id AND id IS DISTINCT FROM p_id AND ativo AND public.codigo_catalogo_administradora(nome)=v_codigo) THEN RAISE EXCEPTION 'Já existe Modalidade ativa logicamente equivalente';END IF;
 IF p_id IS NULL THEN
  IF v_codigo='' THEN RAISE EXCEPTION 'Nome não gera código técnico válido';END IF;
  WHILE EXISTS(SELECT 1 FROM public.administradora_modalidades_comissao WHERE administradora_id=p_administradora_id AND codigo=v_codigo) LOOP v_codigo:=v_codigo||'_'||substr(replace(gen_random_uuid()::text,'-',''),1,6);END LOOP;
  INSERT INTO public.administradora_modalidades_comissao(administradora_id,codigo,nome,descricao,ativo) VALUES(p_administradora_id,v_codigo,trim(p_nome),nullif(trim(coalesce(p_descricao,'')),''),p_ativo) RETURNING * INTO v_row;
 ELSE
  UPDATE public.administradora_modalidades_comissao SET nome=trim(p_nome),descricao=nullif(trim(coalesce(p_descricao,'')),''),ativo=p_ativo,updated_at=now() WHERE id=p_id AND administradora_id=p_administradora_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Modalidade não encontrada nesta Administradora';END IF;
 END IF;
 PERFORM public.platform_catalogo_auditar(CASE WHEN p_id IS NULL THEN 'criar' ELSE 'editar' END,'administradora_modalidades_comissao',v_row.id,'["nome","descricao","ativo"]');
 RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_administradora(p_id uuid,p_nome text,p_nome_fantasia text,p_status text,p_descricao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_row record;v_slug text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
  IF length(trim(coalesce(p_nome,'')))<2 THEN RAISE EXCEPTION 'Nome da Administradora é obrigatório'; END IF;
  IF upper(trim(coalesce(p_status,''))) NOT IN ('ATIVA','INATIVA') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  IF p_id IS NULL THEN
    v_slug:=lower(public.codigo_catalogo_administradora(p_nome));
    IF v_slug='' THEN RAISE EXCEPTION 'Nome não gera código técnico válido'; END IF;
    WHILE EXISTS(SELECT 1 FROM public.administradoras WHERE slug=v_slug) LOOP
      v_slug:=v_slug||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
    END LOOP;
    INSERT INTO public.administradoras(nome,nome_fantasia,slug,status,descricao_institucional)
    VALUES(trim(p_nome),nullif(trim(coalesce(p_nome_fantasia,'')),''),v_slug,upper(trim(p_status)),nullif(trim(coalesce(p_descricao,'')),'')) RETURNING * INTO v_row;
    PERFORM public.platform_catalogo_auditar('criar','administradoras',v_row.id,'["nome","nome_fantasia","status","descricao_institucional"]');
  ELSE
    UPDATE public.administradoras SET nome=trim(p_nome),nome_fantasia=nullif(trim(coalesce(p_nome_fantasia,'')),''),status=upper(trim(p_status)),descricao_institucional=nullif(trim(coalesce(p_descricao,'')),'')
    WHERE id=p_id RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'Administradora não encontrada'; END IF;
    PERFORM public.platform_catalogo_auditar('editar','administradoras',v_row.id,'["nome","nome_fantasia","status","descricao_institucional"]');
  END IF;
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_administradora(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_row record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
  SELECT * INTO v_row FROM public.administradoras WHERE id=p_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Administradora não encontrada'; END IF;
  IF EXISTS(SELECT 1 FROM public.empresa_administradoras WHERE administradora_id=p_id)
    OR EXISTS(SELECT 1 FROM public.grupos_consorcio WHERE administradora_id=p_id)
    OR EXISTS(SELECT 1 FROM public.comissao_programas WHERE administradora_id=p_id)
    OR EXISTS(SELECT 1 FROM public.administradora_tipos WHERE administradora_id=p_id)
    OR EXISTS(SELECT 1 FROM public.administradora_modalidades_comissao WHERE administradora_id=p_id)
    OR EXISTS(SELECT 1 FROM public.administradora_curvas_estorno WHERE administradora_id=p_id)
  THEN RAISE EXCEPTION 'Administradora possui dependências; inative em vez de excluir'; END IF;
  PERFORM public.platform_catalogo_auditar('excluir','administradoras',p_id,'[]');
  DELETE FROM public.administradoras WHERE id=p_id;
  RETURN jsonb_build_object('id',p_id,'excluida',true);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_tipo_administradora(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_admin uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
  SELECT administradora_id INTO v_admin FROM public.administradora_tipos WHERE id=p_id FOR UPDATE;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Tipo não encontrado'; END IF;
  IF EXISTS(SELECT 1 FROM public.grupos_consorcio WHERE tipo_administradora_id=p_id)
    OR EXISTS(SELECT 1 FROM public.comissao_regras_franquia WHERE tipo_administradora_id=p_id)
    OR EXISTS(SELECT 1 FROM public.comissao_regras_participantes WHERE tipo_administradora_id=p_id)
    OR EXISTS(SELECT 1 FROM public.administradora_modelos_comissao WHERE tipo_id=p_id)
    OR EXISTS(SELECT 1 FROM public.administradora_modalidade_tipos WHERE tipo_id=p_id)
    OR EXISTS(SELECT 1 FROM public.administradora_curva_tipos WHERE tipo_id=p_id)
    OR EXISTS(SELECT 1 FROM public.vendas WHERE snapshot_venda->>'tipo_administradora_id'=p_id::text)
  THEN RAISE EXCEPTION 'Tipo possui dependências; inative em vez de excluir'; END IF;
  PERFORM public.platform_catalogo_auditar('excluir','administradora_tipos',p_id,'[]');
  DELETE FROM public.administradora_tipos WHERE id=p_id;
  RETURN jsonb_build_object('id',p_id,'excluido',true);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_modalidade_administradora(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_admin uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
  SELECT administradora_id INTO v_admin FROM public.administradora_modalidades_comissao WHERE id=p_id FOR UPDATE;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Modalidade não encontrada'; END IF;
  IF EXISTS(SELECT 1 FROM public.grupos_modalidades_disponiveis WHERE administradora_modalidade_id=p_id)
    OR EXISTS(SELECT 1 FROM public.grupo_cota_modalidade_valores WHERE administradora_modalidade_id=p_id)
    OR EXISTS(SELECT 1 FROM public.vendas WHERE modalidade_comissao_id=p_id)
    OR EXISTS(SELECT 1 FROM public.comissao_regras_franquia WHERE modalidade_comissao_id=p_id)
    OR EXISTS(SELECT 1 FROM public.comissao_regras_participantes WHERE modalidade_comissao_id=p_id)
    OR EXISTS(SELECT 1 FROM public.administradora_modelo_modalidades WHERE modalidade_id=p_id)
    OR EXISTS(SELECT 1 FROM public.administradora_curva_modalidades WHERE modalidade_id=p_id)
    OR EXISTS(SELECT 1 FROM public.vendas WHERE snapshot_venda->>'modalidade_comissao_id'=p_id::text)
  THEN RAISE EXCEPTION 'Modalidade possui dependências; inative em vez de excluir'; END IF;
  DELETE FROM public.administradora_modalidade_tipos WHERE modalidade_id=p_id;
  PERFORM public.platform_catalogo_auditar('excluir','administradora_modalidades_comissao',p_id,'[]');
  DELETE FROM public.administradora_modalidades_comissao WHERE id=p_id;
  RETURN jsonb_build_object('id',p_id,'excluida',true);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_curva_estorno(
  p_administradora_id uuid,p_nome text,p_descricao text,p_status text,p_vigencia_inicio date,p_vigencia_fim date,
  p_faixas jsonb,p_todos_tipos boolean,p_tipos uuid[],p_todas_modalidades boolean,p_modalidades uuid[],
  p_curva_id uuid DEFAULT NULL,p_nova_versao boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_curva record;v_f jsonb;v_versao integer;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin';END IF;
  IF length(trim(coalesce(p_nome,'')))<2 OR p_vigencia_inicio IS NULL THEN RAISE EXCEPTION 'Nome e início da vigência são obrigatórios';END IF;
  IF upper(trim(p_status)) NOT IN ('RASCUNHO','HOMOLOGADA','INATIVA') THEN RAISE EXCEPTION 'Status da Curva inválido';END IF;
  IF p_vigencia_fim IS NOT NULL AND p_vigencia_fim<p_vigencia_inicio THEN RAISE EXCEPTION 'Fim da vigência anterior ao início';END IF;
  IF jsonb_typeof(p_faixas)<>'array' OR jsonb_array_length(p_faixas)=0 THEN RAISE EXCEPTION 'Adicione ao menos uma faixa';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_faixas)e WHERE coalesce(e->>'mes','')!~'^[0-9]+$' OR (e->>'mes')::int<1 OR coalesce(e->>'percentual','')!~'^[0-9]+([.][0-9]{1,4})?$' OR (e->>'percentual')::numeric<0 OR (e->>'percentual')::numeric>100) THEN RAISE EXCEPTION 'Faixa de mês/percentual inválida';END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_faixas))<>(SELECT count(DISTINCT (e->>'mes')::int) FROM jsonb_array_elements(p_faixas)e) THEN RAISE EXCEPTION 'Mês duplicado na curva';END IF;
  IF NOT p_todos_tipos AND coalesce(array_length(p_tipos,1),0)=0 THEN RAISE EXCEPTION 'Selecione ao menos um Tipo';END IF;
  IF NOT p_todas_modalidades AND coalesce(array_length(p_modalidades,1),0)=0 THEN RAISE EXCEPTION 'Selecione ao menos uma Modalidade';END IF;
  IF EXISTS(SELECT 1 FROM unnest(coalesce(p_tipos,'{}')) x WHERE NOT EXISTS(SELECT 1 FROM public.administradora_tipos t WHERE t.id=x AND t.administradora_id=p_administradora_id)) THEN RAISE EXCEPTION 'Tipo pertence a outra Administradora';END IF;
  IF EXISTS(SELECT 1 FROM unnest(coalesce(p_modalidades,'{}')) x WHERE NOT EXISTS(SELECT 1 FROM public.administradora_modalidades_comissao m WHERE m.id=x AND m.administradora_id=p_administradora_id)) THEN RAISE EXCEPTION 'Modalidade pertence a outra Administradora';END IF;
  IF p_curva_id IS NOT NULL AND NOT p_nova_versao THEN
    SELECT * INTO v_curva FROM public.administradora_curvas_estorno WHERE id=p_curva_id AND administradora_id=p_administradora_id FOR UPDATE;
    IF v_curva.id IS NULL THEN RAISE EXCEPTION 'Curva não encontrada';END IF;
    IF v_curva.status<>'RASCUNHO' OR EXISTS(SELECT 1 FROM public.comissao_regras_franquia WHERE curva_estorno_id=v_curva.id) THEN RAISE EXCEPTION 'Curva homologada ou utilizada exige Nova versão';END IF;
    UPDATE public.administradora_curvas_estorno SET nome=trim(p_nome),descricao=nullif(trim(coalesce(p_descricao,'')),''),status=upper(trim(p_status)),ativa=upper(trim(p_status))<>'INATIVA',vigencia_inicio=p_vigencia_inicio,vigencia_fim=p_vigencia_fim,aplicavel_todos_tipos=p_todos_tipos,aplicavel_todas_modalidades=p_todas_modalidades,updated_at=now() WHERE id=v_curva.id RETURNING * INTO v_curva;
    DELETE FROM public.administradora_curva_estorno_faixas WHERE curva_id=v_curva.id;
    DELETE FROM public.administradora_curva_tipos WHERE curva_id=v_curva.id;
    DELETE FROM public.administradora_curva_modalidades WHERE curva_id=v_curva.id;
  ELSE
    SELECT coalesce(max(versao),0)+1 INTO v_versao FROM public.administradora_curvas_estorno WHERE administradora_id=p_administradora_id AND lower(trim(nome))=lower(trim(p_nome));
    INSERT INTO public.administradora_curvas_estorno(administradora_id,nome,descricao,versao,vigencia_inicio,vigencia_fim,ativa,encerra_na_contemplacao,status,aplicavel_todos_tipos,aplicavel_todas_modalidades)
    VALUES(p_administradora_id,trim(p_nome),nullif(trim(coalesce(p_descricao,'')),''),v_versao,p_vigencia_inicio,p_vigencia_fim,upper(trim(p_status))<>'INATIVA',true,upper(trim(p_status)),p_todos_tipos,p_todas_modalidades) RETURNING * INTO v_curva;
  END IF;
  FOR v_f IN SELECT value FROM jsonb_array_elements(p_faixas) LOOP
    INSERT INTO public.administradora_curva_estorno_faixas(curva_id,mes_relativo,percentual_estorno) VALUES(v_curva.id,(v_f->>'mes')::int,(v_f->>'percentual')::numeric);
  END LOOP;
  IF NOT p_todos_tipos THEN INSERT INTO public.administradora_curva_tipos(curva_id,tipo_id) SELECT v_curva.id,x FROM unnest(p_tipos)x;END IF;
  IF NOT p_todas_modalidades THEN INSERT INTO public.administradora_curva_modalidades(curva_id,modalidade_id) SELECT v_curva.id,x FROM unnest(p_modalidades)x;END IF;
  PERFORM public.platform_catalogo_auditar(CASE WHEN p_nova_versao THEN 'nova_versao' ELSE 'salvar' END,'administradora_curvas_estorno',v_curva.id,'["nome","descricao","status","vigencia","faixas","tipos","modalidades"]');
  RETURN to_jsonb(v_curva);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_configurar_modalidade_tipos(p_modalidade_id uuid,p_todos boolean,p_tipos uuid[] DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_admin uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
  SELECT administradora_id INTO v_admin FROM public.administradora_modalidades_comissao WHERE id=p_modalidade_id FOR UPDATE;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Modalidade não encontrada'; END IF;
  IF NOT p_todos AND coalesce(array_length(p_tipos,1),0)=0 THEN RAISE EXCEPTION 'Selecione ao menos um Tipo'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(coalesce(p_tipos,'{}')) x WHERE NOT EXISTS(SELECT 1 FROM public.administradora_tipos t WHERE t.id=x AND t.administradora_id=v_admin)) THEN RAISE EXCEPTION 'Tipo pertence a outra Administradora'; END IF;
  UPDATE public.administradora_modalidades_comissao SET aplicavel_todos_tipos=p_todos,updated_at=now() WHERE id=p_modalidade_id;
  DELETE FROM public.administradora_modalidade_tipos WHERE modalidade_id=p_modalidade_id;
  IF NOT p_todos THEN INSERT INTO public.administradora_modalidade_tipos(modalidade_id,tipo_id) SELECT p_modalidade_id,x FROM unnest(p_tipos)x; END IF;
  PERFORM public.platform_catalogo_auditar('configurar_tipos','administradora_modalidades_comissao',p_modalidade_id,'["aplicavel_todos_tipos","tipos"]');
  RETURN jsonb_build_object('id',p_modalidade_id,'todos',p_todos,'tipos',coalesce(p_tipos,'{}'));
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_curva_estorno(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.administradora_curvas_estorno WHERE id=p_id) THEN RAISE EXCEPTION 'Curva não encontrada'; END IF;
  IF EXISTS(SELECT 1 FROM public.comissao_regras_franquia WHERE curva_estorno_id=p_id)
  THEN RAISE EXCEPTION 'Curva possui dependências; inative ou versione'; END IF;
  PERFORM public.platform_catalogo_auditar('excluir','administradora_curvas_estorno',p_id,'[]');
  DELETE FROM public.administradora_curva_tipos WHERE curva_id=p_id;
  DELETE FROM public.administradora_curva_modalidades WHERE curva_id=p_id;
  DELETE FROM public.administradora_curva_estorno_faixas WHERE curva_id=p_id;
  DELETE FROM public.administradora_curvas_estorno WHERE id=p_id;
  RETURN jsonb_build_object('id',p_id,'excluida',true);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_modelo_comissao(
  p_administradora_id uuid,p_tipo_id uuid,p_nome text,p_descricao text,p_percentual numeric,
  p_modalidades jsonb,p_id uuid DEFAULT NULL,p_nova_versao boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_modelo record;v_versao integer;v_item jsonb;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.administradora_tipos WHERE id=p_tipo_id AND administradora_id=p_administradora_id) THEN RAISE EXCEPTION 'Tipo não pertence à Administradora'; END IF;
  IF length(trim(coalesce(p_nome,'')))<2 OR p_percentual<=0 THEN RAISE EXCEPTION 'Nome e percentual total são obrigatórios'; END IF;
  IF jsonb_typeof(p_modalidades)<>'array' OR jsonb_array_length(p_modalidades)=0 THEN RAISE EXCEPTION 'Adicione ao menos uma Modalidade ao Modelo'; END IF;
  IF p_id IS NOT NULL AND NOT p_nova_versao THEN
    SELECT * INTO v_modelo FROM public.administradora_modelos_comissao WHERE id=p_id AND administradora_id=p_administradora_id FOR UPDATE;
    IF v_modelo.id IS NULL THEN RAISE EXCEPTION 'Modelo Master não encontrado'; END IF;
    IF v_modelo.status<>'RASCUNHO' THEN RAISE EXCEPTION 'Modelo homologado exige Nova versão'; END IF;
    UPDATE public.administradora_modelos_comissao SET tipo_id=p_tipo_id,nome=trim(p_nome),descricao=nullif(trim(coalesce(p_descricao,'')),''),percentual_total_referencia=p_percentual,updated_at=now() WHERE id=p_id RETURNING * INTO v_modelo;
    DELETE FROM public.administradora_modelo_modalidades WHERE modelo_id=p_id;
  ELSE
    SELECT coalesce(max(versao),0)+1 INTO v_versao FROM public.administradora_modelos_comissao WHERE administradora_id=p_administradora_id AND nome=trim(p_nome);
    INSERT INTO public.administradora_modelos_comissao(administradora_id,tipo_id,nome,descricao,versao,percentual_total_referencia,status)
    VALUES(p_administradora_id,p_tipo_id,trim(p_nome),nullif(trim(coalesce(p_descricao,'')),''),v_versao,p_percentual,'RASCUNHO') RETURNING * INTO v_modelo;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_modalidades) LOOP
    IF NOT EXISTS(SELECT 1 FROM public.administradora_modalidades_comissao WHERE id=(v_item->>'modalidade_id')::uuid AND administradora_id=p_administradora_id) THEN RAISE EXCEPTION 'Modalidade não pertence à Administradora'; END IF;
    IF nullif(v_item->>'regra_id','') IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.comissao_regras_franquia r JOIN public.comissao_programas p ON p.id=r.programa_id
      WHERE r.id=(v_item->>'regra_id')::uuid AND p.administradora_id=p_administradora_id
        AND r.tipo_administradora_id=p_tipo_id AND r.modalidade_comissao_id=(v_item->>'modalidade_id')::uuid
    ) THEN RAISE EXCEPTION 'Regra canônica não corresponde ao Tipo/Modalidade do Modelo'; END IF;
    INSERT INTO public.administradora_modelo_modalidades(modelo_id,modalidade_id,regra_franquia_origem_id)
    VALUES(v_modelo.id,(v_item->>'modalidade_id')::uuid,nullif(v_item->>'regra_id','')::uuid);
  END LOOP;
  PERFORM public.platform_catalogo_auditar('salvar','administradora_modelos_comissao',v_modelo.id,'["tipo_id","percentual_total_referencia","modalidades"]');
  RETURN to_jsonb(v_modelo);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_configurar_curva_regra(p_regra_id uuid,p_curva_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_regra record;v_admin uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin';END IF;
  SELECT r.*,p.administradora_id INTO v_regra FROM public.comissao_regras_franquia r JOIN public.comissao_programas p ON p.id=r.programa_id WHERE r.id=p_regra_id FOR UPDATE OF r;
  IF v_regra.id IS NULL THEN RAISE EXCEPTION 'Regra não encontrada';END IF;
  v_admin:=v_regra.administradora_id;
  IF v_regra.configuracao_homologada OR EXISTS(SELECT 1 FROM public.comissao_previsoes_franquia WHERE regra_franquia_id=p_regra_id) THEN RAISE EXCEPTION 'Regra homologada ou utilizada exige Nova versão';END IF;
  IF p_curva_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.administradora_curvas_estorno c
    WHERE c.id=p_curva_id AND c.administradora_id=v_admin AND c.status='HOMOLOGADA' AND c.ativa
      AND (c.aplicavel_todos_tipos OR EXISTS(SELECT 1 FROM public.administradora_curva_tipos ct WHERE ct.curva_id=c.id AND ct.tipo_id=v_regra.tipo_administradora_id))
      AND (c.aplicavel_todas_modalidades OR EXISTS(SELECT 1 FROM public.administradora_curva_modalidades cm WHERE cm.curva_id=c.id AND cm.modalidade_id=v_regra.modalidade_comissao_id))
  ) THEN RAISE EXCEPTION 'Curva não homologada ou incompatível com o Tipo/Modalidade da regra';END IF;
  UPDATE public.comissao_regras_franquia SET curva_estorno_id=p_curva_id,updated_at=now() WHERE id=p_regra_id RETURNING * INTO v_regra;
  PERFORM public.platform_catalogo_auditar('configurar_curva','comissao_regras_franquia',p_regra_id,'["curva_estorno_id"]');
  RETURN to_jsonb(v_regra);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_status_programa(p_programa_id uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_programa record;v_status text:=upper(trim(p_status));
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin';END IF;
  IF v_status NOT IN ('ATIVO','INATIVO') THEN RAISE EXCEPTION 'Status do Programa inválido';END IF;
  SELECT * INTO v_programa FROM public.comissao_programas WHERE id=p_programa_id AND administradora_id IS NOT NULL FOR UPDATE;
  IF v_programa.id IS NULL THEN RAISE EXCEPTION 'Programa da Administradora não encontrado';END IF;
  IF v_status='ATIVO' THEN
    IF NOT EXISTS(SELECT 1 FROM public.comissao_regras_franquia WHERE programa_id=p_programa_id) THEN RAISE EXCEPTION 'Programa sem regras não pode ser homologado';END IF;
    IF EXISTS(SELECT 1 FROM public.comissao_regras_franquia r WHERE r.programa_id=p_programa_id AND (r.tipo_administradora_id IS NULL OR r.modalidade_comissao_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.comissao_regra_etapas e WHERE e.regra_franquia_id=r.id) OR abs((SELECT coalesce(sum(e.percentual_venda),0) FROM public.comissao_regra_etapas e WHERE e.regra_franquia_id=r.id)-100)>0.0001)) THEN RAISE EXCEPTION 'Todas as regras exigem Tipo, Modalidade e cronograma fechado em 100%%';END IF;
    IF EXISTS(
      SELECT 1 FROM public.comissao_regras_franquia alvo JOIN public.comissao_regras_franquia outra ON outra.id<>alvo.id AND outra.empresa_id=alvo.empresa_id AND outra.ativa AND outra.configuracao_homologada
      JOIN public.comissao_programas po ON po.id=outra.programa_id AND po.administradora_id=v_programa.administradora_id AND po.ativo
      WHERE alvo.programa_id=p_programa_id AND outra.tipo_administradora_id IS NOT DISTINCT FROM alvo.tipo_administradora_id AND outra.modalidade_comissao_id=alvo.modalidade_comissao_id
        AND alvo.vigencia_inicio<=coalesce(outra.vigencia_fim,'infinity'::date) AND outra.vigencia_inicio<=coalesce(alvo.vigencia_fim,'infinity'::date)
    ) THEN RAISE EXCEPTION 'Homologação bloqueada por regra canônica sobreposta';END IF;
    UPDATE public.comissao_regras_franquia SET configuracao_homologada=true,ativa=true,origem_configuracao='PLATFORM_HOMOLOGADO_083',updated_at=now() WHERE programa_id=p_programa_id;
    UPDATE public.comissao_programas SET status='ATIVO',ativo=true,updated_at=now() WHERE id=p_programa_id RETURNING * INTO v_programa;
  ELSE
    UPDATE public.comissao_programas SET status='INATIVO',ativo=false,updated_at=now() WHERE id=p_programa_id RETURNING * INTO v_programa;
  END IF;
  PERFORM public.platform_catalogo_auditar('status','comissao_programas',p_programa_id,'["status","ativo"]');
  RETURN to_jsonb(v_programa);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_nova_versao_programa(p_programa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_old record;v_new record;v_rule record;v_new_rule uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin';END IF;
  SELECT * INTO v_old FROM public.comissao_programas WHERE id=p_programa_id AND administradora_id IS NOT NULL FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Programa da Administradora não encontrado';END IF;
  INSERT INTO public.comissao_programas(empresa_id,nome,descricao,administradora_id,ativo,versao,status,programa_origem_id)
  VALUES(v_old.empresa_id,v_old.nome,v_old.descricao,v_old.administradora_id,false,v_old.versao+1,'RASCUNHO',v_old.id) RETURNING * INTO v_new;
  FOR v_rule IN SELECT * FROM public.comissao_regras_franquia WHERE programa_id=v_old.id LOOP
    INSERT INTO public.comissao_regras_franquia(empresa_id,programa_id,versao,percentual_total_comissao,base_calculo,vigencia_inicio,vigencia_fim,ativa,etapas_cronograma,modalidade,opcao_cota_id,plano_condicao,valor_fixo_total,configuracao_homologada,origem_configuracao,tipo_administradora_id,modalidade_comissao_id,curva_estorno_id)
    VALUES(v_rule.empresa_id,v_new.id,v_rule.versao+1,v_rule.percentual_total_comissao,v_rule.base_calculo,v_rule.vigencia_inicio,v_rule.vigencia_fim,false,v_rule.etapas_cronograma,v_rule.modalidade,v_rule.opcao_cota_id,v_rule.plano_condicao,v_rule.valor_fixo_total,false,'PLATFORM_NOVA_VERSAO_083',v_rule.tipo_administradora_id,v_rule.modalidade_comissao_id,v_rule.curva_estorno_id) RETURNING id INTO v_new_rule;
    INSERT INTO public.comissao_regra_etapas(regra_franquia_id,ordem,tipo_gatilho,mes_relativo,nome,percentual_venda)
      SELECT v_new_rule,ordem,tipo_gatilho,mes_relativo,nome,percentual_venda FROM public.comissao_regra_etapas WHERE regra_franquia_id=v_rule.id;
  END LOOP;
  UPDATE public.comissao_programas SET status='SUBSTITUIDO',ativo=false,updated_at=now() WHERE id=v_old.id;
  PERFORM public.platform_catalogo_auditar('nova_versao','comissao_programas',v_new.id,'["programa_origem_id","versao"]');
  RETURN to_jsonb(v_new);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_programa(p_programa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.comissao_programas WHERE id=p_programa_id AND administradora_id IS NOT NULL) THEN RAISE EXCEPTION 'Programa da Administradora não encontrado';END IF;
  IF EXISTS(SELECT 1 FROM public.comissao_regras_franquia r WHERE r.programa_id=p_programa_id AND (r.configuracao_homologada OR EXISTS(SELECT 1 FROM public.comissao_previsoes_franquia p WHERE p.regra_franquia_id=r.id)))
    OR EXISTS(SELECT 1 FROM public.comissao_regras_participantes WHERE programa_id=p_programa_id)
  THEN RAISE EXCEPTION 'Programa possui dependências; inative ou crie Nova versão';END IF;
  PERFORM public.platform_catalogo_auditar('excluir','comissao_programas',p_programa_id,'[]');
  DELETE FROM public.comissao_regra_etapas WHERE regra_franquia_id IN(SELECT id FROM public.comissao_regras_franquia WHERE programa_id=p_programa_id);
  DELETE FROM public.comissao_regras_franquia WHERE programa_id=p_programa_id;
  DELETE FROM public.comissao_programas WHERE id=p_programa_id;
  RETURN jsonb_build_object('id',p_programa_id,'excluido',true);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_status_modelo_comissao(p_id uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_row record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
  IF upper(trim(p_status)) NOT IN ('RASCUNHO','HOMOLOGADO','INATIVO','SUBSTITUIDO') THEN RAISE EXCEPTION 'Status de Modelo inválido'; END IF;
  IF upper(trim(p_status))='HOMOLOGADO' AND EXISTS(
    SELECT 1 FROM public.administradora_modelos_comissao m
    WHERE m.id=p_id AND (
      NOT EXISTS(SELECT 1 FROM public.administradora_modelo_modalidades mm WHERE mm.modelo_id=m.id)
      OR EXISTS(
        SELECT 1 FROM public.administradora_modelo_modalidades mm
        LEFT JOIN public.comissao_regras_franquia r ON r.id=mm.regra_franquia_origem_id
        WHERE mm.modelo_id=m.id AND (r.id IS NULL OR NOT r.configuracao_homologada OR r.percentual_total_comissao<>m.percentual_total_referencia)
      )
    )
  ) THEN RAISE EXCEPTION 'Modelo só pode ser homologado com regra canônica homologada e total correspondente em cada Modalidade';END IF;
  UPDATE public.administradora_modelos_comissao SET status=upper(trim(p_status)),updated_at=now() WHERE id=p_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Modelo Master não encontrado'; END IF;
  PERFORM public.platform_catalogo_auditar('status','administradora_modelos_comissao',p_id,'["status"]');
  RETURN to_jsonb(v_row);
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['administradora_modalidade_tipos','administradora_curva_tipos','administradora_curva_modalidades','administradora_modelos_comissao','administradora_modelo_modalidades'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_platform_superadmin())',t||'_platform_select',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_platform_superadmin())',t||'_platform_insert',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin())',t||'_platform_update',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_platform_superadmin())',t||'_platform_delete',t);
  END LOOP;
END $$;

-- O catálogo global continua legível pelo motor, mas toda mutação é explícita e Platform-only.
DROP POLICY IF EXISTS administradora_tipos_platform_write ON public.administradora_tipos;
CREATE POLICY administradora_tipos_platform_insert ON public.administradora_tipos FOR INSERT TO authenticated WITH CHECK (public.is_platform_superadmin());
CREATE POLICY administradora_tipos_platform_update ON public.administradora_tipos FOR UPDATE TO authenticated USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());
CREATE POLICY administradora_tipos_platform_delete ON public.administradora_tipos FOR DELETE TO authenticated USING (public.is_platform_superadmin());
DROP POLICY IF EXISTS administradora_modalidades_platform_write ON public.administradora_modalidades_comissao;
CREATE POLICY administradora_modalidades_platform_insert ON public.administradora_modalidades_comissao FOR INSERT TO authenticated WITH CHECK (public.is_platform_superadmin());
CREATE POLICY administradora_modalidades_platform_update ON public.administradora_modalidades_comissao FOR UPDATE TO authenticated USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());
CREATE POLICY administradora_modalidades_platform_delete ON public.administradora_modalidades_comissao FOR DELETE TO authenticated USING (public.is_platform_superadmin());
DROP POLICY IF EXISTS curvas_platform_write ON public.administradora_curvas_estorno;
CREATE POLICY curvas_platform_insert ON public.administradora_curvas_estorno FOR INSERT TO authenticated WITH CHECK (public.is_platform_superadmin());
CREATE POLICY curvas_platform_update ON public.administradora_curvas_estorno FOR UPDATE TO authenticated USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());
CREATE POLICY curvas_platform_delete ON public.administradora_curvas_estorno FOR DELETE TO authenticated USING (public.is_platform_superadmin());
DROP POLICY IF EXISTS curvas_faixas_platform_write ON public.administradora_curva_estorno_faixas;
CREATE POLICY curvas_faixas_platform_insert ON public.administradora_curva_estorno_faixas FOR INSERT TO authenticated WITH CHECK (public.is_platform_superadmin());
CREATE POLICY curvas_faixas_platform_update ON public.administradora_curva_estorno_faixas FOR UPDATE TO authenticated USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());
CREATE POLICY curvas_faixas_platform_delete ON public.administradora_curva_estorno_faixas FOR DELETE TO authenticated USING (public.is_platform_superadmin());

REVOKE ALL ON FUNCTION public.platform_catalogo_auditar(text,text,uuid,jsonb),public.rpc_platform_salvar_administradora(uuid,text,text,text,text),public.rpc_platform_excluir_administradora(uuid),public.rpc_platform_excluir_tipo_administradora(uuid),public.rpc_platform_excluir_modalidade_administradora(uuid),public.rpc_platform_configurar_modalidade_tipos(uuid,boolean,uuid[]),public.rpc_platform_salvar_curva_estorno(uuid,text,text,text,date,date,jsonb,boolean,uuid[],boolean,uuid[],uuid,boolean),public.rpc_platform_excluir_curva_estorno(uuid),public.rpc_platform_salvar_modelo_comissao(uuid,uuid,text,text,numeric,jsonb,uuid,boolean),public.rpc_platform_status_modelo_comissao(uuid,text),public.rpc_platform_configurar_curva_regra(uuid,uuid),public.rpc_platform_status_programa(uuid,text),public.rpc_platform_nova_versao_programa(uuid),public.rpc_platform_excluir_programa(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_salvar_administradora(uuid,text,text,text,text),public.rpc_platform_excluir_administradora(uuid),public.rpc_platform_excluir_tipo_administradora(uuid),public.rpc_platform_excluir_modalidade_administradora(uuid),public.rpc_platform_configurar_modalidade_tipos(uuid,boolean,uuid[]),public.rpc_platform_salvar_curva_estorno(uuid,text,text,text,date,date,jsonb,boolean,uuid[],boolean,uuid[],uuid,boolean),public.rpc_platform_excluir_curva_estorno(uuid),public.rpc_platform_salvar_modelo_comissao(uuid,uuid,text,text,numeric,jsonb,uuid,boolean),public.rpc_platform_status_modelo_comissao(uuid,text),public.rpc_platform_configurar_curva_regra(uuid,uuid),public.rpc_platform_status_programa(uuid,text),public.rpc_platform_nova_versao_programa(uuid),public.rpc_platform_excluir_programa(uuid) TO authenticated,service_role;

COMMIT;
