-- 075: contas a pagar, bancos, centros de custo, caixa e conciliação entre sócios.
-- Forward-only. O caixa continua append-only: baixa gera lançamento, nunca o altera.
begin;

create table public.financeiro_contas_bancarias (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete restrict,
  nome text not null, banco text, agencia text, conta_mascarada text, ativo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(empresa_id,nome)
);
create table public.financeiro_centros_custo (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete restrict,
  nome text not null, codigo text, ativo boolean not null default true, created_at timestamptz not null default now(),
  unique(empresa_id,nome)
);
create table public.financeiro_contas_pagar (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete restrict,
  descricao text not null check(length(trim(descricao)) > 0), fornecedor text, centro_custo_id uuid references public.financeiro_centros_custo(id) on delete restrict,
  conta_bancaria_id uuid references public.financeiro_contas_bancarias(id) on delete restrict,
  vencimento date not null, competencia varchar(7) not null, valor numeric(15,2) not null check(valor > 0),
  status text not null default 'aberta' check(status in('aberta','paga','cancelada')),
  pago_em date, pago_pessoalmente boolean not null default false,
  socio_pagador_usuario_id uuid references public.usuarios(id) on delete restrict,
  observacao text, caixa_movimento_id uuid references public.caixa_movimentos(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((pago_pessoalmente = false and socio_pagador_usuario_id is null) or (pago_pessoalmente = true and socio_pagador_usuario_id is not null))
);
create index financeiro_contas_pagar_empresa_vencimento_idx on public.financeiro_contas_pagar(empresa_id,status,vencimento);

alter table public.caixa_movimentos drop constraint if exists caixa_movimentos_origem_tipo_check;
alter table public.caixa_movimentos add constraint caixa_movimentos_origem_tipo_check check(origem_tipo in ('recebimento_administradora','pagamento_participante','estorno_recebimento','estorno_pagamento','ajuste_caixa','conta_pagar'));

create or replace function public.rpc_baixar_conta_pagar(p_empresa_id uuid,p_conta_id uuid,p_data date default current_date)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v public.financeiro_contas_pagar%rowtype; v_caixa uuid;
begin
  if auth.uid() is not null and not public.can_write_tenant_internal(p_empresa_id) then raise exception 'Acesso negado ao tenant'; end if;
  select * into v from public.financeiro_contas_pagar where id=p_conta_id and empresa_id=p_empresa_id for update;
  if not found then raise exception 'Conta não encontrada'; end if;
  if v.status='paga' then return jsonb_build_object('id',v.id,'reused',true,'caixa_movimento_id',v.caixa_movimento_id); end if;
  if v.status<>'aberta' then raise exception 'Somente contas abertas podem ser baixadas'; end if;
  if not v.pago_pessoalmente then
    insert into public.caixa_movimentos(empresa_id,tipo_movimento,origem_tipo,origem_id,data_movimento,competencia,valor,descricao)
    values(p_empresa_id,'saida','conta_pagar',v.id,p_data,v.competencia,v.valor,'Conta paga: '||v.descricao) returning id into v_caixa;
  end if;
  update public.financeiro_contas_pagar set status='paga',pago_em=p_data,caixa_movimento_id=v_caixa,updated_at=now() where id=v.id;
  return jsonb_build_object('id',v.id,'reused',false,'caixa_movimento_id',v_caixa);
end $$;

create view public.financeiro_fechamento_socios as
with base as (
  select empresa_id, competencia, socio_pagador_usuario_id usuario_id, sum(valor) total_pago
  from public.financeiro_contas_pagar where status='paga' and pago_pessoalmente group by 1,2,3
), total as (select empresa_id,competencia,sum(total_pago) total,count(*) participantes from base group by 1,2)
select b.empresa_id,b.competencia,b.usuario_id,b.total_pago,t.total,
       round(t.total/nullif(t.participantes,0),2) cota_igual,
       round(b.total_pago-(t.total/nullif(t.participantes,0)),2) saldo_ajuste
from base b join total t using(empresa_id,competencia);

alter table public.financeiro_contas_bancarias enable row level security;
alter table public.financeiro_centros_custo enable row level security;
alter table public.financeiro_contas_pagar enable row level security;
create policy financeiro_bancos_select on public.financeiro_contas_bancarias for select to authenticated using(public.can_read_tenant_internal(empresa_id));
create policy financeiro_bancos_insert on public.financeiro_contas_bancarias for insert to authenticated with check(public.can_write_tenant_internal(empresa_id));
create policy financeiro_bancos_update on public.financeiro_contas_bancarias for update to authenticated using(public.can_write_tenant_internal(empresa_id)) with check(public.can_write_tenant_internal(empresa_id));
create policy financeiro_centros_select on public.financeiro_centros_custo for select to authenticated using(public.can_read_tenant_internal(empresa_id));
create policy financeiro_centros_insert on public.financeiro_centros_custo for insert to authenticated with check(public.can_write_tenant_internal(empresa_id));
create policy financeiro_centros_update on public.financeiro_centros_custo for update to authenticated using(public.can_write_tenant_internal(empresa_id)) with check(public.can_write_tenant_internal(empresa_id));
create policy financeiro_cp_select on public.financeiro_contas_pagar for select to authenticated using(public.can_read_tenant_internal(empresa_id));
create policy financeiro_cp_insert on public.financeiro_contas_pagar for insert to authenticated with check(public.can_write_tenant_internal(empresa_id));
create policy financeiro_cp_update on public.financeiro_contas_pagar for update to authenticated using(public.can_write_tenant_internal(empresa_id)) with check(public.can_write_tenant_internal(empresa_id));
revoke all on function public.rpc_baixar_conta_pagar(uuid,uuid,date) from public,anon;
grant execute on function public.rpc_baixar_conta_pagar(uuid,uuid,date) to authenticated,service_role;
commit;
