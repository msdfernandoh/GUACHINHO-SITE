BEGIN;

-- Contratos estruturais que também rodam contra um Supabase isolado após 076.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cotas_definitivas' AND column_name='valor_credito_contemplacao') THEN RAISE EXCEPTION 'campo histórico de contemplação ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='rpc_marcar_cota_contemplada') THEN RAISE EXCEPTION 'RPC de contemplação ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='rpc_registrar_recebimento_com_divergencia') THEN RAISE EXCEPTION 'RPC de divergência ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='rpc_transferir_pendencia_recebimento') THEN RAISE EXCEPTION 'RPC de pendência ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='comissao_v2_gerar_participante_manual') THEN RAISE EXCEPTION 'motor manual de participante ausente'; END IF;
  IF (SELECT count(*) FROM public.administradora_tipos t JOIN public.administradoras a ON a.id=t.administradora_id WHERE a.slug='racon' AND t.codigo IN ('IMOVEL','AUTOMOVEIS'))<>2 THEN RAISE EXCEPTION 'tipos Racon inválidos'; END IF;
  IF (SELECT count(*) FROM public.administradora_modalidades_comissao m JOIN public.administradoras a ON a.id=m.administradora_id WHERE a.slug='racon')<>3 THEN RAISE EXCEPTION 'modalidades Racon inválidas'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.comissao_regras_franquia r JOIN public.comissao_regra_etapas e ON e.regra_franquia_id=r.id
    JOIN public.administradora_modalidades_comissao m ON m.id=r.modalidade_comissao_id
    WHERE r.origem_configuracao='RACON_TABELA_OFICIAL_V2' AND m.codigo IN ('INTEGRAL','REDUZIDA_60_99') AND e.tipo_gatilho='CONTEMPLACAO'
  ) THEN RAISE EXCEPTION 'Integral/60-99 recebeu contemplação indevida'; END IF;
  IF (SELECT count(*) FROM public.comissao_regras_franquia r JOIN public.comissao_regra_etapas e ON e.regra_franquia_id=r.id JOIN public.administradora_modalidades_comissao m ON m.id=r.modalidade_comissao_id WHERE r.origem_configuracao='RACON_TABELA_OFICIAL_V2' AND m.codigo='REDUZIDA_ABAIXO_59' AND e.tipo_gatilho='CONTEMPLACAO')<>2 THEN RAISE EXCEPTION 'contemplação abaixo de 59 inválida'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.comissao_regras_franquia r JOIN public.comissao_regra_etapas e ON e.regra_franquia_id=r.id
    WHERE r.origem_configuracao='RACON_TABELA_OFICIAL_V2' GROUP BY r.id,r.percentual_total_comissao HAVING sum(e.percentual_venda)<>r.percentual_total_comissao
  ) THEN RAISE EXCEPTION 'total matemático Racon divergente'; END IF;
END $$;

ROLLBACK;
