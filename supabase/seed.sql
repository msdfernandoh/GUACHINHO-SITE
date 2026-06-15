-- Seed inicial (rodar após migration 001)
-- Configurações padrão das abas Fase 1

insert into public.configuracoes_sistema (chave, valor) values
  ('site', '{
    "nomeEmpresa": "Gauchinho Escritório de Soluções Financeiras",
    "subtitulo": "",
    "descricaoInstitucional": "",
    "siteUrl": "",
    "statusAtivo": true,
    "exibirBotaoGruposNoSite": false
  }'::jsonb),
  ('contato', '{
    "whatsappPrincipal": "",
    "telefone": "",
    "email": "",
    "endereco": "",
    "instagram": ""
  }'::jsonb),
  ('propostas', '{
    "validadePadraoDias": 7,
    "textoResumoExecutivo": "",
    "avisoLegalPadrao": ""
  }'::jsonb),
  ('leads', '{
    "statusInicialPadrao": "Novo",
    "permitirCriarLeadManual": true,
    "permitirArquivarLead": true
  }'::jsonb),
  ('simulador_imovel', '{
    "taxaAdministrativaPadrao": 22,
    "fundoReservaPadrao": 2,
    "seguroPrestamistaPadrao": 0.038,
    "reajusteAnualCredito": 8,
    "correcaoAnualParcela": 8,
    "rentabilidadeAnualComparativa": 8,
    "valorMinimoCredito": 150000,
    "valorMaximoCredito": 3000000,
    "valorPadraoInicial": 500000,
    "prazosDisponiveis": [120, 150, 180, 200, 220],
    "prazoPadrao": 200,
    "quantidadePrazosExibidos": 5,
    "mostrarComparacaoFinanciamento": true,
    "mostrarTabelaAnoAno": true,
    "exibirTabelaCompletaPorPadrao": false
  }'::jsonb),
  ('simulador_automovel', '{
    "taxaAdministrativaPadrao": 20,
    "fundoReservaPadrao": 2,
    "seguroPrestamistaPadrao": 0,
    "reajusteAnualCredito": 5,
    "correcaoAnualParcela": 5,
    "rentabilidadeAnualComparativa": 6,
    "valorMinimoCredito": 30000,
    "valorMaximoCredito": 300000,
    "valorPadraoInicial": 100000,
    "prazosDisponiveis": [36, 48, 60, 72, 80],
    "prazoPadrao": 60,
    "quantidadePrazosExibidos": 5,
    "mostrarComparacaoFinanciamento": true,
    "mostrarTabelaAnoAno": true,
    "exibirTabelaCompletaPorPadrao": false
  }'::jsonb),
  ('financiamento_config', '{
    "taxaMensalPadrao": 1,
    "entradaMinimaSugeridaPercentual": 20,
    "prazoPadrao": 240,
    "prazoMaximo": 360,
    "indiceReajusteOpcional": 0,
    "parceiroPadrao": "",
    "mostrarComparacaoConsorcio": true
  }'::jsonb)
on conflict (chave) do nothing;

-- Origens WhatsApp (exemplos)
insert into public.whatsapp_origens (origem, ativo, exibir_botao_apos_lead, usar_whatsapp_principal_fallback)
values
  ('grupos', true, true, true),
  ('contato', true, true, true),
  ('proposta', true, true, true),
  ('simulador_consorcio', true, true, true),
  ('simulador_financiamento', true, true, true)
on conflict (origem) do nothing;

-- ---------------------------------------------------------------------------
-- Usuário Master (Supabase Auth + usuarios)
-- ---------------------------------------------------------------------------
-- 1) No Dashboard Supabase: Authentication → Users → Create user
--    Email: master@gauchinho.local
--    Password: Admin@123456
--    (ou use supabase auth admin API / CLI)
--
-- 2) Copie o UUID de auth.users e substitua abaixo, ou use:
--
-- insert into public.usuarios (auth_user_id, nome, email, perfil, ativo)
-- select id, 'Master Gauchinho', email, 'master', true
-- from auth.users
-- where email = 'master@gauchinho.local'
-- on conflict (email) do update set auth_user_id = excluded.auth_user_id, perfil = 'master', ativo = true;
