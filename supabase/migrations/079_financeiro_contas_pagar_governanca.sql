-- 079: governanca master de contas a pagar, estornos, exclusoes logicas e auditoria detalhada.
-- Forward-only. Nenhum movimento de caixa e alterado ou removido.
begin;

alter table public.financeiro_contas_pagar
  add column if not exists excluida_em timestamptz,
  add column if not exists excluida_por_usuario_id uuid references public.usuarios(id) on delete restrict,
  add column if not exists motivo_exclusao text;

alter table public.caixa_movimentos drop constraint if exists caixa_movimentos_origem_tipo_check;
alter table public.caixa_movimentos add constraint caixa_movimentos_origem_tipo_check
  check (origem_tipo in (
    'recebimento_administradora','pagamento_participante','estorno_recebimento',
    'estorno_pagamento','ajuste_caixa','conta_pagar','estorno_conta_pagar'
  ));

create table public.financeiro_contas_pagar_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  conta_id uuid not null references public.financeiro_contas_pagar(id) on delete restrict,
  usuario_id uuid not null references public.usuarios(id) on delete restrict,
  acao text not null check (acao in ('CRIACAO','ALTERACAO','BAIXA','ESTORNO','EXCLUSAO')),
  fornecedor text,
  descricao text not null,
  valor numeric(15,2) not null,
  motivo text,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index financeiro_cp_logs_empresa_data_idx
  on public.financeiro_contas_pagar_logs(empresa_id,created_at desc);

create or replace function public.is_financeiro_tenant_master(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select public.is_platform_superadmin() or exists (
    select 1
    from public.empresa_usuarios eu
    join public.papeis p on p.id=eu.papel_id
    join public.usuarios u on u.id=eu.usuario_id
    where eu.empresa_id=p_empresa_id
      and eu.usuario_id=public.current_usuario_id()
      and eu.ativo and u.ativo and lower(u.perfil)='master'
      and p.codigo='admin_empresa' and p.escopo='COMPANY' and p.ativo
      and (p.empresa_id is null or p.empresa_id=p_empresa_id)
  )
$$;

create or replace function public.registrar_log_conta_pagar()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_acao text; v_detalhes jsonb := '{}'::jsonb; v_usuario_id uuid := public.current_usuario_id();
begin
  -- Importações administrativas legadas não possuem auth.uid(); não podem
  -- fabricar um autor. As operações master abaixo sempre usam sessão real.
  if v_usuario_id is null then return new; end if;
  if tg_op='INSERT' then v_acao := 'CRIACAO';
  elsif old.status='aberta' and new.status='paga' then v_acao := 'BAIXA';
  else return new;
  end if;
  if tg_op='UPDATE' then
    v_detalhes := jsonb_build_object('status_anterior',old.status,'status_novo',new.status,'pago_em',new.pago_em);
  end if;
  insert into public.financeiro_contas_pagar_logs
    (empresa_id,conta_id,usuario_id,acao,fornecedor,descricao,valor,detalhes)
  values (new.empresa_id,new.id,v_usuario_id,v_acao,new.fornecedor,new.descricao,new.valor,v_detalhes);
  return new;
end $$;
drop trigger if exists trg_financeiro_cp_log_basico on public.financeiro_contas_pagar;
create trigger trg_financeiro_cp_log_basico after insert or update on public.financeiro_contas_pagar
for each row execute function public.registrar_log_conta_pagar();

create or replace function public.rpc_alterar_conta_pagar(
  p_empresa_id uuid,p_conta_id uuid,p_descricao text,p_fornecedor text,p_vencimento date,
  p_valor numeric,p_centro_custo_id uuid,p_conta_bancaria_id uuid,p_observacao text,
  p_pago_pessoalmente boolean,p_socio_pagador_usuario_id uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v public.financeiro_contas_pagar%rowtype; v_campos jsonb := '[]'::jsonb;
begin
  if not public.is_financeiro_tenant_master(p_empresa_id) then raise exception 'Apenas usuário master pode alterar despesas'; end if;
  select * into v from public.financeiro_contas_pagar where id=p_conta_id and empresa_id=p_empresa_id for update;
  if not found or v.status='cancelada' then raise exception 'Despesa ativa não encontrada'; end if;
  if length(trim(coalesce(p_descricao,'')))=0 or p_valor<=0 then raise exception 'Descrição e valor são obrigatórios'; end if;
  if v.status='paga' then
    -- Contas liquidadas preservam os campos que compõem o fato financeiro.
    p_valor := v.valor;
    p_pago_pessoalmente := v.pago_pessoalmente;
    p_socio_pagador_usuario_id := v.socio_pagador_usuario_id;
  end if;
  if p_pago_pessoalmente and p_socio_pagador_usuario_id is null then raise exception 'Informe o sócio pagador'; end if;
  select coalesce(jsonb_agg(k order by k),'[]'::jsonb) into v_campos from jsonb_each(jsonb_build_object(
    'descricao',p_descricao is distinct from v.descricao,'fornecedor',p_fornecedor is distinct from v.fornecedor,
    'vencimento',p_vencimento is distinct from v.vencimento,'valor',p_valor is distinct from v.valor,
    'centro_custo_id',p_centro_custo_id is distinct from v.centro_custo_id,
    'conta_bancaria_id',p_conta_bancaria_id is distinct from v.conta_bancaria_id,
    'observacao',p_observacao is distinct from v.observacao,'pagamento_pessoal',p_pago_pessoalmente is distinct from v.pago_pessoalmente
  )) e(k,val) where (val)::boolean;
  update public.financeiro_contas_pagar set descricao=trim(p_descricao),fornecedor=nullif(trim(p_fornecedor),''),
    vencimento=p_vencimento,competencia=to_char(p_vencimento,'YYYY-MM'),valor=p_valor,
    centro_custo_id=p_centro_custo_id,conta_bancaria_id=p_conta_bancaria_id,observacao=nullif(trim(p_observacao),''),
    pago_pessoalmente=p_pago_pessoalmente,socio_pagador_usuario_id=case when p_pago_pessoalmente then p_socio_pagador_usuario_id end,
    updated_at=now() where id=v.id;
  insert into public.financeiro_contas_pagar_logs(empresa_id,conta_id,usuario_id,acao,fornecedor,descricao,valor,detalhes)
  values(p_empresa_id,v.id,public.current_usuario_id(),'ALTERACAO',nullif(trim(p_fornecedor),''),trim(p_descricao),p_valor,jsonb_build_object('campos_alterados',v_campos));
  return jsonb_build_object('id',v.id);
end $$;

create or replace function public.rpc_estornar_conta_pagar(p_empresa_id uuid,p_conta_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v public.financeiro_contas_pagar%rowtype; v_mov uuid;
begin
  if not public.is_financeiro_tenant_master(p_empresa_id) then raise exception 'Apenas usuário master pode estornar despesas'; end if;
  if length(trim(coalesce(p_motivo,'')))<3 then raise exception 'Informe o motivo do estorno'; end if;
  select * into v from public.financeiro_contas_pagar where id=p_conta_id and empresa_id=p_empresa_id for update;
  if not found or v.status<>'paga' then raise exception 'Somente despesas pagas podem ser estornadas'; end if;
  if not v.pago_pessoalmente then
    insert into public.caixa_movimentos(empresa_id,tipo_movimento,origem_tipo,origem_id,data_movimento,competencia,valor,descricao)
    values(p_empresa_id,'entrada','estorno_conta_pagar',v.id,current_date,to_char(current_date,'YYYY-MM'),v.valor,'Estorno de conta paga: '||v.descricao) returning id into v_mov;
  end if;
  update public.financeiro_contas_pagar set status='aberta',pago_em=null,caixa_movimento_id=null,updated_at=now() where id=v.id;
  insert into public.financeiro_contas_pagar_logs(empresa_id,conta_id,usuario_id,acao,fornecedor,descricao,valor,motivo,detalhes)
  values(p_empresa_id,v.id,public.current_usuario_id(),'ESTORNO',v.fornecedor,v.descricao,v.valor,trim(p_motivo),jsonb_build_object('movimento_estorno_id',v_mov));
  return jsonb_build_object('id',v.id,'movimento_estorno_id',v_mov);
end $$;

create or replace function public.rpc_excluir_conta_pagar(p_empresa_id uuid,p_conta_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v public.financeiro_contas_pagar%rowtype; v_mov uuid;
begin
  if not public.is_financeiro_tenant_master(p_empresa_id) then raise exception 'Apenas usuário master pode excluir despesas'; end if;
  if length(trim(coalesce(p_motivo,'')))<3 then raise exception 'O motivo da exclusão é obrigatório'; end if;
  select * into v from public.financeiro_contas_pagar where id=p_conta_id and empresa_id=p_empresa_id for update;
  if not found or v.status='cancelada' then raise exception 'Despesa ativa não encontrada'; end if;
  if v.status='paga' and not v.pago_pessoalmente then
    insert into public.caixa_movimentos(empresa_id,tipo_movimento,origem_tipo,origem_id,data_movimento,competencia,valor,descricao)
    values(p_empresa_id,'entrada','estorno_conta_pagar',v.id,current_date,to_char(current_date,'YYYY-MM'),v.valor,'Exclusão de conta paga: '||v.descricao) returning id into v_mov;
  end if;
  update public.financeiro_contas_pagar set status='cancelada',excluida_em=now(),excluida_por_usuario_id=public.current_usuario_id(),
    motivo_exclusao=trim(p_motivo),updated_at=now() where id=v.id;
  insert into public.financeiro_contas_pagar_logs(empresa_id,conta_id,usuario_id,acao,fornecedor,descricao,valor,motivo,detalhes)
  values(p_empresa_id,v.id,public.current_usuario_id(),'EXCLUSAO',v.fornecedor,v.descricao,v.valor,trim(p_motivo),jsonb_build_object('status_anterior',v.status,'movimento_estorno_id',v_mov));
  return jsonb_build_object('id',v.id,'movimento_estorno_id',v_mov);
end $$;

alter table public.financeiro_contas_pagar_logs enable row level security;
create policy financeiro_cp_logs_select on public.financeiro_contas_pagar_logs for select to authenticated
  using(public.is_financeiro_tenant_master(empresa_id));

revoke all on function public.is_financeiro_tenant_master(uuid) from public,anon;
revoke all on function public.rpc_alterar_conta_pagar(uuid,uuid,text,text,date,numeric,uuid,uuid,text,boolean,uuid) from public,anon;
revoke all on function public.rpc_estornar_conta_pagar(uuid,uuid,text) from public,anon;
revoke all on function public.rpc_excluir_conta_pagar(uuid,uuid,text) from public,anon;
grant execute on function public.is_financeiro_tenant_master(uuid) to authenticated,service_role;
grant execute on function public.rpc_alterar_conta_pagar(uuid,uuid,text,text,date,numeric,uuid,uuid,text,boolean,uuid) to authenticated,service_role;
grant execute on function public.rpc_estornar_conta_pagar(uuid,uuid,text) to authenticated,service_role;
grant execute on function public.rpc_excluir_conta_pagar(uuid,uuid,text) to authenticated,service_role;
commit;
