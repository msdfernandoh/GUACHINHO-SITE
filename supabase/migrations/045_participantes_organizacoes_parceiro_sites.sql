-- ============================================================================
-- Migration 045: Participantes Comerciais, Organizações Parceiras e Sites
-- (Fase 3 — schema + papéis/perms + helpers + colunas estruturais)
--
-- NÃO APLICAR sem autorização explícita do proprietário.
--
-- Escopo:
--   - participantes_comerciais, tipos, auditoria
--   - organizacoes_parceiras, participante_organizacoes
--   - parceiro_sites, parceiro_site_dominios, auditorias
--   - colunas nullable em leads/propostas (sem backfill)
--   - papel parceiro_comercial + permissões granulares
--   - helpers de contexto/isolamento
--
-- Explicitamente NÃO faz:
--   - backfill de leads/propostas
--   - migrar parceiro_id CMS ou srd_responsavel_id
--   - alterar/renomear parceiro_imobiliaria, imobiliarias, parceiros CMS
--   - policies novas em leads/propostas (adiadas — convivência com CRM legado)
--   - integração Vercel / DNS / seed de domínio real
--   - tocar Empresa B operacionalmente
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 0. Dependências
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    raise exception 'Função public.set_updated_at() não encontrada. Execute migrations anteriores.';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'normalize_empresa_dominio_valor'
  ) then
    raise exception 'Função public.normalize_empresa_dominio_valor() não encontrada. Execute a migration 044.';
  end if;

  if not exists (select 1 from public.empresas where slug = 'gauchinho') then
    raise exception 'Empresa "gauchinho" não encontrada. Execute a migration 043.';
  end if;

  if not exists (
    select 1 from public.papeis where codigo = 'parceiro_imobiliaria' and empresa_id is null
  ) then
    raise exception 'Papel legado parceiro_imobiliaria não encontrado. Abortando para preservar legado.';
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 0.1 Normalizadores auxiliares (CPF/CNPJ/telefone/e-mail/slug)
-- --------------------------------------------------------------------------
create or replace function public.normalize_digits(p_valor text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_valor, ''), '[^0-9]', '', 'g'), '');
$$;

revoke all on function public.normalize_digits(text) from public;
grant execute on function public.normalize_digits(text) to authenticated, service_role;

create or replace function public.normalize_email_valor(p_valor text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(p_valor, ''))), '');
$$;

revoke all on function public.normalize_email_valor(text) from public;
grant execute on function public.normalize_email_valor(text) to authenticated, service_role;

create or replace function public.normalize_slug_valor(p_valor text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  if p_valor is null then
    return null;
  end if;
  v := lower(trim(p_valor));
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := regexp_replace(v, '^-+|-+$', '', 'g');
  if v = '' then
    return null;
  end if;
  return v;
end;
$$;

revoke all on function public.normalize_slug_valor(text) from public;
grant execute on function public.normalize_slug_valor(text) to authenticated, service_role;

-- Alias semântico para domínios de parceiro (mesma regra da 044)
create or replace function public.normalize_parceiro_site_dominio_valor(p_valor text)
returns text
language sql
immutable
as $$
  select public.normalize_empresa_dominio_valor(p_valor);
$$;

revoke all on function public.normalize_parceiro_site_dominio_valor(text) from public;
grant execute on function public.normalize_parceiro_site_dominio_valor(text) to authenticated, service_role;

-- --------------------------------------------------------------------------
-- 1. Catálogo de tipos de participante
-- --------------------------------------------------------------------------
create table if not exists public.participante_tipo_catalogo (
  codigo text primary key,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.participante_tipo_catalogo (codigo, nome) values
  ('GESTOR', 'Gestor'),
  ('CONSULTOR', 'Consultor'),
  ('VENDEDOR', 'Vendedor'),
  ('ATENDENTE', 'Atendente'),
  ('INDICADOR', 'Indicador'),
  ('RESPONSAVEL_PARCEIRO', 'Responsável Parceiro')
on conflict (codigo) do update set nome = excluded.nome, ativo = true;

-- --------------------------------------------------------------------------
-- 2. Participantes comerciais
-- --------------------------------------------------------------------------
create table if not exists public.participantes_comerciais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  usuario_id uuid references public.usuarios (id) on delete set null,
  nome text not null,
  nome_exibicao text,
  cpf text,
  email text,
  telefone text,
  whatsapp text,
  cargo text,
  status text not null default 'RASCUNHO'
    check (status in ('RASCUNHO', 'ATIVO', 'INATIVO', 'SUSPENSO', 'DESLIGADO')),
  gestor_participante_id uuid references public.participantes_comerciais (id) on delete set null,
  data_entrada date,
  data_saida date,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_usuario_id uuid references public.usuarios (id) on delete set null,
  constraint participantes_comerciais_nome_chk check (char_length(trim(nome)) > 0),
  constraint participantes_comerciais_contato_chk check (
    nullif(trim(coalesce(telefone, '')), '') is not null
    or nullif(trim(coalesce(whatsapp, '')), '') is not null
  ),
  constraint participantes_comerciais_cpf_digits_chk check (
    cpf is null or cpf ~ '^[0-9]{11}$'
  ),
  constraint participantes_gestor_diff_chk check (
    gestor_participante_id is null or gestor_participante_id <> id
  )
);

create index if not exists participantes_comerciais_empresa_idx
  on public.participantes_comerciais (empresa_id);
create index if not exists participantes_comerciais_empresa_status_idx
  on public.participantes_comerciais (empresa_id, status);
create index if not exists participantes_comerciais_usuario_idx
  on public.participantes_comerciais (usuario_id)
  where usuario_id is not null;

-- No máximo um participante ATIVO por usuario_id na mesma empresa
create unique index if not exists participantes_usuario_ativo_empresa_uidx
  on public.participantes_comerciais (empresa_id, usuario_id)
  where usuario_id is not null and status = 'ATIVO';

-- CPF único por empresa quando preenchido
create unique index if not exists participantes_cpf_empresa_uidx
  on public.participantes_comerciais (empresa_id, cpf)
  where cpf is not null;

drop trigger if exists participantes_comerciais_updated_at on public.participantes_comerciais;
create trigger participantes_comerciais_updated_at
  before update on public.participantes_comerciais
  for each row execute function public.set_updated_at();

create or replace function public.participantes_comerciais_before_write()
returns trigger
language plpgsql
as $$
declare
  v_gestor_empresa uuid;
begin
  new.nome := trim(new.nome);
  new.nome_exibicao := nullif(trim(coalesce(new.nome_exibicao, '')), '');
  new.email := public.normalize_email_valor(new.email);
  new.cpf := public.normalize_digits(new.cpf);
  new.telefone := nullif(trim(coalesce(new.telefone, '')), '');
  new.whatsapp := nullif(trim(coalesce(new.whatsapp, '')), '');
  new.cargo := nullif(trim(coalesce(new.cargo, '')), '');

  if new.cpf is not null and char_length(new.cpf) <> 11 then
    raise exception 'CPF deve ter 11 dígitos após normalização';
  end if;

  if new.gestor_participante_id is not null then
    select empresa_id into v_gestor_empresa
    from public.participantes_comerciais
    where id = new.gestor_participante_id;
    if v_gestor_empresa is null then
      raise exception 'Gestor participante inexistente';
    end if;
    if v_gestor_empresa <> new.empresa_id then
      raise exception 'Gestor deve pertencer à mesma empresa do participante';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists participantes_comerciais_normalize on public.participantes_comerciais;
create trigger participantes_comerciais_normalize
  before insert or update on public.participantes_comerciais
  for each row execute function public.participantes_comerciais_before_write();

-- Tipos N por participante
create table if not exists public.participante_tipos (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references public.participantes_comerciais (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  tipo_codigo text not null references public.participante_tipo_catalogo (codigo),
  created_at timestamptz not null default now(),
  unique (participante_id, tipo_codigo)
);

create index if not exists participante_tipos_empresa_idx
  on public.participante_tipos (empresa_id);
create index if not exists participante_tipos_tipo_idx
  on public.participante_tipos (tipo_codigo);

create or replace function public.participante_tipos_before_write()
returns trigger
language plpgsql
as $$
declare
  v_empresa uuid;
begin
  select empresa_id into v_empresa
  from public.participantes_comerciais
  where id = new.participante_id;
  if v_empresa is null then
    raise exception 'Participante inexistente para tipo';
  end if;
  new.empresa_id := v_empresa;
  return new;
end;
$$;

drop trigger if exists participante_tipos_normalize on public.participante_tipos;
create trigger participante_tipos_normalize
  before insert or update on public.participante_tipos
  for each row execute function public.participante_tipos_before_write();

-- Auditoria append-only
create table if not exists public.participante_auditoria (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references public.participantes_comerciais (id) on delete restrict,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  acao text not null check (acao in (
    'CRIAR', 'ATIVAR', 'INATIVAR', 'SUSPENDER', 'DESLIGAR',
    'VINCULAR_USUARIO', 'DESVINCULAR_USUARIO',
    'VINCULAR_GESTOR', 'DESVINCULAR_GESTOR',
    'VINCULAR_ORGANIZACAO', 'DESVINCULAR_ORGANIZACAO',
    'ATUALIZAR'
  )),
  actor_usuario_id uuid references public.usuarios (id) on delete set null,
  motivo text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists participante_auditoria_participante_idx
  on public.participante_auditoria (participante_id, created_at desc);
create index if not exists participante_auditoria_empresa_idx
  on public.participante_auditoria (empresa_id, created_at desc);

-- --------------------------------------------------------------------------
-- 3. Organizações parceiras
-- --------------------------------------------------------------------------
create table if not exists public.organizacoes_parceiras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  tipo text not null check (tipo in (
    'PARCEIRO_COMERCIAL', 'IMOBILIARIA', 'CONTABILIDADE', 'CORRETORA_DE_SEGUROS',
    'EMPRESA_DE_SERVICOS', 'ASSOCIACAO', 'INDICADOR_EMPRESARIAL', 'OUTRO'
  )),
  nome_fantasia text not null,
  razao_social text,
  cnpj text,
  status text not null default 'RASCUNHO'
    check (status in ('RASCUNHO', 'ATIVA', 'INATIVA', 'SUSPENSA', 'ENCERRADA')),
  telefone text,
  whatsapp text,
  email text,
  site text,
  instagram text,
  descricao text,
  cidade text,
  estado text,
  cep text,
  endereco text,
  regioes_atuacao jsonb not null default '[]'::jsonb,
  logo_url text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_usuario_id uuid references public.usuarios (id) on delete set null,
  constraint organizacoes_parceiras_nome_chk check (char_length(trim(nome_fantasia)) > 0),
  constraint organizacoes_parceiras_contato_chk check (
    nullif(trim(coalesce(telefone, '')), '') is not null
    or nullif(trim(coalesce(whatsapp, '')), '') is not null
  ),
  constraint organizacoes_parceiras_cnpj_digits_chk check (
    cnpj is null or cnpj ~ '^[0-9]{14}$'
  )
);

create index if not exists organizacoes_parceiras_empresa_idx
  on public.organizacoes_parceiras (empresa_id);
create index if not exists organizacoes_parceiras_empresa_status_idx
  on public.organizacoes_parceiras (empresa_id, status);

create unique index if not exists organizacoes_parceiras_cnpj_empresa_uidx
  on public.organizacoes_parceiras (empresa_id, cnpj)
  where cnpj is not null;

drop trigger if exists organizacoes_parceiras_updated_at on public.organizacoes_parceiras;
create trigger organizacoes_parceiras_updated_at
  before update on public.organizacoes_parceiras
  for each row execute function public.set_updated_at();

create or replace function public.organizacoes_parceiras_before_write()
returns trigger
language plpgsql
as $$
begin
  new.nome_fantasia := trim(new.nome_fantasia);
  new.razao_social := nullif(trim(coalesce(new.razao_social, '')), '');
  new.cnpj := public.normalize_digits(new.cnpj);
  new.email := public.normalize_email_valor(new.email);
  new.telefone := nullif(trim(coalesce(new.telefone, '')), '');
  new.whatsapp := nullif(trim(coalesce(new.whatsapp, '')), '');
  new.site := nullif(trim(coalesce(new.site, '')), '');
  new.instagram := nullif(trim(coalesce(new.instagram, '')), '');
  new.cidade := nullif(trim(coalesce(new.cidade, '')), '');
  new.estado := nullif(upper(trim(coalesce(new.estado, ''))), '');
  new.cep := public.normalize_digits(new.cep);
  if new.cnpj is not null and char_length(new.cnpj) <> 14 then
    raise exception 'CNPJ deve ter 14 dígitos após normalização';
  end if;
  if new.regioes_atuacao is null then
    new.regioes_atuacao := '[]'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists organizacoes_parceiras_normalize on public.organizacoes_parceiras;
create trigger organizacoes_parceiras_normalize
  before insert or update on public.organizacoes_parceiras
  for each row execute function public.organizacoes_parceiras_before_write();

-- N:N participante ↔ organização
create table if not exists public.participante_organizacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  participante_id uuid not null references public.participantes_comerciais (id) on delete restrict,
  organizacao_parceira_id uuid not null references public.organizacoes_parceiras (id) on delete restrict,
  funcao text,
  principal boolean not null default false,
  responsavel_principal boolean not null default false,
  ativo boolean not null default true,
  inicio_vigencia date,
  fim_vigencia date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participante_id, organizacao_parceira_id)
);

create index if not exists participante_organizacoes_empresa_idx
  on public.participante_organizacoes (empresa_id);
create index if not exists participante_organizacoes_org_idx
  on public.participante_organizacoes (organizacao_parceira_id);
create index if not exists participante_organizacoes_part_idx
  on public.participante_organizacoes (participante_id);

-- No máximo um responsável principal ativo por organização
create unique index if not exists participante_org_responsavel_principal_uidx
  on public.participante_organizacoes (organizacao_parceira_id)
  where responsavel_principal = true and ativo = true;

-- No máximo uma organização marcada como principal ativa por participante
create unique index if not exists participante_org_principal_uidx
  on public.participante_organizacoes (participante_id)
  where principal = true and ativo = true;

drop trigger if exists participante_organizacoes_updated_at on public.participante_organizacoes;
create trigger participante_organizacoes_updated_at
  before update on public.participante_organizacoes
  for each row execute function public.set_updated_at();

create or replace function public.participante_organizacoes_before_write()
returns trigger
language plpgsql
as $$
declare
  v_part_empresa uuid;
  v_org_empresa uuid;
begin
  select empresa_id into v_part_empresa
  from public.participantes_comerciais where id = new.participante_id;
  select empresa_id into v_org_empresa
  from public.organizacoes_parceiras where id = new.organizacao_parceira_id;

  if v_part_empresa is null or v_org_empresa is null then
    raise exception 'Participante ou organização inexistente';
  end if;
  if v_part_empresa <> v_org_empresa then
    raise exception 'Participante e organização devem pertencer à mesma empresa';
  end if;
  new.empresa_id := v_part_empresa;
  new.funcao := nullif(trim(coalesce(new.funcao, '')), '');
  return new;
end;
$$;

drop trigger if exists participante_organizacoes_normalize on public.participante_organizacoes;
create trigger participante_organizacoes_normalize
  before insert or update on public.participante_organizacoes
  for each row execute function public.participante_organizacoes_before_write();

-- --------------------------------------------------------------------------
-- 4. Sites e domínios de parceiro (schema only)
-- --------------------------------------------------------------------------
create table if not exists public.parceiro_sites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  organizacao_parceira_id uuid not null references public.organizacoes_parceiras (id) on delete restrict,
  slug text not null,
  template_codigo text not null default 'institucional_v1',
  status_publicacao text not null default 'RASCUNHO'
    check (status_publicacao in (
      'RASCUNHO', 'AGUARDANDO_APROVACAO', 'PUBLICADO', 'SUSPENSO', 'ARQUIVADO'
    )),
  canal_principal text not null default 'ROTA'
    check (canal_principal in ('ROTA', 'SUBDOMINIO', 'DOMINIO')),
  nome_site text not null default '',
  descricao text not null default '',
  branding jsonb not null default '{}'::jsonb,
  menus jsonb not null default '[]'::jsonb,
  whatsapp_modo text not null default 'EMPRESA'
    check (whatsapp_modo in ('PROPRIO', 'EMPRESA', 'CONFIG')),
  whatsapp text,
  seo jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_usuario_id uuid references public.usuarios (id) on delete set null
);

create unique index if not exists parceiro_sites_slug_empresa_uidx
  on public.parceiro_sites (empresa_id, slug);

-- MVP: no máximo um site ativo (não arquivado) por organização
create unique index if not exists parceiro_sites_org_ativo_uidx
  on public.parceiro_sites (organizacao_parceira_id)
  where ativo = true and status_publicacao <> 'ARQUIVADO';

create index if not exists parceiro_sites_empresa_idx
  on public.parceiro_sites (empresa_id);
create index if not exists parceiro_sites_status_idx
  on public.parceiro_sites (empresa_id, status_publicacao);

drop trigger if exists parceiro_sites_updated_at on public.parceiro_sites;
create trigger parceiro_sites_updated_at
  before update on public.parceiro_sites
  for each row execute function public.set_updated_at();

create or replace function public.parceiro_sites_before_write()
returns trigger
language plpgsql
as $$
declare
  v_org_empresa uuid;
  v_org_status text;
begin
  new.slug := public.normalize_slug_valor(new.slug);
  if new.slug is null then
    raise exception 'Slug do site inválido após normalização';
  end if;

  select empresa_id, status into v_org_empresa, v_org_status
  from public.organizacoes_parceiras
  where id = new.organizacao_parceira_id;

  if v_org_empresa is null then
    raise exception 'Organização parceira inexistente';
  end if;
  if v_org_empresa <> new.empresa_id then
    raise exception 'Site e organização devem pertencer à mesma empresa';
  end if;

  if new.status_publicacao = 'PUBLICADO' and v_org_status <> 'ATIVA' then
    raise exception 'Somente organização ATIVA pode ter site PUBLICADO';
  end if;

  new.nome_site := coalesce(trim(new.nome_site), '');
  new.descricao := coalesce(trim(new.descricao), '');
  new.whatsapp := nullif(trim(coalesce(new.whatsapp, '')), '');
  if new.branding is null then new.branding := '{}'::jsonb; end if;
  if new.menus is null then new.menus := '[]'::jsonb; end if;
  if new.seo is null then new.seo := '{}'::jsonb; end if;
  return new;
end;
$$;

drop trigger if exists parceiro_sites_normalize on public.parceiro_sites;
create trigger parceiro_sites_normalize
  before insert or update on public.parceiro_sites
  for each row execute function public.parceiro_sites_before_write();

create table if not exists public.parceiro_site_dominios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  parceiro_site_id uuid not null references public.parceiro_sites (id) on delete restrict,
  valor text not null,
  tipo text not null check (tipo in ('DOMINIO_PROPRIO', 'SUBDOMINIO_EMPRESA', 'ALIAS')),
  principal boolean not null default false,
  verificado boolean not null default false,
  status text not null default 'PENDENTE_DNS'
    check (status in (
      'PENDENTE_DNS', 'VERIFICANDO', 'ATIVO', 'ERRO', 'SUSPENSO', 'REMOVIDO'
    )),
  ssl_status text not null default 'PENDING'
    check (ssl_status in ('PENDING', 'READY', 'ERROR')),
  dns_instrucoes jsonb not null default '{}'::jsonb,
  ultima_verificacao_em timestamptz,
  ultima_mensagem_erro text,
  vercel_domain_id text,
  vercel_project_id text,
  canonical_redirect boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_usuario_id uuid references public.usuarios (id) on delete set null,
  constraint parceiro_site_dominios_valor_chk check (
    valor = lower(valor)
    and valor not like 'www.%'
    and valor !~ ':'
    and valor !~ '/'
    and valor !~ '\*'
    and valor <> ''
    and char_length(valor) <= 253
  )
);

-- Unicidade global de host (exceto REMOVIDO)
create unique index if not exists parceiro_site_dominios_valor_uidx
  on public.parceiro_site_dominios (valor)
  where status <> 'REMOVIDO';

create unique index if not exists parceiro_site_dominios_principal_uidx
  on public.parceiro_site_dominios (parceiro_site_id)
  where principal = true and status <> 'REMOVIDO';

create index if not exists parceiro_site_dominios_empresa_idx
  on public.parceiro_site_dominios (empresa_id);
create index if not exists parceiro_site_dominios_site_idx
  on public.parceiro_site_dominios (parceiro_site_id);

drop trigger if exists parceiro_site_dominios_updated_at on public.parceiro_site_dominios;
create trigger parceiro_site_dominios_updated_at
  before update on public.parceiro_site_dominios
  for each row execute function public.set_updated_at();

create or replace function public.parceiro_site_dominios_before_write()
returns trigger
language plpgsql
as $$
declare
  v text;
  v_site_empresa uuid;
begin
  v := public.normalize_parceiro_site_dominio_valor(new.valor);
  if v is null or v = '' then
    raise exception 'parceiro_site_dominios.valor inválido após normalização';
  end if;
  if v in ('localhost', '127.0.0.1', '0.0.0.0', '::1') or v like '%.localhost' then
    raise exception 'parceiro_site_dominios.valor não pode ser localhost';
  end if;
  if v ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' then
    raise exception 'parceiro_site_dominios.valor não pode ser IP';
  end if;
  if position('*' in v) > 0 then
    raise exception 'Wildcard não permitido em domínio de parceiro';
  end if;
  -- Deny-list hosts oficiais Gauchinho
  if v in ('gauchinhoconsorcios.com.br') then
    raise exception 'Host oficial da empresa não pode ser cadastrado como domínio de parceiro';
  end if;

  -- Conflito com empresa_dominios ativos
  if exists (
    select 1 from public.empresa_dominios ed
    where ed.valor = v and ed.ativo = true
  ) then
    raise exception 'Host já cadastrado em empresa_dominios (tenant)';
  end if;

  select empresa_id into v_site_empresa
  from public.parceiro_sites where id = new.parceiro_site_id;
  if v_site_empresa is null then
    raise exception 'Site de parceiro inexistente';
  end if;
  if v_site_empresa <> new.empresa_id then
    raise exception 'Domínio e site devem pertencer à mesma empresa';
  end if;

  new.valor := v;
  if new.dns_instrucoes is null then
    new.dns_instrucoes := '{}'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists parceiro_site_dominios_normalize on public.parceiro_site_dominios;
create trigger parceiro_site_dominios_normalize
  before insert or update on public.parceiro_site_dominios
  for each row execute function public.parceiro_site_dominios_before_write();

-- Impede que empresa_dominios grave host já usado por parceiro
create or replace function public.empresa_dominios_reject_parceiro_conflict()
returns trigger
language plpgsql
as $$
declare
  v text;
begin
  v := public.normalize_empresa_dominio_valor(new.valor);
  if v is not null and exists (
    select 1 from public.parceiro_site_dominios d
    where d.valor = v and d.status <> 'REMOVIDO'
  ) then
    raise exception 'Host já cadastrado em parceiro_site_dominios';
  end if;
  return new;
end;
$$;

drop trigger if exists empresa_dominios_reject_parceiro on public.empresa_dominios;
create trigger empresa_dominios_reject_parceiro
  before insert or update of valor on public.empresa_dominios
  for each row execute function public.empresa_dominios_reject_parceiro_conflict();

create table if not exists public.parceiro_site_auditoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  parceiro_site_id uuid references public.parceiro_sites (id) on delete set null,
  dominio_id uuid references public.parceiro_site_dominios (id) on delete set null,
  acao text not null check (acao in (
    'CRIAR_SITE', 'ATUALIZAR_SITE', 'PUBLICAR', 'SUSPENDER', 'ARQUIVAR',
    'CRIAR_DOMINIO', 'VERIFICAR', 'SET_PRINCIPAL', 'SYNC_VERCEL', 'REMOVER_DOMINIO', 'ERRO'
  )),
  actor_usuario_id uuid references public.usuarios (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists parceiro_site_auditoria_site_idx
  on public.parceiro_site_auditoria (parceiro_site_id, created_at desc);
create index if not exists parceiro_site_auditoria_empresa_idx
  on public.parceiro_site_auditoria (empresa_id, created_at desc);

-- --------------------------------------------------------------------------
-- 5. Colunas estruturais em leads / propostas (nullable, sem backfill)
-- --------------------------------------------------------------------------
alter table public.leads
  add column if not exists empresa_id uuid references public.empresas (id) on delete set null,
  add column if not exists organizacao_parceira_id uuid references public.organizacoes_parceiras (id) on delete set null,
  add column if not exists parceiro_site_id uuid references public.parceiro_sites (id) on delete set null,
  add column if not exists participant_id uuid references public.participantes_comerciais (id) on delete set null,
  add column if not exists host_origem text,
  add column if not exists pagina_origem text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

alter table public.propostas
  add column if not exists empresa_id uuid references public.empresas (id) on delete set null,
  add column if not exists organizacao_parceira_id uuid references public.organizacoes_parceiras (id) on delete set null,
  add column if not exists parceiro_site_id uuid references public.parceiro_sites (id) on delete set null,
  add column if not exists participant_id uuid references public.participantes_comerciais (id) on delete set null,
  add column if not exists host_origem text,
  add column if not exists pagina_origem text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

create index if not exists leads_empresa_id_partial_idx
  on public.leads (empresa_id) where empresa_id is not null;
create index if not exists leads_org_parceira_partial_idx
  on public.leads (organizacao_parceira_id) where organizacao_parceira_id is not null;
create index if not exists leads_participant_partial_idx
  on public.leads (participant_id) where participant_id is not null;
create index if not exists leads_parceiro_site_partial_idx
  on public.leads (parceiro_site_id) where parceiro_site_id is not null;

create index if not exists propostas_empresa_id_partial_idx
  on public.propostas (empresa_id) where empresa_id is not null;
create index if not exists propostas_org_parceira_partial_idx
  on public.propostas (organizacao_parceira_id) where organizacao_parceira_id is not null;
create index if not exists propostas_participant_partial_idx
  on public.propostas (participant_id) where participant_id is not null;
create index if not exists propostas_parceiro_site_partial_idx
  on public.propostas (parceiro_site_id) where parceiro_site_id is not null;

-- NOTA: policies novas de leads/propostas para área parceiro NÃO são criadas
-- nesta migration para não arriscar o CRM legado (leads_staff / propostas_staff).
-- Serão propostas em migration posterior da mesma Fase 3, com testes negativos.

-- --------------------------------------------------------------------------
-- 6. Papéis e permissões
-- --------------------------------------------------------------------------
insert into public.papeis (empresa_id, codigo, nome, descricao, escopo)
values (
  null,
  'parceiro_comercial',
  'Parceiro Comercial',
  'Acesso à área comercial restrita da organização parceira (leads/propostas do próprio escopo). Não edita site, domínio, DNS nem branding.',
  'COMPANY'
)
on conflict (codigo) where empresa_id is null do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  escopo = excluded.escopo,
  ativo = true;

insert into public.permissoes (codigo, nome, modulo, descricao)
values
  ('gerenciar_participantes', 'Gerenciar Participantes Comerciais', 'participantes', 'CRUD de participantes comerciais da empresa'),
  ('gerenciar_organizacoes_parceiras', 'Gerenciar Organizações Parceiras', 'parceiros', 'CRUD de organizações parceiras da empresa'),
  ('gerenciar_sites_parceiros', 'Gerenciar Sites de Parceiros', 'parceiros', 'Editor de site, branding, menus, domínio, DNS e publicação de sites de parceiros'),
  ('acessar_area_parceiro', 'Acessar Área Comercial do Parceiro', 'parceiros', 'Acesso à área comercial restrita do parceiro'),
  ('visualizar_leads_parceiro', 'Visualizar Leads do Parceiro', 'parceiros', 'Visualizar leads no escopo da organização'),
  ('criar_leads_parceiro', 'Criar Leads do Parceiro', 'parceiros', 'Criar leads no escopo da organização'),
  ('editar_leads_parceiro', 'Editar Leads do Parceiro', 'parceiros', 'Editar leads no escopo da organização'),
  ('visualizar_propostas_parceiro', 'Visualizar Propostas do Parceiro', 'parceiros', 'Visualizar propostas no escopo da organização'),
  ('criar_propostas_parceiro', 'Criar Propostas do Parceiro', 'parceiros', 'Criar propostas no escopo da organização'),
  ('editar_propostas_parceiro', 'Editar Propostas do Parceiro', 'parceiros', 'Editar propostas em RASCUNHO no escopo da organização')
on conflict (codigo) do update set
  nome = excluded.nome,
  modulo = excluded.modulo,
  descricao = excluded.descricao;

do $$
declare
  v_role_super uuid;
  v_role_admin uuid;
  v_role_parceiro uuid;
  v_role_imob uuid;
  v_perm record;
begin
  select id into v_role_super from public.papeis where codigo = 'super_admin' and empresa_id is null;
  select id into v_role_admin from public.papeis where codigo = 'admin_empresa' and empresa_id is null;
  select id into v_role_parceiro from public.papeis where codigo = 'parceiro_comercial' and empresa_id is null;
  select id into v_role_imob from public.papeis where codigo = 'parceiro_imobiliaria' and empresa_id is null;

  if v_role_imob is null then
    raise exception 'Papel parceiro_imobiliaria ausente — abortando';
  end if;

  for v_perm in
    select id, codigo from public.permissoes
    where codigo in (
      'gerenciar_participantes',
      'gerenciar_organizacoes_parceiras',
      'gerenciar_sites_parceiros',
      'acessar_area_parceiro',
      'visualizar_leads_parceiro',
      'criar_leads_parceiro',
      'editar_leads_parceiro',
      'visualizar_propostas_parceiro',
      'criar_propostas_parceiro',
      'editar_propostas_parceiro'
    )
  loop
    -- SuperAdmin: todas
    insert into public.papel_permissoes (papel_id, permissao_id)
    values (v_role_super, v_perm.id) on conflict do nothing;

    -- Admin empresa: todas as de gestão + área (admin usa admin CRM, mas pode ter)
    insert into public.papel_permissoes (papel_id, permissao_id)
    values (v_role_admin, v_perm.id) on conflict do nothing;

    -- parceiro_comercial: SOMENTE área comercial (NUNCA gerenciar_sites_parceiros / orgs / participantes)
    if v_perm.codigo in (
      'acessar_area_parceiro',
      'visualizar_leads_parceiro',
      'criar_leads_parceiro',
      'editar_leads_parceiro',
      'visualizar_propostas_parceiro',
      'criar_propostas_parceiro',
      'editar_propostas_parceiro'
    ) then
      insert into public.papel_permissoes (papel_id, permissao_id)
      values (v_role_parceiro, v_perm.id) on conflict do nothing;
    end if;
  end loop;

  -- Garantia explícita: parceiro_comercial NÃO tem gerenciar_sites_parceiros
  delete from public.papel_permissoes pp
  using public.permissoes perm
  where pp.papel_id = v_role_parceiro
    and pp.permissao_id = perm.id
    and perm.codigo in (
      'gerenciar_sites_parceiros',
      'gerenciar_organizacoes_parceiras',
      'gerenciar_participantes',
      'gerenciar_site_empresa',
      'gerenciar_empresas_plataforma',
      'gerenciar_empresa_atual',
      'gerenciar_usuarios',
      'gerenciar_configuracoes'
    );
end $$;

-- --------------------------------------------------------------------------
-- 7. Helpers de contexto / isolamento
-- --------------------------------------------------------------------------
create or replace function public.current_participante_id(p_empresa_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.participantes_comerciais p
  where p.empresa_id = p_empresa_id
    and p.usuario_id = public.current_usuario_id()
    and p.status = 'ATIVO'
  limit 1;
$$;

revoke all on function public.current_participante_id(uuid) from public;
grant execute on function public.current_participante_id(uuid) to authenticated, service_role;

create or replace function public.participante_organizacoes_ativas(p_empresa_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select po.organizacao_parceira_id
  from public.participante_organizacoes po
  join public.organizacoes_parceiras o on o.id = po.organizacao_parceira_id
  where po.empresa_id = p_empresa_id
    and po.participante_id = public.current_participante_id(p_empresa_id)
    and po.ativo = true
    and o.status = 'ATIVA'
    and (po.fim_vigencia is null or po.fim_vigencia >= current_date);
$$;

revoke all on function public.participante_organizacoes_ativas(uuid) from public;
grant execute on function public.participante_organizacoes_ativas(uuid) to authenticated, service_role;

create or replace function public.has_organizacao_acesso(p_empresa_id uuid, p_organizacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_superadmin()
    or public.has_company_permission(p_empresa_id, 'gerenciar_organizacoes_parceiras')
    or public.has_company_permission(p_empresa_id, 'gerenciar_participantes')
    or exists (
      select 1
      from public.participante_organizacoes_ativas(p_empresa_id) org_id
      where org_id = p_organizacao_id
    );
$$;

revoke all on function public.has_organizacao_acesso(uuid, uuid) from public;
grant execute on function public.has_organizacao_acesso(uuid, uuid) to authenticated, service_role;

create or replace function public.is_responsavel_principal_org(p_empresa_id uuid, p_organizacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participante_organizacoes po
    where po.empresa_id = p_empresa_id
      and po.organizacao_parceira_id = p_organizacao_id
      and po.participante_id = public.current_participante_id(p_empresa_id)
      and po.ativo = true
      and po.responsavel_principal = true
  );
$$;

revoke all on function public.is_responsavel_principal_org(uuid, uuid) from public;
grant execute on function public.is_responsavel_principal_org(uuid, uuid) to authenticated, service_role;

create or replace function public.assert_same_empresa_parceiro(
  p_empresa_id uuid,
  p_participante_id uuid,
  p_organizacao_id uuid,
  p_site_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ok boolean := true;
begin
  if p_participante_id is not null then
    v_ok := v_ok and exists (
      select 1 from public.participantes_comerciais
      where id = p_participante_id and empresa_id = p_empresa_id
    );
  end if;
  if p_organizacao_id is not null then
    v_ok := v_ok and exists (
      select 1 from public.organizacoes_parceiras
      where id = p_organizacao_id and empresa_id = p_empresa_id
    );
  end if;
  if p_site_id is not null then
    v_ok := v_ok and exists (
      select 1 from public.parceiro_sites
      where id = p_site_id and empresa_id = p_empresa_id
        and (p_organizacao_id is null or organizacao_parceira_id = p_organizacao_id)
    );
  end if;
  return v_ok;
end;
$$;

revoke all on function public.assert_same_empresa_parceiro(uuid, uuid, uuid, uuid) from public;
grant execute on function public.assert_same_empresa_parceiro(uuid, uuid, uuid, uuid) to authenticated, service_role;

-- --------------------------------------------------------------------------
-- 8. Grants + RLS (tabelas novas apenas)
-- --------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated;

    grant select, insert, update, delete on table
      public.participante_tipo_catalogo,
      public.participantes_comerciais,
      public.participante_tipos,
      public.participante_auditoria,
      public.organizacoes_parceiras,
      public.participante_organizacoes,
      public.parceiro_sites,
      public.parceiro_site_dominios,
      public.parceiro_site_auditoria
    to authenticated;

    grant all on table
      public.participante_tipo_catalogo,
      public.participantes_comerciais,
      public.participante_tipos,
      public.participante_auditoria,
      public.organizacoes_parceiras,
      public.participante_organizacoes,
      public.parceiro_sites,
      public.parceiro_site_dominios,
      public.parceiro_site_auditoria
    to service_role;

    revoke all on table
      public.participante_tipo_catalogo,
      public.participantes_comerciais,
      public.participante_tipos,
      public.participante_auditoria,
      public.organizacoes_parceiras,
      public.participante_organizacoes,
      public.parceiro_sites,
      public.parceiro_site_dominios,
      public.parceiro_site_auditoria
    from anon;
  end if;
end $$;

alter table public.participante_tipo_catalogo enable row level security;
alter table public.participantes_comerciais enable row level security;
alter table public.participante_tipos enable row level security;
alter table public.participante_auditoria enable row level security;
alter table public.organizacoes_parceiras enable row level security;
alter table public.participante_organizacoes enable row level security;
alter table public.parceiro_sites enable row level security;
alter table public.parceiro_site_dominios enable row level security;
alter table public.parceiro_site_auditoria enable row level security;

-- Catálogo: leitura autenticada; escrita superadmin
drop policy if exists participante_tipo_catalogo_select on public.participante_tipo_catalogo;
create policy participante_tipo_catalogo_select on public.participante_tipo_catalogo
  for select to authenticated using (true);

drop policy if exists participante_tipo_catalogo_write on public.participante_tipo_catalogo;
create policy participante_tipo_catalogo_write on public.participante_tipo_catalogo
  for all to authenticated
  using (public.is_platform_superadmin())
  with check (public.is_platform_superadmin());

-- Participantes
drop policy if exists participantes_comerciais_select on public.participantes_comerciais;
create policy participantes_comerciais_select on public.participantes_comerciais
  for select to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_participantes')
    or (
      public.is_company_member(empresa_id)
      and usuario_id = public.current_usuario_id()
    )
    or (
      -- Responsável da org enxerga participantes vinculados às orgs ativas dele
      public.is_company_member(empresa_id)
      and exists (
        select 1
        from public.participante_organizacoes po_alvo
        where po_alvo.participante_id = participantes_comerciais.id
          and po_alvo.empresa_id = participantes_comerciais.empresa_id
          and po_alvo.ativo = true
          and po_alvo.organizacao_parceira_id in (
            select org_id from public.participante_organizacoes_ativas(participantes_comerciais.empresa_id) as org_id
          )
          and public.is_responsavel_principal_org(
            participantes_comerciais.empresa_id,
            po_alvo.organizacao_parceira_id
          )
      )
    )
  );

drop policy if exists participantes_comerciais_write on public.participantes_comerciais;
create policy participantes_comerciais_write on public.participantes_comerciais
  for all to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_participantes')
  )
  with check (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_participantes')
  );

drop policy if exists participante_tipos_select on public.participante_tipos;
create policy participante_tipos_select on public.participante_tipos
  for select to authenticated
  using (
    public.is_platform_superadmin()
    or public.is_company_member(empresa_id)
  );

drop policy if exists participante_tipos_write on public.participante_tipos;
create policy participante_tipos_write on public.participante_tipos
  for all to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_participantes')
  )
  with check (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_participantes')
  );

drop policy if exists participante_auditoria_select on public.participante_auditoria;
create policy participante_auditoria_select on public.participante_auditoria
  for select to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_participantes')
  );

drop policy if exists participante_auditoria_insert on public.participante_auditoria;
create policy participante_auditoria_insert on public.participante_auditoria
  for insert to authenticated
  with check (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_participantes')
  );

-- Organizações
drop policy if exists organizacoes_parceiras_select on public.organizacoes_parceiras;
create policy organizacoes_parceiras_select on public.organizacoes_parceiras
  for select to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_organizacoes_parceiras')
    or public.has_organizacao_acesso(empresa_id, id)
  );

drop policy if exists organizacoes_parceiras_write on public.organizacoes_parceiras;
create policy organizacoes_parceiras_write on public.organizacoes_parceiras
  for all to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_organizacoes_parceiras')
  )
  with check (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_organizacoes_parceiras')
  );

drop policy if exists participante_organizacoes_select on public.participante_organizacoes;
create policy participante_organizacoes_select on public.participante_organizacoes
  for select to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_organizacoes_parceiras')
    or public.has_company_permission(empresa_id, 'gerenciar_participantes')
    or public.has_organizacao_acesso(empresa_id, organizacao_parceira_id)
  );

drop policy if exists participante_organizacoes_write on public.participante_organizacoes;
create policy participante_organizacoes_write on public.participante_organizacoes
  for all to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_organizacoes_parceiras')
    or public.has_company_permission(empresa_id, 'gerenciar_participantes')
  )
  with check (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_organizacoes_parceiras')
    or public.has_company_permission(empresa_id, 'gerenciar_participantes')
  );

-- Sites / domínios: leitura membros; escrita só gerenciar_sites_parceiros
-- parceiro_comercial NÃO recebe gerenciar_sites_parceiros
drop policy if exists parceiro_sites_select on public.parceiro_sites;
create policy parceiro_sites_select on public.parceiro_sites
  for select to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_sites_parceiros')
    or (
      public.is_company_member(empresa_id)
      and public.has_organizacao_acesso(empresa_id, organizacao_parceira_id)
    )
  );

drop policy if exists parceiro_sites_write on public.parceiro_sites;
create policy parceiro_sites_write on public.parceiro_sites
  for all to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_sites_parceiros')
  )
  with check (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_sites_parceiros')
  );

drop policy if exists parceiro_site_dominios_select on public.parceiro_site_dominios;
create policy parceiro_site_dominios_select on public.parceiro_site_dominios
  for select to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_sites_parceiros')
  );

drop policy if exists parceiro_site_dominios_write on public.parceiro_site_dominios;
create policy parceiro_site_dominios_write on public.parceiro_site_dominios
  for all to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_sites_parceiros')
  )
  with check (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_sites_parceiros')
  );

drop policy if exists parceiro_site_auditoria_select on public.parceiro_site_auditoria;
create policy parceiro_site_auditoria_select on public.parceiro_site_auditoria
  for select to authenticated
  using (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_sites_parceiros')
  );

drop policy if exists parceiro_site_auditoria_insert on public.parceiro_site_auditoria;
create policy parceiro_site_auditoria_insert on public.parceiro_site_auditoria
  for insert to authenticated
  with check (
    public.is_platform_superadmin()
    or public.has_company_permission(empresa_id, 'gerenciar_sites_parceiros')
  );

commit;

-- Matriz papel → permissão (documental; aplicada no seed acima):
-- super_admin: todas as permissões novas
-- admin_empresa: todas as permissões novas
-- parceiro_comercial: acessar_area_parceiro + visualizar/criar/editar leads/propostas_parceiro
-- parceiro_comercial: NÃO recebe gerenciar_sites_parceiros / orgs / participantes / site_empresa
-- parceiro_imobiliaria: inalterado (legado preservado)
