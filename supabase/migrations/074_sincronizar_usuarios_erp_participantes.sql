-- 074: sincroniza usuários já vinculados ao tenant com Participantes comerciais do ERP.
-- Forward-only, idempotente e sem criar logins, senhas ou alterar vínculos empresa_usuarios.
begin;

alter table public.participantes_comerciais
  drop constraint if exists participantes_comerciais_contato_chk,
  add constraint participantes_comerciais_contato_ou_usuario_chk check (
    usuario_id is not null
    or nullif(trim(coalesce(telefone, '')), '') is not null
    or nullif(trim(coalesce(whatsapp, '')), '') is not null
  );

create or replace function public.tipo_participante_erp_por_usuario(p_perfil text, p_is_consultor boolean)
returns text language sql immutable set search_path = pg_catalog as $$
  select case
    when lower(trim(coalesce(p_perfil, ''))) in ('sdr', 'srd') then 'SDR'
    when p_is_consultor or lower(trim(coalesce(p_perfil, ''))) in ('consultor', 'vendedor') then 'CONSULTOR'
    when lower(trim(coalesce(p_perfil, ''))) in ('parceiro', 'imobiliaria', 'parceiro_comercial') then 'PARCEIRO'
    when lower(trim(coalesce(p_perfil, ''))) in ('master', 'admin', 'admin_empresa', 'gestor') then 'GESTOR'
    else 'VENDEDOR'
  end;
$$;

create or replace function public.sincronizar_usuario_participante_erp(p_empresa_id uuid, p_usuario_id uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_usuario record;
  v_participante_id uuid;
  v_tipo text;
begin
  select u.id, u.nome, u.email, u.perfil, u.is_consultor, u.ativo
    into v_usuario
  from public.usuarios u
  join public.empresa_usuarios eu on eu.usuario_id = u.id
  where eu.empresa_id = p_empresa_id and eu.usuario_id = p_usuario_id and eu.ativo = true and u.ativo = true;
  if not found then return null; end if;

  select pc.id into v_participante_id
  from public.participantes_comerciais pc
  where pc.empresa_id = p_empresa_id and pc.usuario_id = p_usuario_id and pc.status = 'ATIVO'
  order by pc.created_at asc limit 1;

  if v_participante_id is null then
    insert into public.participantes_comerciais(
      empresa_id, usuario_id, nome, nome_exibicao, email, cargo, status, data_entrada
    ) values (
      p_empresa_id, v_usuario.id, coalesce(nullif(trim(v_usuario.nome), ''), v_usuario.email),
      nullif(trim(v_usuario.nome), ''), nullif(lower(trim(v_usuario.email)), ''),
      nullif(trim(v_usuario.perfil), ''), 'ATIVO', current_date
    ) returning id into v_participante_id;
  end if;

  v_tipo := public.tipo_participante_erp_por_usuario(v_usuario.perfil, coalesce(v_usuario.is_consultor, false));
  insert into public.participante_tipos(participante_id, empresa_id, tipo_codigo)
  values (v_participante_id, p_empresa_id, v_tipo)
  on conflict (participante_id, tipo_codigo) do nothing;

  return v_participante_id;
end;
$$;

create or replace function public.empresa_usuarios_sincronizar_participante_erp()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if new.ativo then perform public.sincronizar_usuario_participante_erp(new.empresa_id, new.usuario_id); end if;
  return new;
end;
$$;

drop trigger if exists empresa_usuarios_sincronizar_participante_erp on public.empresa_usuarios;
create trigger empresa_usuarios_sincronizar_participante_erp
after insert or update of ativo on public.empresa_usuarios
for each row execute function public.empresa_usuarios_sincronizar_participante_erp();

select public.sincronizar_usuario_participante_erp(eu.empresa_id, eu.usuario_id)
from public.empresa_usuarios eu
join public.usuarios u on u.id = eu.usuario_id and u.ativo = true
where eu.ativo = true;

revoke all on function public.tipo_participante_erp_por_usuario(text,boolean) from public, anon;
revoke all on function public.sincronizar_usuario_participante_erp(uuid,uuid) from public, anon;
revoke all on function public.empresa_usuarios_sincronizar_participante_erp() from public, anon;
grant execute on function public.sincronizar_usuario_participante_erp(uuid,uuid) to service_role;

commit;
