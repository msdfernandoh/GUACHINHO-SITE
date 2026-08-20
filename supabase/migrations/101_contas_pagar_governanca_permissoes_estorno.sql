-- 101: Governança de Contas a Pagar, autorização de estorno para consultores/usuários e permissões de exclusão e edição com auditoria.
-- Forward-only, seguro e idempotente.
begin;

alter table public.empresa_usuarios
  add column if not exists pode_estornar_contas boolean not null default false;

-- Helper: verifica se o usuário autenticado é Master / Administrador da empresa ou SuperAdmin
create or replace function public.is_financeiro_tenant_master(p_empresa_id uuid)
returns boolean language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  v_uid uuid := public.current_usuario_id();
  v_is_master boolean := false;
begin
  if public.is_platform_superadmin() then
    return true;
  end if;
  if v_uid is null then
    return false;
  end if;

  select exists (
    select 1
    from public.empresa_usuarios eu
    join public.usuarios u on u.id = eu.usuario_id
    left join public.papeis p on p.id = eu.papel_id
    where eu.empresa_id = p_empresa_id
      and eu.usuario_id = v_uid
      and eu.ativo = true
      and u.ativo = true
      and (
        lower(trim(coalesce(u.perfil, ''))) in ('master', 'admin', 'superadmin')
        or (p.codigo in ('admin_empresa', 'super_admin') and p.ativo = true)
      )
  ) into v_is_master;

  return v_is_master;
end $$;

-- Helper: verifica se o usuário autenticado pode estornar contas pagas
create or replace function public.pode_estornar_conta_pagar(p_empresa_id uuid)
returns boolean language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  v_uid uuid := public.current_usuario_id();
  v_allowed boolean := false;
begin
  if public.is_financeiro_tenant_master(p_empresa_id) then
    return true;
  end if;
  if v_uid is null then
    return false;
  end if;

  select exists (
    select 1
    from public.empresa_usuarios eu
    join public.usuarios u on u.id = eu.usuario_id
    where eu.empresa_id = p_empresa_id
      and eu.usuario_id = v_uid
      and eu.ativo = true
      and u.ativo = true
      and eu.pode_estornar_contas = true
  ) into v_allowed;

  return v_allowed;
end $$;

-- RPC: Alterar Conta a Pagar
create or replace function public.rpc_alterar_conta_pagar(
  p_empresa_id uuid,
  p_conta_id uuid,
  p_descricao text,
  p_fornecedor text,
  p_vencimento date,
  p_valor numeric,
  p_centro_custo_id uuid,
  p_conta_bancaria_id uuid,
  p_observacao text,
  p_pago_pessoalmente boolean,
  p_socio_pagador_usuario_id uuid
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v public.financeiro_contas_pagar%rowtype;
  v_campos jsonb := '[]'::jsonb;
  v_is_master boolean;
  v_valor_final numeric;
  v_pessoal_final boolean;
  v_socio_final uuid;
begin
  if auth.uid() is not null and not public.can_write_tenant_internal(p_empresa_id) then
    raise exception 'Você não tem permissão para alterar despesas nesta empresa';
  end if;

  v_is_master := public.is_financeiro_tenant_master(p_empresa_id);

  select * into v from public.financeiro_contas_pagar
  where id = p_conta_id and empresa_id = p_empresa_id for update;

  if not found or v.status = 'cancelada' then
    raise exception 'Despesa ativa não encontrada';
  end if;

  if length(trim(coalesce(p_descricao, ''))) = 0 then
    raise exception 'A descrição é obrigatória';
  end if;

  if p_vencimento is null then
    raise exception 'A data de vencimento é obrigatória';
  end if;

  v_valor_final := p_valor;
  v_pessoal_final := p_pago_pessoalmente;
  v_socio_final := p_socio_pagador_usuario_id;

  if v.status = 'paga' and not v_is_master then
    -- Se a conta já está paga e o usuário não é master, preserva o fato financeiro
    v_valor_final := v.valor;
    v_pessoal_final := v.pago_pessoalmente;
    v_socio_final := v.socio_pagador_usuario_id;
  else
    if v_valor_final <= 0 then
      raise exception 'O valor deve ser maior que zero';
    end if;
  end if;

  if v_pessoal_final and v_socio_final is null then
    raise exception 'Informe o sócio pagador';
  end if;

  select coalesce(jsonb_agg(k order by k), '[]'::jsonb) into v_campos
  from jsonb_each(jsonb_build_object(
    'descricao', p_descricao is distinct from v.descricao,
    'fornecedor', p_fornecedor is distinct from v.fornecedor,
    'vencimento', p_vencimento is distinct from v.vencimento,
    'valor', v_valor_final is distinct from v.valor,
    'centro_custo_id', p_centro_custo_id is distinct from v.centro_custo_id,
    'conta_bancaria_id', p_conta_bancaria_id is distinct from v.conta_bancaria_id,
    'observacao', p_observacao is distinct from v.observacao,
    'pagamento_pessoal', v_pessoal_final is distinct from v.pago_pessoalmente,
    'socio_pagador', v_socio_final is distinct from v.socio_pagador_usuario_id
  )) e(k, val) where (val)::boolean;

  update public.financeiro_contas_pagar
  set descricao = trim(p_descricao),
      fornecedor = nullif(trim(coalesce(p_fornecedor, '')), ''),
      vencimento = p_vencimento,
      competencia = to_char(p_vencimento, 'YYYY-MM'),
      valor = v_valor_final,
      centro_custo_id = p_centro_custo_id,
      conta_bancaria_id = p_conta_bancaria_id,
      observacao = nullif(trim(coalesce(p_observacao, '')), ''),
      pago_pessoalmente = v_pessoal_final,
      socio_pagador_usuario_id = case when v_pessoal_final then v_socio_final else null end,
      updated_at = now()
  where id = v.id;

  insert into public.financeiro_contas_pagar_logs(
    empresa_id, conta_id, usuario_id, acao, fornecedor, descricao, valor, detalhes
  ) values (
    p_empresa_id,
    v.id,
    coalesce(public.current_usuario_id(), v.socio_pagador_usuario_id),
    'ALTERACAO',
    nullif(trim(coalesce(p_fornecedor, '')), ''),
    trim(p_descricao),
    v_valor_final,
    jsonb_build_object('campos_alterados', v_campos, 'status', v.status)
  );

  return jsonb_build_object('id', v.id);
end $$;

-- RPC: Estornar Conta Paga
create or replace function public.rpc_estornar_conta_pagar(
  p_empresa_id uuid,
  p_conta_id uuid,
  p_motivo text
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v public.financeiro_contas_pagar%rowtype;
  v_mov uuid;
  v_motivo_clean text := trim(coalesce(p_motivo, ''));
begin
  if not public.pode_estornar_conta_pagar(p_empresa_id) then
    raise exception 'Você não tem permissão para estornar despesas pagas. Solicite autorização ao usuário Master.';
  end if;

  if length(v_motivo_clean) < 3 then
    raise exception 'O motivo do estorno é obrigatório (mínimo de 3 caracteres).';
  end if;

  select * into v from public.financeiro_contas_pagar
  where id = p_conta_id and empresa_id = p_empresa_id for update;

  if not found then
    raise exception 'Despesa não encontrada';
  end if;

  if v.status <> 'paga' then
    raise exception 'Somente despesas pagas podem ser estornadas';
  end if;

  if not v.pago_pessoalmente then
    insert into public.caixa_movimentos(
      empresa_id, tipo_movimento, origem_tipo, origem_id,
      data_movimento, competencia, valor, descricao
    ) values (
      p_empresa_id,
      'entrada',
      'estorno_conta_pagar',
      v.id,
      current_date,
      to_char(current_date, 'YYYY-MM'),
      v.valor,
      'Estorno de conta paga: ' || v.descricao || ' — Motivo: ' || v_motivo_clean
    ) returning id into v_mov;
  end if;

  update public.financeiro_contas_pagar
  set status = 'aberta',
      pago_em = null,
      caixa_movimento_id = null,
      updated_at = now()
  where id = v.id;

  insert into public.financeiro_contas_pagar_logs(
    empresa_id, conta_id, usuario_id, acao, fornecedor, descricao, valor, motivo, detalhes
  ) values (
    p_empresa_id,
    v.id,
    public.current_usuario_id(),
    'ESTORNO',
    v.fornecedor,
    v.descricao,
    v.valor,
    v_motivo_clean,
    jsonb_build_object('movimento_estorno_id', v_mov, 'pago_pessoalmente', v.pago_pessoalmente)
  );

  return jsonb_build_object('id', v.id, 'movimento_estorno_id', v_mov);
end $$;

-- RPC: Excluir Conta a Pagar
create or replace function public.rpc_excluir_conta_pagar(
  p_empresa_id uuid,
  p_conta_id uuid,
  p_motivo text
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v public.financeiro_contas_pagar%rowtype;
  v_mov uuid;
  v_motivo_clean text := trim(coalesce(p_motivo, ''));
  v_is_master boolean;
begin
  if auth.uid() is not null and not public.can_write_tenant_internal(p_empresa_id) then
    raise exception 'Você não tem permissão para excluir despesas nesta empresa';
  end if;

  if length(v_motivo_clean) < 3 then
    raise exception 'O motivo da exclusão é obrigatório (mínimo de 3 caracteres).';
  end if;

  select * into v from public.financeiro_contas_pagar
  where id = p_conta_id and empresa_id = p_empresa_id for update;

  if not found or v.status = 'cancelada' then
    raise exception 'Despesa ativa não encontrada';
  end if;

  v_is_master := public.is_financeiro_tenant_master(p_empresa_id);

  if v.status = 'paga' and not v_is_master then
    raise exception 'Apenas o usuário Master pode excluir uma despesa que já foi paga. Para outros usuários, solicite o estorno da conta.';
  end if;

  if v.status = 'paga' and not v.pago_pessoalmente then
    insert into public.caixa_movimentos(
      empresa_id, tipo_movimento, origem_tipo, origem_id,
      data_movimento, competencia, valor, descricao
    ) values (
      p_empresa_id,
      'entrada',
      'estorno_conta_pagar',
      v.id,
      current_date,
      to_char(current_date, 'YYYY-MM'),
      v.valor,
      'Exclusão de conta paga: ' || v.descricao || ' — Motivo: ' || v_motivo_clean
    ) returning id into v_mov;
  end if;

  update public.financeiro_contas_pagar
  set status = 'cancelada',
      excluida_em = now(),
      excluida_por_usuario_id = public.current_usuario_id(),
      motivo_exclusao = v_motivo_clean,
      updated_at = now()
  where id = v.id;

  insert into public.financeiro_contas_pagar_logs(
    empresa_id, conta_id, usuario_id, acao, fornecedor, descricao, valor, motivo, detalhes
  ) values (
    p_empresa_id,
    v.id,
    public.current_usuario_id(),
    'EXCLUSAO',
    v.fornecedor,
    v.descricao,
    v.valor,
    v_motivo_clean,
    jsonb_build_object('status_anterior', v.status, 'movimento_estorno_id', v_mov)
  );

  return jsonb_build_object('id', v.id, 'movimento_estorno_id', v_mov);
end $$;

-- Atualizar RLS de financeiro_contas_pagar_logs para permitir visualização por operadores financeiros da empresa
drop policy if exists financeiro_cp_logs_select on public.financeiro_contas_pagar_logs;
create policy financeiro_cp_logs_select on public.financeiro_contas_pagar_logs for select to authenticated
  using (
    public.is_platform_superadmin()
    or public.can_write_tenant_internal(empresa_id)
    or exists (
      select 1 from public.empresa_usuarios eu
      where eu.empresa_id = financeiro_contas_pagar_logs.empresa_id
        and eu.usuario_id = public.current_usuario_id()
        and eu.ativo = true
    )
  );

-- Permissões de execução
revoke all on function public.is_financeiro_tenant_master(uuid) from public, anon;
revoke all on function public.pode_estornar_conta_pagar(uuid) from public, anon;
revoke all on function public.rpc_alterar_conta_pagar(uuid, uuid, text, text, date, numeric, uuid, uuid, text, boolean, uuid) from public, anon;
revoke all on function public.rpc_estornar_conta_pagar(uuid, uuid, text) from public, anon;
revoke all on function public.rpc_excluir_conta_pagar(uuid, uuid, text) from public, anon;

grant execute on function public.is_financeiro_tenant_master(uuid) to authenticated, service_role;
grant execute on function public.pode_estornar_conta_pagar(uuid) to authenticated, service_role;
grant execute on function public.rpc_alterar_conta_pagar(uuid, uuid, text, text, date, numeric, uuid, uuid, text, boolean, uuid) to authenticated, service_role;
grant execute on function public.rpc_estornar_conta_pagar(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.rpc_excluir_conta_pagar(uuid, uuid, text) to authenticated, service_role;

commit;
