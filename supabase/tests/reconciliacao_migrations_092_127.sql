-- Auditoria read-only da lacuna de metadata 092-127 no Supabase Production.
--
-- Este teste NAO altera schema, dados ou historico de migrations. Ele verifica
-- sentinelas persistentes de cada migration. Objetos substituidos por migrations
-- posteriores sao validados pelo estado final esperado, nao pela definicao antiga.

WITH checks(migration, item, ok) AS (
  VALUES
    ('092', 'RPCs de planos/assinaturas',
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_platform_criar_modulo_catalogo')
      AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_platform_excluir_plano')
      AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_platform_salvar_assinatura')),
    ('093', 'HUB de franquias',
      (SELECT count(DISTINCT p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname IN (
         'rpc_platform_atualizar_dados_empresa','rpc_platform_ativar_empresa','rpc_platform_suspender_empresa',
         'rpc_platform_reativar_empresa','rpc_platform_alterar_plano_empresa','rpc_platform_alterar_modelo_empresa',
         'rpc_platform_conceder_administradora_empresa','rpc_platform_revogar_administradora_empresa','rpc_platform_criar_site_parceiro'
       )) = 9),
    ('094', 'Governanca de usuarios',
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='empresa_usuarios'
       AND column_name IN ('is_responsavel_principal','status','convite_enviado_em','convite_token')) = 4
      AND (SELECT count(DISTINCT p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname IN ('rpc_platform_convidar_usuario','rpc_platform_alterar_usuario','rpc_platform_definir_responsavel_empresa','rpc_platform_reenviar_convite_usuario')) = 4),
    ('095', 'Overrides operacionais',
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='saas_empresa_overrides'
       AND column_name IN ('tipo','valor_numerico','valor_booleano','status','observacao','encerrado_em','encerrado_por','motivo_encerramento','criado_por')) = 9
      AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_platform_criar_override')
      AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_platform_encerrar_override')),
    ('096', 'Identidade visual de site parceiro',
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_platform_salvar_identidade_site_parceiro')),
    ('097', 'Bucket de assets dos templates',
      EXISTS (SELECT 1 FROM storage.buckets WHERE id='site-template-assets')),
    ('098', 'Participantes e governanca de lances',
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='participantes_comerciais'
       AND column_name IN ('nome_exibicao','cargo','observacoes','modulos_permitidos','escopo_visualizacao')) = 5
      AND (SELECT count(DISTINCT p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname IN ('rpc_verificar_dependencias_participante','rpc_confirmar_lance_cota','rpc_revogar_confirmacao_lance_cota')) = 3),
    ('099', 'Solicitacoes de repasse',
      to_regclass('public.erp_solicitacoes_repasse') IS NOT NULL
      AND to_regclass('public.erp_solicitacao_repasse_pedidos') IS NOT NULL
      AND to_regclass('public.erp_solicitacao_repasse_historico') IS NOT NULL),
    ('100', 'Clientes completos',
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes'
       AND column_name IN ('data_nascimento','rg','orgao_emissor','estado_civil','profissao','telefone_secundario')) = 6),
    ('101', 'Governanca de contas a pagar',
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='empresa_usuarios' AND column_name='pode_estornar_contas')
      AND (SELECT count(DISTINCT p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname IN ('is_financeiro_tenant_master','pode_estornar_conta_pagar','rpc_alterar_conta_pagar','rpc_estornar_conta_pagar','rpc_excluir_conta_pagar')) = 5),
    ('102', 'Historico de vinculacoes legadas',
      to_regclass('public.grupos_vinculacoes_legadas_historico') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_vincular_grupo_legado')),
    ('103', 'Preparacao e conversao de formalizacao',
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_preparar_formalizacao_contratacao')
      AND to_regprocedure('public.rpc_converter_contratacao_venda(uuid,uuid,text)') IS NOT NULL),
    ('104', 'Contato ou usuario do participante',
      EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.participantes_comerciais'::regclass AND conname='participantes_comerciais_contato_ou_usuario_chk')),
    ('105', 'Geracao V2 de previsoes',
      to_regprocedure('public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text)') IS NOT NULL),
    ('106', 'Colunas operacionais do participante',
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='participantes_comerciais'
       AND column_name IN ('nome_exibicao','cargo','observacoes','modulos_permitidos','escopo_visualizacao')) = 5),
    ('107', 'Perfis de comissao',
      to_regclass('public.comissao_perfis') IS NOT NULL
      AND to_regclass('public.participante_comissao_perfis') IS NOT NULL
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='comissao_regras_participantes' AND column_name='perfil_id')),
    ('108', 'Curvas de estorno tenant-aware',
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='administradora_curvas_estorno' AND column_name='empresa_id')),
    ('109', 'Autonomia de programas',
      (SELECT count(DISTINCT p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname IN ('validate_comissao_tenant_integrity','rpc_platform_salvar_dados_programa','rpc_platform_salvar_regra_programa','rpc_platform_excluir_programa','rpc_platform_excluir_regra_programa')) = 5),
    ('110', 'Triggers de validacao de regras',
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.comissao_regras_participantes'::regclass AND tgname='trg_comissao_regra_participante_validate' AND NOT tgisinternal)
      AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.comissao_regras_franquia'::regclass AND tgname='trg_comissao_regra_franquia_validate' AND NOT tgisinternal)),
    ('111', 'Geradores canonicos de previsoes',
      to_regprocedure('public.rpc_gerar_previsoes_comissao(uuid,uuid,text)') IS NOT NULL
      AND to_regprocedure('public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text)') IS NOT NULL),
    ('112', 'Integridade de participantes da venda',
      EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.venda_participantes'::regclass AND conname='venda_participantes_papel_check')
      AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.venda_participantes'::regclass AND conname='venda_participantes_tipo_atuacao_check')),
    ('113', 'Datas, participantes e cancelamento',
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='vendas'
       AND column_name IN ('data_primeira_parcela','data_segunda_parcela','participante_secundario_id','participante_secundario_fracao_percentual','perfil_principal_id','perfil_secundario_id')) = 6
      AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='cotas_definitivas'
       AND column_name IN ('motivo_cancelamento','cancelada_em','cancelada_por_usuario_id')) = 3),
    ('114', 'Contemplacao e antecipacao',
      EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.cotas_definitivas'::regclass AND conname='cotas_contemplacao_v2_check')
      AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_registrar_contemplacao_comissoes')),
    ('115', 'Edicao master de venda',
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_master_atualizar_dados_venda')),
    ('116', 'Curva de estorno tolerante',
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_platform_salvar_curva_estorno')),
    ('117', 'Fornecedores, bancos e centros',
      to_regclass('public.financeiro_fornecedores') IS NOT NULL
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financeiro_contas_pagar' AND column_name='fornecedor_id')
      AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_obter_ou_criar_fornecedor')),
    ('118', 'Documentos de contas a pagar',
      EXISTS (SELECT 1 FROM storage.buckets WHERE id='contas-pagar-documentos')
      AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='financeiro_contas_pagar'
       AND column_name IN ('comprovante_url','nota_fiscal_nome','nota_fiscal_uploaded_at')) = 3),
    ('119', 'Desconto em comissao',
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financeiro_centros_custo' AND column_name='descontado_comissao')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financeiro_contas_pagar' AND column_name='descontado_comissao')),
    ('120', 'Resolucao de programa da franquia',
      to_regprocedure('public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text)') IS NOT NULL),
    ('121', 'Enriquecimento da venda e formalizacao',
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='comissao_v2_enriquecer_venda')
      AND to_regprocedure('public.rpc_converter_contratacao_venda(uuid,uuid,text)') IS NOT NULL),
    ('122', 'Participante tipo por UUID',
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='participante_tipo_id'
       AND table_name IN ('participantes_comerciais','contratacoes_online','vendas','venda_participantes','comissao_regras_participantes','comissao_previsoes_participantes','participante_comissao_perfis','participante_tipos')) = 8),
    ('123', 'Papel, perfil e vinculo de previsoes',
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='comissao_previsoes_participantes' AND column_name='papel_tipo')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='comissao_previsoes_participantes' AND column_name='previsao_franquia_id')),
    ('124', 'Base de calculo e defaults',
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='comissao_previsoes_participantes' AND column_name='valor_fixo_aplicado')
      AND (SELECT column_default='0' FROM information_schema.columns WHERE table_schema='public' AND table_name='comissao_previsoes_participantes' AND column_name='base_calculo_valor')),
    ('125', 'Conversao canonica da cota',
      to_regprocedure('public.rpc_converter_contratacao_venda(uuid,uuid,text)') IS NOT NULL),
    ('126', 'Hardening multitenant para escala',
      to_regclass('public.integracao_api_keys') IS NOT NULL
      AND to_regclass('public.public_ingress_rate_limits') IS NOT NULL
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='grupos_vinculacoes_legadas_historico' AND column_name='empresa_id' AND is_nullable='NO')
      AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='vendas' AND column_name IN ('prazo_original_grupo','parcelas_restantes_venda','prazo_referencia_em')) = 3
      AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='cotas_definitivas' AND column_name IN ('prazo_original_grupo','parcelas_restantes_venda','prazo_referencia_em')) = 3
      AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('simulacoes_grupos','simulacoes_grupos_itens','eventos_site','imobiliarias','imoveis') AND column_name='empresa_id' AND is_nullable='NO') = 5
      AND to_regprocedure('public.calcular_prazo_restante_grupo(uuid,date)') IS NOT NULL),
    ('127', 'Formalizacao e comissoes estritas',
      to_regprocedure('public.rpc_converter_contratacao_venda(uuid,uuid,text)') IS NOT NULL
      AND to_regprocedure('public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text)') IS NOT NULL
      AND NOT has_function_privilege('anon', 'public.rpc_converter_contratacao_venda(uuid,uuid,text)', 'EXECUTE')
      AND NOT has_function_privilege('service_role', 'public.rpc_converter_contratacao_venda(uuid,uuid,text)', 'EXECUTE')),
    ('133', 'Reconciliacao, privilegios e preservacao do modelo canonico',
      NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = ANY (ARRAY[
            'rpc_platform_criar_modulo_catalogo','rpc_platform_excluir_plano','rpc_platform_salvar_assinatura',
            'rpc_platform_atualizar_dados_empresa','rpc_platform_ativar_empresa','rpc_platform_suspender_empresa',
            'rpc_platform_reativar_empresa','rpc_platform_alterar_plano_empresa',
            'rpc_platform_conceder_administradora_empresa','rpc_platform_revogar_administradora_empresa',
            'rpc_platform_criar_site_parceiro','rpc_platform_convidar_usuario','rpc_platform_alterar_usuario',
            'rpc_platform_definir_responsavel_empresa','rpc_platform_reenviar_convite_usuario',
            'rpc_platform_criar_override','rpc_platform_encerrar_override',
            'rpc_platform_salvar_identidade_site_parceiro','rpc_verificar_dependencias_participante',
            'rpc_confirmar_lance_cota','rpc_revogar_confirmacao_lance_cota','rpc_obter_ou_criar_fornecedor'
          ])
          AND (
            has_function_privilege('anon', p.oid, 'EXECUTE')
            OR has_function_privilege('service_role', p.oid, 'EXECUTE')
            OR NOT COALESCE(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=pg_catalog']
          )
      )
      AND position(
        'empresa_site_modelos' IN pg_get_functiondef(
          'public.rpc_platform_alterar_modelo_empresa(uuid,uuid)'::regprocedure
        )
      ) > 0)
), summarized AS (
  SELECT migration, bool_and(ok) AS ok,
         string_agg(item, ', ' ORDER BY item) FILTER (WHERE NOT ok) AS faltando
  FROM checks
  GROUP BY migration
)
SELECT migration, ok, COALESCE(faltando, '') AS faltando
FROM summarized
ORDER BY migration::integer;
