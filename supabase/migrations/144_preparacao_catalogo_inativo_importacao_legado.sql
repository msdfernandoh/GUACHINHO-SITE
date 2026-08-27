-- 144 — Prepara grupo/crédito básico inativo para carteira legada.
-- O registro permite importar e calcular comissão pelo valor contratado, mas
-- status Inativo impede publicação no site/ERP comercial até homologação.
BEGIN;
CREATE OR REPLACE FUNCTION public.rpc_preparar_catalogo_importacao_legado_racon(
  p_empresa_id uuid,
  p_itens jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_admin uuid; v_item jsonb; v_codigo text; v_bem text; v_tipo uuid; v_grupo uuid; v_valor numeric; v_criados integer:=0; v_creditos integer:=0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF jsonb_typeof(p_itens)<>'array' THEN RAISE EXCEPTION 'Itens inválidos'; END IF;
  SELECT id INTO v_admin FROM public.administradoras
  WHERE status='ATIVA' AND regexp_replace(upper(coalesce(nome_fantasia,nome,'')),'[^A-Z0-9]','','g') LIKE '%RACON%'
  ORDER BY created_at LIMIT 1;
  IF v_admin IS NULL OR NOT EXISTS(SELECT 1 FROM public.empresa_administradoras WHERE empresa_id=p_empresa_id AND administradora_id=v_admin AND status='ATIVA') THEN
    RAISE EXCEPTION 'Racon não concedida à empresa';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_codigo:=trim(v_item->>'grupo'); v_bem:=trim(v_item->>'bem'); v_valor:=(v_item->>'valor_credito')::numeric;
    IF nullif(v_codigo,'') IS NULL OR v_valor<=0 THEN CONTINUE; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_admin::text||':LEGADO:'||v_codigo,0));
    SELECT id INTO v_grupo FROM public.grupos_consorcio WHERE administradora_id=v_admin AND trim(codigo_grupo)=v_codigo LIMIT 1;
    IF v_grupo IS NULL THEN
      SELECT id INTO v_tipo FROM public.administradora_tipos
      WHERE administradora_id=v_admin AND ativo
      ORDER BY CASE WHEN regexp_replace(upper(nome),'[^A-Z0-9]','','g') LIKE '%'||regexp_replace(upper(v_bem),'[^A-Z0-9]','','g')||'%' THEN 0 ELSE 1 END,nome LIMIT 1;
      IF v_tipo IS NULL THEN RAISE EXCEPTION 'Nenhum tipo ativo da Racon para o grupo legado %',v_codigo; END IF;
      INSERT INTO public.grupos_consorcio(administradora_id,tipo_administradora_id,codigo_grupo,status,ativo,prazo_total,
        taxa_administrativa_percentual,fundo_reserva_percentual,seguro_percentual,capacidade_total,vagas_disponiveis,
        origem_governanca,status_governanca,observacoes)
      VALUES(v_admin,v_tipo,v_codigo,'Inativo',true,1,0,0,0,0,0,'PLATFORM','GLOBAL',
        'Cadastro básico criado exclusivamente para importação histórica; requer homologação antes de uso comercial.')
      RETURNING id INTO v_grupo;
      v_criados:=v_criados+1;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.grupos_cotas WHERE grupo_id=v_grupo AND abs(valor_credito-v_valor)<0.01) THEN
      INSERT INTO public.grupos_cotas(grupo_id,valor_credito,valor_parcela,status,ativo)
      VALUES(v_grupo,v_valor,0,'Legado',true);
      v_creditos:=v_creditos+1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('grupos_basicos_criados',v_criados,'creditos_legados_criados',v_creditos);
END $$;
REVOKE ALL ON FUNCTION public.rpc_preparar_catalogo_importacao_legado_racon(uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_preparar_catalogo_importacao_legado_racon(uuid,jsonb) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
