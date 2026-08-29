-- CRUD canônico dos créditos comerciais do grupo.
-- Platform gerencia qualquer grupo. ERP gerencia diretamente somente grupos
-- locais originados no próprio tenant; catálogo global mantém governança SaaS.

create or replace function public.rpc_salvar_credito_grupo(
  p_grupo_id uuid,
  p_grupo_cota_id uuid,
  p_valor_credito numeric
) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_grupo public.grupos_consorcio%rowtype;
  v_cota public.grupos_cotas%rowtype;
  v_nova_id uuid;
  v_usado boolean := false;
begin
  select * into v_grupo from public.grupos_consorcio where id=p_grupo_id for update;
  if v_grupo.id is null then raise exception 'Grupo não encontrado'; end if;
  if not public.is_platform_superadmin() and (
    v_grupo.origem_governanca is distinct from 'LOCAL'
    or v_grupo.empresa_origem_id is null
    or not public.can_write_tenant_internal(v_grupo.empresa_origem_id)
  ) then raise exception 'Créditos de catálogo global devem ser editados pela Platform'; end if;
  if p_valor_credito is null or p_valor_credito <= 0 then raise exception 'Valor de crédito inválido'; end if;

  if exists(
    select 1 from public.grupos_cotas
    where grupo_id=p_grupo_id and abs(valor_credito-p_valor_credito)<0.01
      and (p_grupo_cota_id is null or id<>p_grupo_cota_id)
  ) then raise exception 'Este crédito já existe no grupo'; end if;

  if p_grupo_cota_id is null then
    insert into public.grupos_cotas(grupo_id,valor_credito,valor_parcela,status,ativo,ordem)
    values(p_grupo_id,p_valor_credito,0,'Disponível',true,
      coalesce((select max(ordem)+1 from public.grupos_cotas where grupo_id=p_grupo_id),0))
    returning id into v_nova_id;
    return jsonb_build_object('acao','INCLUIDO','id',v_nova_id);
  end if;

  select * into v_cota from public.grupos_cotas
  where id=p_grupo_cota_id and grupo_id=p_grupo_id for update;
  if v_cota.id is null then raise exception 'Crédito não encontrado neste grupo'; end if;

  select exists(select 1 from public.vendas where opcao_cota_id=v_cota.id)
    or exists(select 1 from public.simulacoes_grupos_itens where grupo_cota_id=v_cota.id)
  into v_usado;

  if v_usado and abs(v_cota.valor_credito-p_valor_credito)>=0.01 then
    update public.grupos_cotas set ativo=false,status='Inativo',updated_at=now() where id=v_cota.id;
    insert into public.grupos_cotas(grupo_id,valor_credito,valor_parcela,status,ativo,ordem)
    values(p_grupo_id,p_valor_credito,0,'Disponível',true,v_cota.ordem)
    returning id into v_nova_id;
    return jsonb_build_object('acao','SUBSTITUIDO_PRESERVANDO_HISTORICO','id',v_nova_id,'anterior_id',v_cota.id);
  end if;

  update public.grupos_cotas
  set valor_credito=p_valor_credito,ativo=true,status='Disponível',updated_at=now()
  where id=v_cota.id;
  return jsonb_build_object('acao','ATUALIZADO','id',v_cota.id);
end $$;

create or replace function public.rpc_excluir_credito_grupo(p_grupo_cota_id uuid)
returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_cota public.grupos_cotas%rowtype;
  v_grupo public.grupos_consorcio%rowtype;
  v_usado boolean := false;
begin
  select * into v_cota from public.grupos_cotas where id=p_grupo_cota_id for update;
  if v_cota.id is null then raise exception 'Crédito não encontrado'; end if;
  select * into v_grupo from public.grupos_consorcio where id=v_cota.grupo_id;
  if not public.is_platform_superadmin() and (
    v_grupo.origem_governanca is distinct from 'LOCAL'
    or v_grupo.empresa_origem_id is null
    or not public.can_write_tenant_internal(v_grupo.empresa_origem_id)
  ) then raise exception 'Créditos de catálogo global devem ser editados pela Platform'; end if;

  select exists(select 1 from public.vendas where opcao_cota_id=v_cota.id)
    or exists(select 1 from public.simulacoes_grupos_itens where grupo_cota_id=v_cota.id)
  into v_usado;
  if v_usado then
    update public.grupos_cotas set ativo=false,status='Inativo',updated_at=now() where id=v_cota.id;
    return jsonb_build_object('acao','INATIVADO','mensagem','Crédito possui histórico e foi inativado');
  end if;
  delete from public.grupo_cota_modalidade_valores where grupo_cota_id=v_cota.id;
  delete from public.grupos_cotas where id=v_cota.id;
  return jsonb_build_object('acao','EXCLUIDO','mensagem','Crédito excluído');
end $$;

revoke all on function public.rpc_salvar_credito_grupo(uuid,uuid,numeric) from public,anon,service_role;
grant execute on function public.rpc_salvar_credito_grupo(uuid,uuid,numeric) to authenticated;
revoke all on function public.rpc_excluir_credito_grupo(uuid) from public,anon,service_role;
grant execute on function public.rpc_excluir_credito_grupo(uuid) to authenticated;
