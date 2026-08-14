-- 077: importacao de contas, socios pagadores e visibilidade individual do ERP.
-- Forward-only, tenant-aware e sem mutar movimentos de caixa existentes.
begin;

alter table public.empresa_usuarios
  add column if not exists socio_pagador boolean not null default false,
  add column if not exists erp_modulos_visiveis text[];

alter table public.empresa_usuarios
  drop constraint if exists empresa_usuarios_erp_modulos_visiveis_check;
alter table public.empresa_usuarios
  add constraint empresa_usuarios_erp_modulos_visiveis_check check (
    erp_modulos_visiveis is null or
    erp_modulos_visiveis <@ array[
      'painel','leads','propostas','contratacoes','vendas','grupos','comissoes',
      'financeiro','relatorios','metas','tarefas','usuarios','clientes','consultores',
      'lances','assembleias','regras-comissao','repasse-franquia','minhas-comissoes',
      'contas-pagar'
    ]::text[]
  );

-- A validação criada na 043 protegia corretamente papéis PLATFORM, mas tratava
-- qualquer UPDATE no vínculo como alteração do papel. A 077 acrescenta apenas
-- metadados tenant-aware ao vínculo; por isso, mantém a proteção quando
-- papel/empresa/ativo mudam e permite atualizar campos auxiliares.
create or replace function public.validar_papel_empresa_usuario()
returns trigger as $$
declare
  v_role_escopo text;
  v_role_empresa_id uuid;
  v_role_ativo boolean;
  v_old_role_escopo text;
  v_protected_fields_changed boolean := false;
begin
  if TG_OP = 'DELETE' then
    select escopo into v_old_role_escopo from public.papeis where id = OLD.papel_id;
    if v_old_role_escopo = 'PLATFORM' and not public.is_platform_superadmin() then
      raise exception 'Apenas SuperAdmins da Plataforma podem excluir ou remover vínculos com papel PLATFORM.';
    end if;
    return OLD;
  end if;

  select escopo, empresa_id, ativo
  into v_role_escopo, v_role_empresa_id, v_role_ativo
  from public.papeis
  where id = NEW.papel_id;

  if not found then
    raise exception 'Papel informado (ID %) não existe.', NEW.papel_id;
  end if;
  if not v_role_ativo then
    raise exception 'Papel informado (ID %) está inativo.', NEW.papel_id;
  end if;

  if TG_OP = 'UPDATE' then
    select escopo into v_old_role_escopo from public.papeis where id = OLD.papel_id;
    v_protected_fields_changed :=
      OLD.papel_id is distinct from NEW.papel_id
      or OLD.empresa_id is distinct from NEW.empresa_id
      or OLD.ativo is distinct from NEW.ativo;
    if v_protected_fields_changed
      and (v_old_role_escopo = 'PLATFORM' or v_role_escopo = 'PLATFORM')
      and not public.is_platform_superadmin()
    then
      raise exception 'Apenas SuperAdmins da Plataforma podem alterar, desativar ou rebaixar papéis de escopo PLATFORM.';
    end if;
  elsif v_role_escopo = 'PLATFORM' and not public.is_platform_superadmin() then
    raise exception 'Apenas SuperAdmins da Plataforma podem atribuir papéis de escopo PLATFORM.';
  end if;

  if v_role_escopo = 'COMPANY' and v_role_empresa_id is not null
    and v_role_empresa_id <> NEW.empresa_id
  then
    raise exception 'Papel personalizado da empresa % não pode ser atribuído a usuário da empresa %.',
      v_role_empresa_id, NEW.empresa_id;
  end if;

  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.validar_papel_empresa_usuario() from public;

alter table public.financeiro_contas_pagar
  add column if not exists importacao_origem text,
  add column if not exists importacao_chave text,
  add column if not exists data_lancamento date,
  add column if not exists forma_pagamento text,
  add column if not exists comprovante_nome text,
  add column if not exists comprovante_url text,
  add column if not exists responsavel_importado text,
  add column if not exists lancado_por_importado text,
  add column if not exists necessita_revisao boolean not null default false;

alter table public.financeiro_contas_pagar
  drop constraint if exists financeiro_contas_pagar_valor_check;
alter table public.financeiro_contas_pagar
  drop constraint if exists financeiro_contas_pagar_valor_valido_check;
alter table public.financeiro_contas_pagar
  add constraint financeiro_contas_pagar_valor_valido_check check (
    valor > 0 or (valor = 0 and necessita_revisao = true)
  );

create unique index if not exists financeiro_contas_pagar_importacao_unica_idx
  on public.financeiro_contas_pagar (empresa_id, importacao_origem, importacao_chave)
  where importacao_chave is not null;

create or replace function public.rpc_registrar_ajuste_caixa(
  p_empresa_id uuid,
  p_tipo_movimento text,
  p_valor numeric,
  p_data_movimento date,
  p_descricao text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_id uuid;
  v_descricao text := trim(coalesce(p_descricao, ''));
begin
  if auth.uid() is not null and not public.can_write_tenant_internal(p_empresa_id) then
    raise exception 'Acesso negado ao tenant';
  end if;
  if p_tipo_movimento not in ('entrada', 'saida') then
    raise exception 'Tipo de movimento inválido';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'O valor deve ser maior que zero';
  end if;
  if p_data_movimento is null then
    raise exception 'Data do movimento é obrigatória';
  end if;
  if length(v_descricao) < 3 then
    raise exception 'Descrição deve possuir pelo menos 3 caracteres';
  end if;

  insert into public.caixa_movimentos (
    empresa_id, tipo_movimento, origem_tipo, origem_id,
    data_movimento, competencia, valor, descricao
  ) values (
    p_empresa_id, p_tipo_movimento, 'ajuste_caixa', null,
    p_data_movimento, to_char(p_data_movimento, 'YYYY-MM'), round(p_valor, 2), v_descricao
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.validar_socio_pagador_conta()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.socio_pagador_usuario_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.empresa_usuarios eu
    where eu.empresa_id = new.empresa_id
      and eu.usuario_id = new.socio_pagador_usuario_id
      and eu.ativo = true
      and eu.socio_pagador = true
  ) then
    raise exception 'Sócio pagador não está habilitado nesta empresa';
  end if;

  return new;
end;
$$;

drop trigger if exists financeiro_contas_pagar_validar_socio on public.financeiro_contas_pagar;
create trigger financeiro_contas_pagar_validar_socio
before insert or update of empresa_id, socio_pagador_usuario_id
on public.financeiro_contas_pagar
for each row execute function public.validar_socio_pagador_conta();

-- Solicitação operacional: Fernando e Eroni iniciam habilitados como sócios
-- somente na tenant Gauchinho. Nenhum outro vínculo ou tenant é alterado.
update public.empresa_usuarios eu
set socio_pagador = true,
    updated_at = now()
from public.empresas e, public.usuarios u
where eu.empresa_id = e.id
  and eu.usuario_id = u.id
  and eu.ativo = true
  and e.slug = 'gauchinho'
  and (
    lower(trim(u.nome)) like '%fernando%'
    or lower(trim(u.nome)) like '%eroni%'
  );

-- O fechamento considera também sócios que não pagaram nada no período.
-- Assim, se Fernando adiantou tudo e Eroni nada, o saldo devido continua visível.
create or replace view public.financeiro_fechamento_socios as
with totais as (
  select empresa_id, competencia, sum(valor) total
  from public.financeiro_contas_pagar
  where status = 'paga' and pago_pessoalmente = true
  group by empresa_id, competencia
), socios as (
  select empresa_id, usuario_id
  from public.empresa_usuarios
  where ativo = true and socio_pagador = true
), pagos as (
  select empresa_id, competencia, socio_pagador_usuario_id usuario_id, sum(valor) total_pago
  from public.financeiro_contas_pagar
  where status = 'paga' and pago_pessoalmente = true
  group by empresa_id, competencia, socio_pagador_usuario_id
), base as (
  select t.empresa_id, t.competencia, s.usuario_id,
         coalesce(p.total_pago, 0::numeric) total_pago, t.total,
         count(*) over (partition by t.empresa_id, t.competencia) participantes
  from totais t
  join socios s on s.empresa_id = t.empresa_id
  left join pagos p on p.empresa_id = t.empresa_id
    and p.competencia = t.competencia and p.usuario_id = s.usuario_id
)
select empresa_id, competencia, usuario_id, total_pago, total,
       round(total / nullif(participantes, 0), 2) cota_igual,
       round(total_pago - (total / nullif(participantes, 0)), 2) saldo_ajuste
from base;

revoke all on function public.validar_socio_pagador_conta() from public, anon;
revoke all on function public.rpc_registrar_ajuste_caixa(uuid, text, numeric, date, text) from public, anon;
grant execute on function public.rpc_registrar_ajuste_caixa(uuid, text, numeric, date, text)
  to authenticated, service_role;

commit;
