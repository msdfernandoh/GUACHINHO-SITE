-- Racon Sorriso é uma franquia independente no mesmo plano ERP completo do
-- Gauchinho. Administradores da empresa herdam o catálogo contratado; listas
-- individuais continuam disponíveis apenas para restringir outros papéis.
begin;

do $$
declare
  v_empresa_id uuid := '3b5d14ec-6e0f-4f8e-952a-75adbfaa0949'::uuid;
  v_usuario_id uuid := '6d0af73f-880f-48bf-b588-d0dd76f97f98'::uuid;
  v_vinculo_id uuid := '33f4cd5e-3a0b-4785-970c-21694eb8262b'::uuid;
  v_papel_admin_id uuid;
  v_modulos text[];
begin
  if not exists (
    select 1 from public.empresas
    where id = v_empresa_id and slug = 'sorriso' and ativo
  ) then
    raise exception 'Tenant Racon Sorriso divergente; nenhuma alteração aplicada';
  end if;

  select p.id into v_papel_admin_id
  from public.papeis p
  where p.codigo = 'admin_empresa'
    and p.escopo = 'COMPANY'
    and p.ativo
    and (p.empresa_id is null or p.empresa_id = v_empresa_id)
  order by (p.empresa_id = v_empresa_id) desc
  limit 1;

  if v_papel_admin_id is null then
    raise exception 'Papel admin_empresa não encontrado; nenhuma alteração aplicada';
  end if;

  if not exists (
    select 1
    from public.empresa_usuarios eu
    join public.usuarios u on u.id = eu.usuario_id
    where eu.id = v_vinculo_id
      and eu.empresa_id = v_empresa_id
      and eu.usuario_id = v_usuario_id
      and eu.ativo
      and u.ativo
  ) then
    raise exception 'Vínculo administrativo alvo divergente; nenhuma alteração aplicada';
  end if;

  if not exists (
    select 1
    from public.saas_assinaturas a
    join public.saas_planos p on p.id = a.plano_id
    where a.empresa_id = v_empresa_id
      and a.status = 'ATIVA'
      and p.codigo = 'plano_profissional'
      and p.status = 'ATIVO'
      and p.erp_incluido
  ) then
    raise exception 'Assinatura ERP completa de Sorriso não encontrada; nenhuma alteração aplicada';
  end if;

  select array_agg(m.codigo order by m.ordem_padrao, m.codigo)
  into v_modulos
  from public.saas_assinaturas a
  join public.saas_plano_modulos pm
    on pm.plano_id = a.plano_id and pm.habilitado
  join public.erp_modulos_catalogo m
    on m.id = pm.modulo_id and m.status = 'ATIVO'
  where a.empresa_id = v_empresa_id
    and a.status = 'ATIVA';

  if coalesce(cardinality(v_modulos), 0) = 0 then
    raise exception 'Plano de Sorriso sem módulos ERP; nenhuma alteração aplicada';
  end if;

  update public.empresas
  set configuracoes = coalesce(configuracoes, '{}'::jsonb)
    || jsonb_build_object(
      'erp_sistema',
      jsonb_build_object('habilitado', true, 'modulos', to_jsonb(v_modulos))
    )
  where id = v_empresa_id;

  update public.usuarios
  set perfil = 'master'
  where id = v_usuario_id;

  update public.empresa_usuarios
  set papel_id = v_papel_admin_id,
      erp_modulos_visiveis = null
  where id = v_vinculo_id
    and empresa_id = v_empresa_id
    and usuario_id = v_usuario_id;

  -- NULL significa herdar todos os módulos contratados. A regra vale para
  -- qualquer administrador ativo da franquia, sem ampliar outros papéis.
  update public.empresa_usuarios
  set erp_modulos_visiveis = null
  where empresa_id = v_empresa_id
    and papel_id = v_papel_admin_id
    and ativo;
end $$;

commit;

