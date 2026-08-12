-- 072: participantes comerciais na venda e repartição opcional da comissão.
-- Forward-only. Não altera regras, previsões ou liquidações já existentes (060–063).

begin;

insert into public.participante_tipo_catalogo (codigo, nome, ativo) values
  ('SDR', 'SDR', true),
  ('MICROFRANQUIA', 'Microfranquia', true),
  ('PARCEIRO', 'Parceiro', true)
on conflict (codigo) do update set nome = excluded.nome, ativo = true;

create table if not exists public.microfranquia_participantes_comissao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  microfranquia_participante_id uuid not null references public.participantes_comerciais(id) on delete restrict,
  participante_secundario_id uuid not null references public.participantes_comerciais(id) on delete restrict,
  fracao_percentual numeric(7,4) not null check (fracao_percentual > 0 and fracao_percentual < 100),
  ativo boolean not null default true,
  inicio_vigencia date not null default current_date,
  fim_vigencia date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (microfranquia_participante_id <> participante_secundario_id),
  check (fim_vigencia is null or fim_vigencia >= inicio_vigencia)
);

create unique index if not exists microfranquia_participantes_comissao_ativo_uidx
  on public.microfranquia_participantes_comissao (empresa_id, microfranquia_participante_id, participante_secundario_id)
  where ativo and fim_vigencia is null;

create table if not exists public.venda_participantes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  venda_id uuid not null references public.vendas(id) on delete restrict,
  participante_comercial_id uuid not null references public.participantes_comerciais(id) on delete restrict,
  papel text not null check (papel in ('MICROFRANQUIA_PRINCIPAL','PARTICIPANTE_SECUNDARIO')),
  tipo_atuacao text not null check (tipo_atuacao in ('MICROFRANQUIA','SDR','PARCEIRO','CONSULTOR')),
  fracao_comissao_percentual numeric(7,4),
  configuracao_origem_id uuid references public.microfranquia_participantes_comissao(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (papel = 'MICROFRANQUIA_PRINCIPAL' and tipo_atuacao = 'MICROFRANQUIA' and fracao_comissao_percentual is null)
    or
    (papel = 'PARTICIPANTE_SECUNDARIO' and tipo_atuacao in ('SDR','PARCEIRO','CONSULTOR') and fracao_comissao_percentual > 0 and fracao_comissao_percentual < 100)
  )
);

create unique index if not exists venda_participantes_principal_uidx
  on public.venda_participantes (venda_id) where papel = 'MICROFRANQUIA_PRINCIPAL';
create unique index if not exists venda_participantes_secundario_uidx
  on public.venda_participantes (venda_id) where papel = 'PARTICIPANTE_SECUNDARIO';
create index if not exists venda_participantes_empresa_venda_idx on public.venda_participantes (empresa_id, venda_id);

create or replace function public.venda_participantes_before_write()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_participante_empresa uuid; v_venda_empresa uuid; v_tem_tipo boolean;
begin
  select empresa_id into v_participante_empresa from public.participantes_comerciais where id = new.participante_comercial_id;
  select empresa_id into v_venda_empresa from public.vendas where id = new.venda_id;
  if v_participante_empresa is null or v_venda_empresa is null or v_participante_empresa <> v_venda_empresa then
    raise exception 'Participante e venda devem pertencer ao mesmo tenant';
  end if;
  new.empresa_id := v_venda_empresa;
  select exists(
    select 1 from public.participante_tipos pt
    where pt.participante_id = new.participante_comercial_id and pt.empresa_id = new.empresa_id
      and pt.tipo_codigo = new.tipo_atuacao
  ) into v_tem_tipo;
  if not v_tem_tipo then raise exception 'Participante não possui a atuação comercial selecionada'; end if;
  return new;
end $$;

drop trigger if exists venda_participantes_tenant_integrity on public.venda_participantes;
create trigger venda_participantes_tenant_integrity before insert or update on public.venda_participantes
for each row execute function public.venda_participantes_before_write();

drop trigger if exists microfranquia_participantes_comissao_tenant_integrity on public.microfranquia_participantes_comissao;
create or replace function public.microfranquia_participantes_comissao_before_write()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_micro_empresa uuid; v_secundario_empresa uuid; v_micro_ok boolean; v_secundario_ok boolean;
begin
  select empresa_id into v_micro_empresa from public.participantes_comerciais where id = new.microfranquia_participante_id;
  select empresa_id into v_secundario_empresa from public.participantes_comerciais where id = new.participante_secundario_id;
  if v_micro_empresa is null or v_micro_empresa <> v_secundario_empresa then
    raise exception 'Microfranquia e participante secundário devem pertencer ao mesmo tenant';
  end if;
  new.empresa_id := v_micro_empresa;
  select exists(select 1 from public.participante_tipos where participante_id = new.microfranquia_participante_id and empresa_id = new.empresa_id and tipo_codigo = 'MICROFRANQUIA') into v_micro_ok;
  select exists(select 1 from public.participante_tipos where participante_id = new.participante_secundario_id and empresa_id = new.empresa_id and tipo_codigo in ('SDR','PARCEIRO','CONSULTOR')) into v_secundario_ok;
  if not v_micro_ok then raise exception 'O participante principal precisa ter atuação MICROFRANQUIA'; end if;
  if not v_secundario_ok then raise exception 'O secundário precisa ter atuação SDR, PARCEIRO ou CONSULTOR'; end if;
  return new;
end $$;
create trigger microfranquia_participantes_comissao_tenant_integrity before insert or update on public.microfranquia_participantes_comissao
for each row execute function public.microfranquia_participantes_comissao_before_write();

alter table public.microfranquia_participantes_comissao enable row level security;
alter table public.venda_participantes enable row level security;

create policy microfranquia_participantes_comissao_select on public.microfranquia_participantes_comissao
  for select to authenticated using (public.can_read_tenant_internal(empresa_id));
create policy microfranquia_participantes_comissao_insert on public.microfranquia_participantes_comissao
  for insert to authenticated with check (public.can_write_tenant_internal(empresa_id));
create policy microfranquia_participantes_comissao_update on public.microfranquia_participantes_comissao
  for update to authenticated using (public.can_write_tenant_internal(empresa_id)) with check (public.can_write_tenant_internal(empresa_id));
create policy microfranquia_participantes_comissao_delete on public.microfranquia_participantes_comissao
  for delete to authenticated using (public.can_write_tenant_internal(empresa_id));
create policy venda_participantes_select on public.venda_participantes
  for select to authenticated using (public.can_read_tenant_internal(empresa_id));
create policy venda_participantes_insert on public.venda_participantes
  for insert to authenticated with check (public.can_write_tenant_internal(empresa_id));
create policy venda_participantes_update on public.venda_participantes
  for update to authenticated using (public.can_write_tenant_internal(empresa_id)) with check (public.can_write_tenant_internal(empresa_id));
create policy venda_participantes_delete on public.venda_participantes
  for delete to authenticated using (public.can_write_tenant_internal(empresa_id));

commit;
