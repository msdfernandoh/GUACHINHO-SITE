-- Alinha a ativação da Master Franquia ao onboarding canônico: o plano escolhido
-- nasce como assinatura RASCUNHO e é efetivado somente na ativação explícita.

create or replace function public.rpc_platform_ativar_empresa(
  p_empresa_id uuid
) returns boolean
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_empresa public.empresas%rowtype;
  v_assinatura public.saas_assinaturas%rowtype;
  v_tem_admin boolean;
  v_tem_usuario boolean;
begin
  if not public.is_platform_superadmin() then
    raise exception 'Acesso restrito ao Platform Superadmin.';
  end if;

  select * into v_empresa
  from public.empresas
  where id=p_empresa_id
  for update;

  if v_empresa.id is null then
    raise exception 'Empresa não encontrada.';
  end if;

  select * into v_assinatura
  from public.saas_assinaturas
  where empresa_id=p_empresa_id
    and status in ('ATIVA','TREINAMENTO','PENDENTE','RASCUNHO')
  order by created_at desc
  limit 1
  for update;

  if v_assinatura.id is null then
    raise exception 'Não é possível ativar: a Master Franquia deve possuir um Plano SaaS com assinatura vinculada.';
  end if;

  select exists(
    select 1
    from public.empresa_administradoras
    where empresa_id=p_empresa_id and status='ATIVA'
  ) into v_tem_admin;

  if not v_tem_admin then
    raise exception 'Não é possível ativar: a Master Franquia deve possuir ao menos 1 Administradora concedida e ativa.';
  end if;

  select exists(
    select 1
    from public.empresa_usuarios
    where empresa_id=p_empresa_id and ativo=true
  ) into v_tem_usuario;

  if not v_tem_usuario then
    raise exception 'Não é possível ativar: a Master Franquia deve possuir ao menos 1 usuário responsável cadastrado e ativo.';
  end if;

  update public.empresas
  set status='ativa', ativo=true, updated_at=now()
  where id=p_empresa_id;

  update public.saas_assinaturas
  set status='ATIVA', updated_at=now()
  where id=v_assinatura.id
    and status in ('TREINAMENTO','PENDENTE','RASCUNHO');

  insert into public.plataforma_auditoria(
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) values (
    'ATIVAR_EMPRESA',
    'empresas',
    p_empresa_id,
    jsonb_build_object(
      'status_anterior', v_empresa.status,
      'status_novo', 'ativa',
      'assinatura_id', v_assinatura.id,
      'assinatura_status_anterior', v_assinatura.status,
      'assinatura_status_novo', 'ATIVA'
    ),
    auth.uid()
  );

  return true;
end;
$$;

revoke all on function public.rpc_platform_ativar_empresa(uuid) from public,anon,service_role;
grant execute on function public.rpc_platform_ativar_empresa(uuid) to authenticated;

notify pgrst, 'reload schema';
