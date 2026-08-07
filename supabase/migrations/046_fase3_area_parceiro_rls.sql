-- =============================================================================
-- Migration 046 — Fase 3 E7: RLS aditiva da área comercial do parceiro
-- =============================================================================
-- Escopo:
--   - permissão visao_ampliada_org_parceiro
--   - helpers de visão comercial
--   - policies ADITIVAS em leads/propostas (convivem com leads_staff/propostas_staff)
--
-- NÃO faz:
--   - backfill; alterar policies legadas; site/domínio/Vercel; CRM avançado (Fase 6)
--
-- Pré-requisito: 045 aplicada.
-- =============================================================================

-- --------------------------------------------------------------------------
-- 1. Permissão visão ampliada (explícita; não inferir por cargo)
-- --------------------------------------------------------------------------
insert into public.permissoes (codigo, nome, modulo, descricao)
values
  (
    'visao_ampliada_org_parceiro',
    'Visão ampliada na organização parceira',
    'parceiros',
    'Ver todos os leads/propostas da organização vinculada (além dos próprios).'
  )
on conflict (codigo) do update
set
  nome = excluded.nome,
  modulo = excluded.modulo,
  descricao = excluded.descricao;

-- admin_empresa / super_admin recebem; parceiro_comercial NÃO por padrão
insert into public.papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from public.papeis p
cross join public.permissoes perm
where p.codigo in ('super_admin', 'admin_empresa')
  and perm.codigo = 'visao_ampliada_org_parceiro'
on conflict do nothing;

-- --------------------------------------------------------------------------
-- 2. Helpers
-- --------------------------------------------------------------------------
create or replace function public.participante_tem_tipo_codigo(
  p_empresa_id uuid,
  p_tipo_codigo text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participante_tipos pt
    where pt.empresa_id = p_empresa_id
      and pt.participante_id = public.current_participante_id(p_empresa_id)
      and pt.tipo_codigo = p_tipo_codigo
  );
$$;

revoke all on function public.participante_tem_tipo_codigo(uuid, text) from public;
grant execute on function public.participante_tem_tipo_codigo(uuid, text) to authenticated, service_role;

create or replace function public.parceiro_tem_visao_org(
  p_empresa_id uuid,
  p_organizacao_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_responsavel_principal_org(p_empresa_id, p_organizacao_id)
    or public.participante_tem_tipo_codigo(p_empresa_id, 'RESPONSAVEL_PARCEIRO')
    or public.has_company_permission(p_empresa_id, 'visao_ampliada_org_parceiro');
$$;

revoke all on function public.parceiro_tem_visao_org(uuid, uuid) from public;
grant execute on function public.parceiro_tem_visao_org(uuid, uuid) to authenticated, service_role;

create or replace function public.parceiro_pode_ver_registro_comercial(
  p_empresa_id uuid,
  p_organizacao_id uuid,
  p_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_empresa_id is not null
    and p_organizacao_id is not null
    and public.has_organizacao_acesso(p_empresa_id, p_organizacao_id)
    and (
      public.parceiro_tem_visao_org(p_empresa_id, p_organizacao_id)
      or (
        p_participant_id is not null
        and p_participant_id = public.current_participante_id(p_empresa_id)
      )
    );
$$;

revoke all on function public.parceiro_pode_ver_registro_comercial(uuid, uuid, uuid) from public;
grant execute on function public.parceiro_pode_ver_registro_comercial(uuid, uuid, uuid)
  to authenticated, service_role;

-- Status de proposta editáveis pelo parceiro (equivalente conceitual a RASCUNHO).
-- Schema atual não possui literal 'RASCUNHO'; usa 'Gerada' / 'PDF gerado'.
create or replace function public.proposta_status_editavel_parceiro(p_status text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_status, '') in ('Gerada', 'PDF gerado');
$$;

revoke all on function public.proposta_status_editavel_parceiro(text) from public;
grant execute on function public.proposta_status_editavel_parceiro(text)
  to authenticated, service_role;

-- --------------------------------------------------------------------------
-- 3. Policies ADITIVAS — leads
--    leads_staff (is_staff) permanece intacta; policies são OR permissivas.
-- --------------------------------------------------------------------------
drop policy if exists leads_parceiro_select on public.leads;
create policy leads_parceiro_select on public.leads
  for select to authenticated
  using (
    empresa_id is not null
    and organizacao_parceira_id is not null
    and public.has_company_permission(empresa_id, 'visualizar_leads_parceiro')
    and public.parceiro_pode_ver_registro_comercial(
      empresa_id,
      organizacao_parceira_id,
      participant_id
    )
  );

drop policy if exists leads_parceiro_insert on public.leads;
create policy leads_parceiro_insert on public.leads
  for insert to authenticated
  with check (
    empresa_id is not null
    and organizacao_parceira_id is not null
    and participant_id is not null
    and participant_id = public.current_participante_id(empresa_id)
    and public.has_company_permission(empresa_id, 'criar_leads_parceiro')
    and public.has_organizacao_acesso(empresa_id, organizacao_parceira_id)
  );

drop policy if exists leads_parceiro_update on public.leads;
create policy leads_parceiro_update on public.leads
  for update to authenticated
  using (
    empresa_id is not null
    and organizacao_parceira_id is not null
    and public.has_company_permission(empresa_id, 'editar_leads_parceiro')
    and public.parceiro_pode_ver_registro_comercial(
      empresa_id,
      organizacao_parceira_id,
      participant_id
    )
  )
  with check (
    empresa_id is not null
    and organizacao_parceira_id is not null
    and public.has_company_permission(empresa_id, 'editar_leads_parceiro')
    and public.has_organizacao_acesso(empresa_id, organizacao_parceira_id)
    and (
      public.parceiro_tem_visao_org(empresa_id, organizacao_parceira_id)
      or participant_id = public.current_participante_id(empresa_id)
    )
  );

-- Sem policy DELETE para parceiro (propositadamente).

-- --------------------------------------------------------------------------
-- 4. Policies ADITIVAS — propostas
-- --------------------------------------------------------------------------
drop policy if exists propostas_parceiro_select on public.propostas;
create policy propostas_parceiro_select on public.propostas
  for select to authenticated
  using (
    empresa_id is not null
    and organizacao_parceira_id is not null
    and public.has_company_permission(empresa_id, 'visualizar_propostas_parceiro')
    and public.parceiro_pode_ver_registro_comercial(
      empresa_id,
      organizacao_parceira_id,
      participant_id
    )
  );

drop policy if exists propostas_parceiro_insert on public.propostas;
create policy propostas_parceiro_insert on public.propostas
  for insert to authenticated
  with check (
    empresa_id is not null
    and organizacao_parceira_id is not null
    and participant_id is not null
    and participant_id = public.current_participante_id(empresa_id)
    and public.has_company_permission(empresa_id, 'criar_propostas_parceiro')
    and public.has_organizacao_acesso(empresa_id, organizacao_parceira_id)
  );

drop policy if exists propostas_parceiro_update on public.propostas;
create policy propostas_parceiro_update on public.propostas
  for update to authenticated
  using (
    empresa_id is not null
    and organizacao_parceira_id is not null
    and public.has_company_permission(empresa_id, 'editar_propostas_parceiro')
    and public.parceiro_pode_ver_registro_comercial(
      empresa_id,
      organizacao_parceira_id,
      participant_id
    )
    and public.proposta_status_editavel_parceiro(status)
  )
  with check (
    empresa_id is not null
    and organizacao_parceira_id is not null
    and public.has_company_permission(empresa_id, 'editar_propostas_parceiro')
    and public.has_organizacao_acesso(empresa_id, organizacao_parceira_id)
    and public.proposta_status_editavel_parceiro(status)
    and (
      public.parceiro_tem_visao_org(empresa_id, organizacao_parceira_id)
      or participant_id = public.current_participante_id(empresa_id)
    )
  );

-- Sem policy DELETE para parceiro.

-- --------------------------------------------------------------------------
-- 5. Policies ADITIVAS — leads_historico (consulta + registro básico)
-- --------------------------------------------------------------------------
drop policy if exists leads_historico_parceiro_select on public.leads_historico;
create policy leads_historico_parceiro_select on public.leads_historico
  for select to authenticated
  using (
    exists (
      select 1
      from public.leads l
      where l.id = lead_id
        and l.empresa_id is not null
        and l.organizacao_parceira_id is not null
        and public.has_company_permission(l.empresa_id, 'visualizar_leads_parceiro')
        and public.parceiro_pode_ver_registro_comercial(
          l.empresa_id,
          l.organizacao_parceira_id,
          l.participant_id
        )
    )
  );

drop policy if exists leads_historico_parceiro_insert on public.leads_historico;
create policy leads_historico_parceiro_insert on public.leads_historico
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.leads l
      where l.id = lead_id
        and l.empresa_id is not null
        and l.organizacao_parceira_id is not null
        and public.has_company_permission(l.empresa_id, 'editar_leads_parceiro')
        and public.parceiro_pode_ver_registro_comercial(
          l.empresa_id,
          l.organizacao_parceira_id,
          l.participant_id
        )
    )
  );
