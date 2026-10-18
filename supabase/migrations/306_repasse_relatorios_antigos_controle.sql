BEGIN;

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cadastro_antigo boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS somente_controle boolean NOT NULL DEFAULT false;
ALTER TABLE public.grupos_consorcio ADD COLUMN IF NOT EXISTS cadastro_antigo boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.trg_grupos_exigir_primeira_assembleia_novos() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.data_primeira_assembleia IS NULL AND NOT (NEW.cadastro_antigo AND NOT NEW.ativo
      AND NEW.origem_governanca = 'LOCAL' AND NEW.status_governanca = 'CONFIGURACAO_PENDENTE') THEN
    RAISE EXCEPTION 'Data da primeira assembleia é obrigatória para novos grupos';
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.grupo_antigo_exigir_configuracao_ativo() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.cadastro_antigo AND NEW.ativo AND (NEW.data_primeira_assembleia IS NULL OR coalesce(NEW.prazo_total,0) <= 0) THEN
    RAISE EXCEPTION 'Complete a data da primeira assembleia e o prazo antes de ativar o grupo antigo';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER grupos_antigos_configuracao BEFORE UPDATE ON public.grupos_consorcio
  FOR EACH ROW EXECUTE FUNCTION public.grupo_antigo_exigir_configuracao_ativo();
ALTER TABLE public.vendas ADD CONSTRAINT vendas_somente_controle_sem_faturamento
  CHECK (NOT somente_controle OR (NOT afeta_faturamento AND origem_registro = 'IMPORTACAO_LEGADO'));

CREATE TABLE public.repasse_relatorios_antigos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  administradora_id uuid NOT NULL REFERENCES public.administradoras(id),
  participante_comercial_id uuid NOT NULL,
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
  arquivo_nome text NOT NULL,
  arquivo_path text NOT NULL,
  arquivo_hash text NOT NULL,
  relatorio jsonb NOT NULL,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (participante_comercial_id, empresa_id) REFERENCES public.participantes_comerciais(id, empresa_id),
  UNIQUE (empresa_id, administradora_id, arquivo_hash)
);
ALTER TABLE public.repasse_relatorios_antigos ENABLE ROW LEVEL SECURITY;
CREATE POLICY repasse_antigos_leitura ON public.repasse_relatorios_antigos FOR SELECT TO authenticated
  USING (public.has_company_permission(empresa_id, 'gerenciar_financeiro'));
GRANT SELECT ON public.repasse_relatorios_antigos TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.repasse_relatorios_antigos FROM authenticated, anon;

-- A importação de controle não enriquece modalidades nem altera o catálogo global.
DROP TRIGGER vendas_comissao_v2_enriquecer ON public.vendas;
CREATE TRIGGER vendas_comissao_v2_enriquecer BEFORE INSERT ON public.vendas
  FOR EACH ROW WHEN (NOT NEW.somente_controle) EXECUTE FUNCTION public.comissao_v2_enriquecer_venda();
DROP TRIGGER vendas_snapshot_prazo_restante ON public.vendas;
CREATE TRIGGER vendas_snapshot_prazo_restante BEFORE INSERT ON public.vendas
  FOR EACH ROW WHEN (NOT NEW.somente_controle) EXECUTE FUNCTION public.venda_snapshot_prazo_restante();
CREATE OR REPLACE FUNCTION public.cota_snapshot_prazo_restante() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE v_venda public.vendas%ROWTYPE;
BEGIN
  SELECT * INTO v_venda FROM public.vendas WHERE id = NEW.venda_id AND empresa_id = NEW.empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada nesta empresa'; END IF;
  IF v_venda.somente_controle THEN RETURN NEW; END IF;
  IF v_venda.parcelas_restantes_venda IS NULL THEN RAISE EXCEPTION 'Venda sem snapshot de parcelas restantes'; END IF;
  NEW.prazo_original_grupo := v_venda.prazo_original_grupo;
  NEW.parcelas_restantes_venda := v_venda.parcelas_restantes_venda;
  NEW.prazo_referencia_em := v_venda.prazo_referencia_em;
  NEW.prazo := v_venda.parcelas_restantes_venda;
  NEW.snapshot_cota := COALESCE(NEW.snapshot_cota, '{}'::jsonb) || jsonb_build_object(
    'prazo_original_grupo', v_venda.prazo_original_grupo, 'parcelas_restantes_venda', v_venda.parcelas_restantes_venda,
    'prazo_referencia_em', v_venda.prazo_referencia_em);
  RETURN NEW;
END $$;

CREATE FUNCTION public.proteger_venda_somente_controle() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF OLD.somente_controle AND NOT NEW.somente_controle THEN
    RAISE EXCEPTION 'Cadastro antigo de controle não pode ser convertido em venda com receita';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER vendas_proteger_somente_controle BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.proteger_venda_somente_controle();

CREATE FUNCTION public.bloquear_comissao_cadastro_antigo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vendas WHERE id = NEW.venda_id AND somente_controle) THEN
    RAISE EXCEPTION 'Cadastro antigo somente para controle: não gera comissões nem receita';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER comissao_franquia_bloquear_antigos BEFORE INSERT OR UPDATE ON public.comissao_previsoes_franquia
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_comissao_cadastro_antigo();
CREATE TRIGGER comissao_participante_bloquear_antigos BEFORE INSERT OR UPDATE ON public.comissao_previsoes_participantes
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_comissao_cadastro_antigo();

CREATE FUNCTION public.rpc_importar_repasse_antigo(
  p_empresa_id uuid, p_administradora_id uuid, p_participante_comercial_id uuid,
  p_competencia text, p_arquivo_nome text, p_arquivo_path text, p_arquivo_hash text, p_relatorio jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_id uuid; v_existente public.repasse_relatorios_antigos%ROWTYPE;
  v_item record; v_grupo public.grupos_consorcio%ROWTYPE; v_cota public.cotas_definitivas%ROWTYPE;
  v_venda public.vendas%ROWTYPE; v_cliente_id uuid; v_venda_id uuid; v_cota_id uuid;
  v_ids uuid[]; v_novos integer := 0; v_reutilizados integer := 0; v_resultado jsonb;
  v_vinculos jsonb := '[]'::jsonb; v_snapshot jsonb; v_clientes jsonb := '{}'::jsonb;
  v_novos_clientes integer := 0; v_grupos_criados integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para importar relatórios antigos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.participantes_comerciais WHERE id = p_participante_comercial_id
      AND empresa_id = p_empresa_id AND status = 'ATIVO') THEN
    RAISE EXCEPTION 'Selecione um consultor ativo desta empresa';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresa_administradoras WHERE empresa_id = p_empresa_id
      AND administradora_id = p_administradora_id AND status = 'ATIVA') THEN
    RAISE EXCEPTION 'Administradora não habilitada nesta empresa';
  END IF;
  IF p_competencia IS NULL OR p_competencia !~ '^\d{4}-(0[1-9]|1[0-2])$'
     OR p_arquivo_hash IS NULL OR p_arquivo_hash !~ '^[0-9a-f]{64}$'
     OR p_arquivo_path IS NULL OR p_arquivo_path NOT LIKE p_empresa_id::text || '/antigos/%'
     OR jsonb_typeof(p_relatorio->'itens') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_relatorio->'itens') = 0 THEN
    RAISE EXCEPTION 'Relatório antigo inválido';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':' || p_administradora_id::text, 306));
  SELECT * INTO v_existente FROM public.repasse_relatorios_antigos
    WHERE empresa_id = p_empresa_id AND administradora_id = p_administradora_id AND arquivo_hash = p_arquivo_hash;
  IF FOUND THEN
    IF v_existente.participante_comercial_id <> p_participante_comercial_id THEN
      RAISE EXCEPTION 'Este relatório já foi importado com outro consultor. Os vínculos existentes foram preservados';
    END IF;
    RETURN v_existente.resultado || jsonb_build_object('idempotente', true);
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_relatorio->'itens') i
      WHERE coalesce(i->>'grupo', '') !~ '^[0-9]{1,6}$' OR coalesce(i->>'cota', '') !~ '^[0-9]{1,4}$'
        OR btrim(coalesce(i->>'cliente_nome', '')) = '' OR coalesce(i->>'data_alocacao', '') !~ '^\d{4}-\d{2}-\d{2}$') THEN
    RAISE EXCEPTION 'Relatório contém cliente, grupo, cota ou data incompletos';
  END IF;
  INSERT INTO public.repasse_relatorios_antigos(empresa_id, administradora_id, participante_comercial_id,
    competencia, arquivo_nome, arquivo_path, arquivo_hash, relatorio)
  VALUES(p_empresa_id, p_administradora_id, p_participante_comercial_id,
    p_competencia, p_arquivo_nome, p_arquivo_path, p_arquivo_hash, p_relatorio) RETURNING id INTO v_id;

  FOR v_item IN
    SELECT ltrim(i->>'grupo', '0') grupo, ltrim(i->>'cota', '0') cota,
      min(btrim(i->>'cliente_nome')) nome, min((i->>'data_alocacao')::date) primeira_data,
      min(i->>'versao') versao, count(DISTINCT upper(btrim(i->>'cliente_nome'))) nomes,
      min(i->>'produto') produto,
      count(DISTINCT i->>'versao') versoes, max(coalesce((i->>'valor_base')::numeric, 0)) base_referencia
    FROM jsonb_array_elements(p_relatorio->'itens') i
    GROUP BY ltrim(i->>'grupo', '0'), ltrim(i->>'cota', '0')
  LOOP
    IF v_item.nomes <> 1 OR v_item.versoes > 1 OR v_item.grupo = '' OR v_item.cota = '' THEN
      RAISE EXCEPTION 'Grupo %, cota % possui titulares/versões diferentes. Confira o relatório antes de importar', v_item.grupo, v_item.cota;
    END IF;
    SELECT array_agg(id) INTO v_ids FROM public.grupos_consorcio
      WHERE administradora_id = p_administradora_id
        AND ltrim(substring(codigo_grupo from '[0-9]+'), '0') = v_item.grupo
        AND (origem_governanca IN ('GLOBAL', 'LEGADO') OR empresa_origem_id = p_empresa_id);
    IF coalesce(cardinality(v_ids), 0) > 1 THEN
      RAISE EXCEPTION 'Grupo % ambíguo nesta administradora. Confira antes de importar', v_item.grupo;
    ELSIF coalesce(cardinality(v_ids), 0) = 0 THEN
      INSERT INTO public.grupos_consorcio(codigo_grupo, modalidade, administradora_id, status, ativo, cadastro_antigo,
        empresa_origem_id, origem_governanca, status_governanca, observacoes)
      VALUES(v_item.grupo, coalesce(v_item.produto, 'Cadastro administrativo'), p_administradora_id, 'Inativo', false, true,
        p_empresa_id, 'LOCAL', 'CONFIGURACAO_PENDENTE',
        'Grupo local inativo criado por relatório antigo; conferir dados e prazo. Não publicado no site.') RETURNING * INTO v_grupo;
      INSERT INTO public.grupos_governanca_historico(grupo_id,empresa_origem_id,evento,usuario_id,observacao)
      VALUES(v_grupo.id,p_empresa_id,'CRIADO_LOCAL',public.current_usuario_id(),'Relatório antigo: grupo inativo com configuração pendente.');
      v_grupos_criados := v_grupos_criados + 1;
    ELSE
      SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = v_ids[1];
    END IF;
    SELECT array_agg(id) INTO v_ids FROM public.cotas_definitivas
      WHERE empresa_id = p_empresa_id AND administradora_id = p_administradora_id AND grupo_id = v_grupo.id
        AND ltrim(numero_cota, '0') = v_item.cota;
    IF coalesce(cardinality(v_ids), 0) > 1 THEN
      RAISE EXCEPTION 'Grupo %, cota % possui cadastros duplicados. Confira antes de importar', v_item.grupo, v_item.cota;
    END IF;
    IF cardinality(v_ids) = 1 THEN
      SELECT * INTO v_cota FROM public.cotas_definitivas WHERE id = v_ids[1];
      SELECT * INTO v_venda FROM public.vendas WHERE id = v_cota.venda_id AND empresa_id = p_empresa_id;
      IF upper(btrim(v_venda.cliente_nome)) <> upper(v_item.nome)
        OR (v_cota.snapshot_cota->>'versao' IS NOT NULL AND v_cota.snapshot_cota->>'versao' <> v_item.versao) THEN
        RAISE EXCEPTION 'Grupo %, cota % já cadastrado com outro titular/versão. Cadastro preservado', v_item.grupo, v_item.cota;
      END IF;
      IF v_venda.participante_comercial_id IS DISTINCT FROM p_participante_comercial_id THEN
        RAISE EXCEPTION 'Grupo %, cota % já vinculado a outro consultor. Cadastro preservado', v_item.grupo, v_item.cota;
      END IF;
      IF v_venda.somente_controle AND v_item.primeira_data < v_venda.data_venda::date THEN
        UPDATE public.vendas SET data_venda = v_item.primeira_data,
          snapshot_venda = snapshot_venda || jsonb_build_object('data_primeira_comissao_relatorio', v_item.primeira_data)
          WHERE id = v_venda.id;
      END IF;
      v_cota_id := v_cota.id; v_reutilizados := v_reutilizados + 1;
    ELSE
      v_snapshot := jsonb_build_object('somente_controle', true, 'tags', jsonb_build_array('antigos'),
        'relatorio_antigo_id', v_id, 'versao', v_item.versao,
        'data_primeira_comissao_relatorio', v_item.primeira_data,
        'valor_base_relatorio', v_item.base_referencia, 'cadastro_incompleto', true);
      v_cliente_id := (v_clientes->>upper(v_item.nome))::uuid;
      IF v_cliente_id IS NULL THEN
      INSERT INTO public.clientes(empresa_id, tipo_pessoa, nome, participante_comercial_id, origem,
        cadastro_antigo, pendencias_cadastro, observacoes)
      VALUES(p_empresa_id, CASE WHEN upper(v_item.nome) ~ '(^| )(LTDA|EIRELI|S[./]?A[.]?)$' THEN 'PJ' ELSE 'PF' END,
        v_item.nome, p_participante_comercial_id, 'importacao_legado', true,
        ARRAY['PENDENTE_TIPO_PESSOA','PENDENTE_CPF_CNPJ','PENDENTE_EMAIL','PENDENTE_TELEFONE','PENDENTE_ENDERECO','PENDENTE_CREDITO','PENDENTE_PARCELA','PENDENTE_PRAZO'],
        'Antigos: cadastro incompleto importado apenas para controle de contemplações e boletos; conferir tipo de pessoa e dados.')
      RETURNING id INTO v_cliente_id;
      v_clientes := v_clientes || jsonb_build_object(upper(v_item.nome), v_cliente_id);
      v_novos_clientes := v_novos_clientes + 1;
      END IF;
      INSERT INTO public.vendas(empresa_id, cliente_id, cliente_nome, administradora_id, grupo_id,
        participante_comercial_id, valor_credito, prazo, parcela, status, snapshot_venda, data_venda,
        origem_registro, afeta_faturamento, somente_controle)
      VALUES(p_empresa_id, v_cliente_id, v_item.nome, p_administradora_id, v_grupo.id,
        p_participante_comercial_id, 0, 0, 0, 'confirmada', v_snapshot, v_item.primeira_data,
        'IMPORTACAO_LEGADO', false, true) RETURNING id INTO v_venda_id;
      INSERT INTO public.cotas_definitivas(empresa_id, venda_id, administradora_id, grupo_id, numero_grupo,
        numero_cota, valor_credito, prazo, parcela, status, participante_comercial_id, snapshot_cota, origem_registro)
      VALUES(p_empresa_id, v_venda_id, p_administradora_id, v_grupo.id, v_item.grupo,
        lpad(v_item.cota, 4, '0'), 0, 0, 0, 'ativa', p_participante_comercial_id,
        v_snapshot, 'IMPORTACAO_LEGADO') RETURNING id INTO v_cota_id;
      v_novos := v_novos + 1;
    END IF;
    v_vinculos := v_vinculos || jsonb_build_array(jsonb_build_object('cota_id', v_cota_id,
      'cliente_nome', v_item.nome, 'grupo', v_item.grupo, 'cota', v_item.cota, 'data_venda', v_item.primeira_data));
  END LOOP;
  v_resultado := jsonb_build_object('relatorio_id', v_id, 'novos', v_novos, 'novos_clientes', v_novos_clientes,
    'grupos_criados', v_grupos_criados, 'reutilizados', v_reutilizados, 'vinculos', v_vinculos);
  UPDATE public.repasse_relatorios_antigos SET resultado = v_resultado WHERE id = v_id;
  RETURN v_resultado;
END $$;
REVOKE ALL ON FUNCTION public.rpc_importar_repasse_antigo(uuid,uuid,uuid,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_importar_repasse_antigo(uuid,uuid,uuid,text,text,text,text,jsonb) TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
