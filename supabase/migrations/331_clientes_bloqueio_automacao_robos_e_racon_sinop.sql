-- 331: Opção no cliente para não executar lances automáticos e baixa de boletos + Cópias dos robôs para Racon Sinop ERP

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS nao_executar_lance_automatico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nao_executar_boleto_automatico boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clientes.nao_executar_lance_automatico IS
  'Quando true, o robô de lances automáticos ignora todas as cotas vinculadas a este cliente.';

COMMENT ON COLUMN public.clientes.nao_executar_boleto_automatico IS
  'Quando true, o robô de baixa mensal de boletos ignora todas as cotas vinculadas a este cliente.';

-- Provisionamento idempotente dos robôs de Lances Automáticos e Boletos Mensais para Racon Sinop e Gauchinho Consórcios
DO $$
DECLARE
  v_admin_racon_id uuid;
  v_racon_sinop_id uuid := '87df83a8-1d22-4bd1-9712-5cb08915c4a0';
  v_gauchinho_id   uuid := '7170f38e-15dd-4b19-8588-51e9a9cf0d4c';
BEGIN
  SELECT id INTO v_admin_racon_id
  FROM public.administradoras
  WHERE slug ILIKE '%racon%' OR nome ILIKE '%racon%'
  ORDER BY created_at ASC
  LIMIT 1;

  -- 1. Racon Sinop: Robô de Lances Automáticos (cópia dedicada para usar com outro login)
  IF EXISTS (SELECT 1 FROM public.empresas WHERE id = v_racon_sinop_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.robo_configuracoes
       WHERE empresa_id = v_racon_sinop_id
         AND configuracao_tarefas->>'tipo_rotina' = 'FRANQUIA_LANCES_AUTOMATICOS'
     ) THEN
    INSERT INTO public.robo_configuracoes (
      empresa_id,
      administradora_id,
      nome,
      portal_tipo,
      site_url,
      login_url,
      usuario_login,
      ativo,
      modo,
      configuracao_tarefas
    ) VALUES (
      v_racon_sinop_id,
      v_admin_racon_id,
      'Robô Racon Sinop — Lances Automáticos (Franquia)',
      'RACON',
      'https://nwcweb.randonconsorcios.com.br/',
      'https://e.randonconsorcios.com.br/',
      '',
      true,
      'PRODUCAO',
      jsonb_build_object(
        'tipo_rotina', 'FRANQUIA_LANCES_AUTOMATICOS',
        'descricao', 'Realiza a oferta de lance livre (lance embutido + 1,1234), lance fixo e 2º lance fixo no Newcon Web para todas as cotas ativas não contempladas da franquia Racon Sinop (exceto clientes marcados para não executar automático).',
        'ponto_venda', '939509',
        'modulo_erp_alvo', '/erp/lances',
        'frequencias', jsonb_build_array(
          jsonb_build_object('tipo', 'MENSAL', 'descricao', 'Oferta de lances para todas as cotas não contempladas', 'dia_corte', 10),
          jsonb_build_object('tipo', 'SEMESTRAL', 'descricao', 'Reavaliação e atualização estratégica a cada 6 meses', 'intervalo_meses', 6)
        ),
        'rotas_portal', jsonb_build_object(
          'login_sso', 'https://e.randonconsorcios.com.br/',
          'newcon_web', 'https://nwcweb.randonconsorcios.com.br/frmMain.aspx',
          'localizar_consorciado', 'CONAT/frmConAtSrcConsorciado.aspx',
          'atendimento_consorciado', 'CONAT/frmConAtCnsAtendimento.aspx',
          'oferta_lance', 'CONCP/frmConCpCadCredenciamentoLance.aspx',
          'relatorio_lance', 'CONCM/frmConCmNewconReports.aspx'
        )
      )
    );
  END IF;

  -- 2. Racon Sinop: Robô de Boletos Mensais (cópia dedicada para usar com outro login)
  IF EXISTS (SELECT 1 FROM public.empresas WHERE id = v_racon_sinop_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.robo_configuracoes
       WHERE empresa_id = v_racon_sinop_id
         AND configuracao_tarefas->>'tipo_rotina' = 'FRANQUIA_DOWNLOAD_BOLETOS'
     ) THEN
    INSERT INTO public.robo_configuracoes (
      empresa_id,
      administradora_id,
      nome,
      portal_tipo,
      site_url,
      login_url,
      usuario_login,
      ativo,
      modo,
      configuracao_tarefas
    ) VALUES (
      v_racon_sinop_id,
      v_admin_racon_id,
      'Robô Racon Sinop — Boletos Mensais (Download & Armazenamento)',
      'RACON',
      'https://nwcweb.randonconsorcios.com.br/',
      'https://e.randonconsorcios.com.br/',
      '',
      true,
      'PRODUCAO',
      jsonb_build_object(
        'tipo_rotina', 'FRANQUIA_DOWNLOAD_BOLETOS',
        'descricao', 'Acessa o Newcon Web, localiza cada grupo e cota ativa da franquia Racon Sinop (exceto clientes marcados para não executar automático), emite e baixa o boleto em PDF, extrai a chave Pix Copia e Cola e salva no Supabase Storage.',
        'ponto_venda', '939509',
        'modulo_erp_alvo', '/erp/vendas',
        'frequencias', jsonb_build_array(
          jsonb_build_object('tipo', 'MENSAL', 'descricao', 'Download e captura mensal de boletos', 'dia_corte', 1)
        ),
        'rotas_portal', jsonb_build_object(
          'login_sso', 'https://e.randonconsorcios.com.br/',
          'newcon_web', 'https://nwcweb.randonconsorcios.com.br/frmMain.aspx',
          'localizar_consorciado', 'CONAT/frmConAtSrcConsorciado.aspx',
          'atendimento_consorciado', 'CONAT/frmConAtCnsAtendimento.aspx',
          'emissao_cobranca', 'CONCO/frmConCoRelBoletoAvulso.aspx'
        )
      )
    );
  END IF;

  -- 3. Gauchinho Consórcios: garantir também o Robô Geral de Boletos Mensais (sem filtro restrito de cotas_alvo_ids)
  IF EXISTS (SELECT 1 FROM public.empresas WHERE id = v_gauchinho_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.robo_configuracoes
       WHERE empresa_id = v_gauchinho_id
         AND configuracao_tarefas->>'tipo_rotina' = 'FRANQUIA_DOWNLOAD_BOLETOS'
         AND configuracao_tarefas->'cotas_alvo_ids' IS NULL
     ) THEN
    INSERT INTO public.robo_configuracoes (
      empresa_id,
      administradora_id,
      nome,
      portal_tipo,
      site_url,
      login_url,
      usuario_login,
      senha_encrypted,
      ativo,
      modo,
      configuracao_tarefas
    )
    SELECT
      v_gauchinho_id,
      COALESCE(administradora_id, v_admin_racon_id),
      'Robô Racon — Boletos Mensais (Download & Armazenamento)',
      'RACON',
      'https://nwcweb.randonconsorcios.com.br/',
      'https://e.randonconsorcios.com.br/',
      usuario_login,
      senha_encrypted,
      true,
      'PRODUCAO',
      jsonb_build_object(
        'tipo_rotina', 'FRANQUIA_DOWNLOAD_BOLETOS',
        'descricao', 'Acessa o Newcon Web, localiza cada grupo e cota ativa da franquia Gauchinho Consórcios (exceto clientes marcados para não executar automático), emite e baixa o boleto em PDF, extrai a chave Pix Copia e Cola e salva no Supabase Storage.',
        'ponto_venda', '939509',
        'modulo_erp_alvo', '/erp/vendas',
        'frequencias', jsonb_build_array(
          jsonb_build_object('tipo', 'MENSAL', 'descricao', 'Download e captura mensal de boletos', 'dia_corte', 1)
        ),
        'rotas_portal', jsonb_build_object(
          'login_sso', 'https://e.randonconsorcios.com.br/',
          'newcon_web', 'https://nwcweb.randonconsorcios.com.br/frmMain.aspx',
          'localizar_consorciado', 'CONAT/frmConAtSrcConsorciado.aspx',
          'atendimento_consorciado', 'CONAT/frmConAtCnsAtendimento.aspx',
          'emissao_cobranca', 'CONCO/frmConCoRelBoletoAvulso.aspx'
        )
      )
    FROM public.robo_configuracoes
    WHERE empresa_id = v_gauchinho_id
      AND configuracao_tarefas->>'tipo_rotina' = 'FRANQUIA_LANCES_AUTOMATICOS'
    LIMIT 1;
  END IF;
END $$;
