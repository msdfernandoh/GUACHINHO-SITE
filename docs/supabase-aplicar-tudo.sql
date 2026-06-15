-- =============================================================================
-- Gauchinho - aplicar tudo no Supabase (banco vazio)
-- =============================================================================
-- Execute no Supabase Dashboard: menu SQL, New query, cole este conteudo e Run.
--
-- ORDEM OBRIGATORIA (nao pule etapas):
--   1) 001_initial_schema.sql        - tabelas, RLS, funcoes (base de tudo)
--   2) 002_storage_propostas_pdf.sql - depende de 001 (public.usuarios nas policies)
--   3) 003_cartas_contempladas.sql   - depende de 001 (leads, is_staff)
--   4) seed.sql                      - depende de 001 (configuracoes_sistema, whatsapp_origens)
--   5) Usuario Master (final)        - crie antes no Auth: master@gauchinho.local
--
-- Pode rodar o arquivo inteiro de uma vez OU cada secao (marcadores INICIO/FIM),
-- sempre nesta ordem. Aguarde sucesso antes da proxima se se rodar por partes.
-- =============================================================================

-- INICIO: 001_initial_schema.sql
-- =============================================================================
-- Gauchinho Fase 1 — schema inicial (Supabase Postgres)
-- Aplicar: supabase db push (linked) ou SQL Editor no dashboard

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- usuarios (perfil de negócio ligado ao Supabase Auth)
-- ---------------------------------------------------------------------------
create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique,
  telefone text,
  perfil text not null check (perfil in ('master', 'srd', 'imobiliaria', 'visualizador')),
  imobiliaria_id uuid,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index usuarios_auth_user_id_idx on public.usuarios (auth_user_id);
create index usuarios_perfil_idx on public.usuarios (perfil);

-- ---------------------------------------------------------------------------
-- configuracoes_sistema (abas do admin — valor JSONB por chave)
-- ---------------------------------------------------------------------------
create table public.configuracoes_sistema (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  valor jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- whatsapp_origens
-- ---------------------------------------------------------------------------
create table public.whatsapp_origens (
  id uuid primary key default gen_random_uuid(),
  origem text not null unique,
  ativo boolean not null default true,
  exibir_botao_apos_lead boolean not null default false,
  nome_atendimento text,
  whatsapp_destino text,
  mensagem_padrao text,
  usar_whatsapp_principal_fallback boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text,
  email text,
  cidade text,
  origem text,
  origem_detalhe text,
  tipo_interesse text,
  produto_interesse text,
  valor_simulado numeric(15, 2),
  prazo_simulado integer,
  entrada numeric(15, 2),
  renda numeric(15, 2),
  dados_simulacao jsonb,
  resultado_resumido text,
  analise_ia text,
  status text not null default 'Novo',
  srd_responsavel_id uuid references public.usuarios (id) on delete set null,
  srd_responsavel_nome text,
  proximo_retorno_data date,
  proximo_retorno_hora time,
  retorno_observacao text,
  fechado boolean not null default false,
  data_fechamento date,
  valor_fechado numeric(15, 2),
  produto_fechado text,
  motivo_perda text,
  observacoes text,
  criado_manual boolean not null default false,
  criado_por_usuario_id uuid references public.usuarios (id) on delete set null,
  imobiliaria_id uuid,
  imovel_id uuid,
  carta_contemplada_id uuid,
  parceiro_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_status_idx on public.leads (status);
create index leads_origem_idx on public.leads (origem);
create index leads_srd_idx on public.leads (srd_responsavel_id);
create index leads_proximo_retorno_idx on public.leads (proximo_retorno_data);

-- ---------------------------------------------------------------------------
-- leads_historico
-- ---------------------------------------------------------------------------
create table public.leads_historico (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  usuario_id uuid references public.usuarios (id) on delete set null,
  acao text not null,
  descricao text,
  status_anterior text,
  status_novo text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz not null default now()
);

create index leads_historico_lead_id_idx on public.leads_historico (lead_id);

-- ---------------------------------------------------------------------------
-- propostas
-- ---------------------------------------------------------------------------
create table public.propostas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  nome_cliente text,
  whatsapp_cliente text,
  email_cliente text,
  cidade_cliente text,
  tipo_proposta text,
  tipo_bem text,
  parceiro_id uuid,
  parceiro_nome text,
  valor_credito numeric(15, 2),
  prazo integer,
  entrada numeric(15, 2),
  valor_parcela numeric(15, 2),
  taxa_administrativa numeric(8, 4),
  fundo_reserva numeric(8, 4),
  seguro_prestamista numeric(8, 4),
  reajuste_credito_anual numeric(8, 4),
  correcao_parcela_anual numeric(8, 4),
  dados_simulacao jsonb,
  resumo_projecao jsonb,
  comparativo_financiamento jsonb,
  consultor_nome text,
  consultor_telefone text,
  consultor_email text,
  contato_exibido_tipo text,
  validade_dias integer,
  validade_data date,
  validade_origem text,
  pdf_url text,
  status text not null default 'Gerada',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index propostas_lead_id_idx on public.propostas (lead_id);
create index propostas_status_idx on public.propostas (status);

-- ---------------------------------------------------------------------------
-- grupos_consorcio
-- ---------------------------------------------------------------------------
create table public.grupos_consorcio (
  id uuid primary key default gen_random_uuid(),
  codigo_grupo text not null,
  modalidade text not null,
  administradora text,
  taxa_administrativa_percentual numeric(8, 4),
  fundo_reserva_percentual numeric(8, 4),
  seguro_habilitado boolean not null default false,
  seguro_percentual numeric(8, 4),
  seguro_valor numeric(15, 2),
  tem_parcela_reduzida boolean not null default false,
  percentual_parcela_reduzida numeric(8, 4),
  permite_lance_embutido boolean not null default false,
  percentual_lance_embutido numeric(8, 4),
  percentual_recurso_proprio_sugerido numeric(8, 4),
  prazo_total integer,
  parcelas_realizadas integer default 0,
  prazo_restante integer,
  seguro_pos_contemplacao boolean not null default false,
  cet_percentual numeric(8, 4),
  status text not null default 'Disponível',
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index grupos_consorcio_codigo_idx on public.grupos_consorcio (codigo_grupo);
create index grupos_consorcio_modalidade_idx on public.grupos_consorcio (modalidade);
create index grupos_consorcio_ativo_idx on public.grupos_consorcio (ativo);

-- ---------------------------------------------------------------------------
-- grupos_cotas
-- ---------------------------------------------------------------------------
create table public.grupos_cotas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_consorcio (id) on delete cascade,
  valor_credito numeric(15, 2) not null,
  valor_parcela numeric(15, 2),
  parcela_integral numeric(15, 2),
  parcela_reduzida numeric(15, 2),
  parcela_com_seguro numeric(15, 2),
  parcela_sem_seguro numeric(15, 2),
  saldo_devedor numeric(15, 2),
  vagas_percentual numeric(8, 4),
  vagas_texto text,
  status text not null default 'Disponível',
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index grupos_cotas_grupo_id_idx on public.grupos_cotas (grupo_id);

-- ---------------------------------------------------------------------------
-- simulacoes_grupos
-- ---------------------------------------------------------------------------
create table public.simulacoes_grupos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  proposta_id uuid references public.propostas (id) on delete set null,
  usuario_id uuid references public.usuarios (id) on delete set null,
  origem text,
  modalidade text,
  dados_totais jsonb,
  credito_liquido numeric(15, 2),
  total_grupos integer,
  total_cotas integer,
  total_credito numeric(15, 2),
  total_saldo_devedor numeric(15, 2),
  total_lance_embutido numeric(15, 2),
  total_recurso_proprio numeric(15, 2),
  total_lance numeric(15, 2),
  total_primeira_parcela numeric(15, 2),
  total_seguro numeric(15, 2),
  total_parcelas_restantes numeric(15, 2),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- simulacoes_grupos_itens
-- ---------------------------------------------------------------------------
create table public.simulacoes_grupos_itens (
  id uuid primary key default gen_random_uuid(),
  simulacao_grupo_id uuid not null references public.simulacoes_grupos (id) on delete cascade,
  grupo_id uuid references public.grupos_consorcio (id) on delete set null,
  grupo_cota_id uuid references public.grupos_cotas (id) on delete set null,
  codigo_grupo text,
  modalidade text,
  valor_credito numeric(15, 2),
  quantidade_cotas integer default 1,
  soma_cotas numeric(15, 2),
  saldo_devedor numeric(15, 2),
  lance_embutido numeric(15, 2),
  recurso_proprio numeric(15, 2),
  lance_total numeric(15, 2),
  primeira_parcela numeric(15, 2),
  seguro numeric(15, 2),
  parcelas_realizadas integer,
  prazo_restante integer,
  seguro_pos_contemplacao boolean,
  parcelas_restantes numeric(15, 2),
  cet_percentual numeric(8, 4),
  created_at timestamptz not null default now()
);

create index simulacoes_grupos_itens_simulacao_idx on public.simulacoes_grupos_itens (simulacao_grupo_id);

-- ---------------------------------------------------------------------------
-- eventos_site
-- ---------------------------------------------------------------------------
create table public.eventos_site (
  id uuid primary key default gen_random_uuid(),
  tipo_evento text not null,
  origem text,
  pagina text,
  entidade_tipo text,
  entidade_id uuid,
  imobiliaria_id uuid,
  carta_id uuid,
  imovel_id uuid,
  lead_id uuid references public.leads (id) on delete set null,
  usuario_id uuid references public.usuarios (id) on delete set null,
  dados_evento jsonb,
  created_at timestamptz not null default now()
);

create index eventos_site_tipo_idx on public.eventos_site (tipo_evento);
create index eventos_site_created_at_idx on public.eventos_site (created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers RLS
-- ---------------------------------------------------------------------------
create or replace function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid() and u.ativo = true and u.perfil = 'master'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid() and u.ativo = true
      and u.perfil in ('master', 'srd', 'visualizador')
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS (políticas iniciais — refinar na Fase 1 app)
-- ---------------------------------------------------------------------------
alter table public.usuarios enable row level security;
alter table public.configuracoes_sistema enable row level security;
alter table public.whatsapp_origens enable row level security;
alter table public.leads enable row level security;
alter table public.leads_historico enable row level security;
alter table public.propostas enable row level security;
alter table public.grupos_consorcio enable row level security;
alter table public.grupos_cotas enable row level security;
alter table public.simulacoes_grupos enable row level security;
alter table public.simulacoes_grupos_itens enable row level security;
alter table public.eventos_site enable row level security;

-- usuarios: staff lê; master gerencia
create policy usuarios_select_staff on public.usuarios for select to authenticated
  using (public.is_staff() or auth.uid() = auth_user_id);

create policy usuarios_all_master on public.usuarios for all to authenticated
  using (public.is_master()) with check (public.is_master());

-- config: staff lê; master escreve
create policy configuracoes_select_staff on public.configuracoes_sistema for select to authenticated
  using (public.is_staff());

create policy configuracoes_all_master on public.configuracoes_sistema for all to authenticated
  using (public.is_master()) with check (public.is_master());

-- whatsapp_origens: staff lê; master escreve
create policy whatsapp_select_staff on public.whatsapp_origens for select to authenticated
  using (public.is_staff());

create policy whatsapp_all_master on public.whatsapp_origens for all to authenticated
  using (public.is_master()) with check (public.is_master());

-- leads / histórico / propostas: staff CRUD (SRD operacional — ajuste fino depois)
create policy leads_staff on public.leads for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy leads_historico_staff on public.leads_historico for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy propostas_staff on public.propostas for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- grupos: leitura pública (anon) para ativos; staff gerencia
create policy grupos_public_read on public.grupos_consorcio for select to anon, authenticated
  using (ativo = true and status <> 'Inativo');

create policy grupos_staff_write on public.grupos_consorcio for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy cotas_public_read on public.grupos_cotas for select to anon, authenticated
  using (
    ativo = true
    and status <> 'Inativo'
    and exists (
      select 1 from public.grupos_consorcio g
      where g.id = grupo_id and g.ativo = true and g.status <> 'Inativo'
    )
  );

create policy cotas_staff_write on public.grupos_cotas for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- simulações: insert anon/authenticated (página /grupos); staff lê tudo
create policy simulacoes_insert_public on public.simulacoes_grupos for insert to anon, authenticated
  with check (true);

create policy simulacoes_select_staff on public.simulacoes_grupos for select to authenticated
  using (public.is_staff());

create policy simulacoes_itens_insert_public on public.simulacoes_grupos_itens for insert to anon, authenticated
  with check (true);

create policy simulacoes_itens_select_staff on public.simulacoes_grupos_itens for select to authenticated
  using (public.is_staff());

-- eventos: insert público; staff lê
create policy eventos_insert_public on public.eventos_site for insert to anon, authenticated
  with check (true);

create policy eventos_select_staff on public.eventos_site for select to authenticated
  using (public.is_staff());

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger usuarios_updated_at before update on public.usuarios
  for each row execute function public.set_updated_at();
create trigger configuracoes_updated_at before update on public.configuracoes_sistema
  for each row execute function public.set_updated_at();
create trigger whatsapp_updated_at before update on public.whatsapp_origens
  for each row execute function public.set_updated_at();
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
create trigger propostas_updated_at before update on public.propostas
  for each row execute function public.set_updated_at();
create trigger grupos_updated_at before update on public.grupos_consorcio
  for each row execute function public.set_updated_at();
create trigger cotas_updated_at before update on public.grupos_cotas
  for each row execute function public.set_updated_at();

-- =============================================================================
-- FIM: 001_initial_schema.sql
-- =============================================================================


-- =============================================================================
-- INICIO: 002_storage_propostas_pdf.sql
-- =============================================================================
-- Bucket para PDFs de propostas (rodar após 001)
-- Dashboard alternativo: Storage → New bucket → propostas-pdf (private)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'propostas-pdf',
  'propostas-pdf',
  false,
  5242880,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types;

-- Upload/delete: service role (API servidor). Leitura: staff autenticado com perfil master/srd/imobiliaria/visualizador via usuarios.

create policy "propostas_pdf_select_staff"
on storage.objects for select to authenticated
using (
  bucket_id = 'propostas-pdf'
  and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid() and u.ativo = true
  )
);

create policy "propostas_pdf_insert_service"
on storage.objects for insert to authenticated
with check (bucket_id = 'propostas-pdf');

create policy "propostas_pdf_update_service"
on storage.objects for update to authenticated
using (bucket_id = 'propostas-pdf');

create policy "propostas_pdf_delete_master"
on storage.objects for delete to authenticated
using (
  bucket_id = 'propostas-pdf'
  and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid() and u.perfil = 'master' and u.ativo = true
  )
);

-- =============================================================================
-- FIM: 002_storage_propostas_pdf.sql
-- =============================================================================


-- =============================================================================
-- INICIO: 003_cartas_contempladas.sql
-- =============================================================================
-- Fase 4 — Cartas contempladas

create table public.cartas_contempladas (
  id uuid primary key default gen_random_uuid(),
  tipo_carta text not null check (tipo_carta in ('imovel', 'automovel')),
  administradora text,
  credito numeric(15, 2),
  entrada numeric(15, 2),
  prazo_quantidade integer,
  valor_parcela numeric(15, 2),
  saldo_devedor numeric(15, 2),
  proxima_parcela_data date,
  taxa_transferencia numeric(15, 2),
  texto_original text,
  status text not null default 'consultar_disponibilidade' check (
    status in (
      'disponivel',
      'consultar_disponibilidade',
      'em_negociacao',
      'reservada',
      'vendida',
      'indisponivel',
      'inativa'
    )
  ),
  ativo boolean not null default true,
  destaque boolean not null default false,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cartas_contempladas_status_idx on public.cartas_contempladas (status);
create index cartas_contempladas_ativo_idx on public.cartas_contempladas (ativo);
create index cartas_contempladas_tipo_idx on public.cartas_contempladas (tipo_carta);
create index cartas_contempladas_administradora_idx on public.cartas_contempladas (administradora);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_carta_contemplada_id_fkey'
  ) then
    alter table public.leads
      add constraint leads_carta_contemplada_id_fkey
      foreign key (carta_contemplada_id)
      references public.cartas_contempladas (id)
      on delete set null;
  end if;
end $$;

alter table public.cartas_contempladas enable row level security;

create policy cartas_public_read on public.cartas_contempladas
  for select to anon, authenticated
  using (
    ativo = true
    and status in ('disponivel', 'consultar_disponibilidade')
  );

create policy cartas_staff_write on public.cartas_contempladas
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- =============================================================================
-- FIM: 003_cartas_contempladas.sql
-- =============================================================================


-- =============================================================================
-- INICIO: seed.sql
-- =============================================================================
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
  }'::jsonb),
  ('home_cartas_contempladas', '{
    "exibirNaHome": false,
    "quantidade": 3,
    "mostrarBotaoVerCartas": true,
    "mostrarApenasDestaque": true
  }'::jsonb)
on conflict (chave) do nothing;

-- Origens WhatsApp (exemplos)
insert into public.whatsapp_origens (origem, ativo, exibir_botao_apos_lead, usar_whatsapp_principal_fallback)
values
  ('grupos', true, true, true),
  ('contato', true, true, true),
  ('proposta', true, true, true),
  ('simulador_consorcio', true, true, true),
  ('simulador_financiamento', true, true, true),
  ('carta_contemplada', true, true, true)
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

-- =============================================================================
-- FIM: seed.sql
-- =============================================================================

-- =============================================================================
-- INICIO: usuario Master (Auth + public.usuarios)
-- =============================================================================
-- ANTES de rodar este bloco:
--   1) Authentication → Providers → Email habilitado
--   2) Authentication → Users → Add user → Create new user
--      Email: master@gauchinho.local
--      Password: Admin@123456 (ou outra; use a mesma no login)
--      Auto Confirm User, se disponível
-- =============================================================================

insert into public.usuarios (auth_user_id, nome, email, perfil, ativo)
select id, 'Master Gauchinho', email, 'master', true
from auth.users
where email = 'master@gauchinho.local'
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id,
      perfil = 'master',
      ativo = true;

-- =============================================================================
-- FIM: usuario Master
-- =============================================================================
