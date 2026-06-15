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
  }'::jsonb)
on conflict (chave) do nothing;

-- Origens WhatsApp (exemplos)
insert into public.whatsapp_origens (origem, ativo, exibir_botao_apos_lead, usar_whatsapp_principal_fallback)
values
  ('grupos', true, true, true),
  ('contato', true, true, true),
  ('proposta', true, true, true)
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
