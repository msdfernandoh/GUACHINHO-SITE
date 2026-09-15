-- ===========================================================================
-- Migration 222: QR Institucional Permanente, Destinos Histórico,
--                Telefone Normalizado e RPC Anti-Duplicidade de Leads
-- ===========================================================================

-- 1. CAMPOS DE DESTINO EM qr_codes_unicos
alter table public.qr_codes_unicos
  add column if not exists tipo_destino text not null default 'evento',
  add column if not exists destino_url text,
  add column if not exists destino_evento_id uuid references public.eventos (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'qr_codes_unicos_tipo_destino_check'
  ) then
    alter table public.qr_codes_unicos
      add constraint qr_codes_unicos_tipo_destino_check
      check (tipo_destino in ('site', 'evento', 'checkin_evento', 'whatsapp', 'pagina_interna', 'custom'));
  end if;
end $$;

comment on column public.qr_codes_unicos.tipo_destino is 'Tipo de destino: site (home), evento (check-in vinculado por período), checkin_evento (evento fixo), whatsapp, pagina_interna ou custom.';
comment on column public.qr_codes_unicos.destino_url is 'URL ou path de redirecionamento quando tipo_destino for custom, site, whatsapp ou pagina_interna.';
comment on column public.qr_codes_unicos.destino_evento_id is 'Evento fixo de destino quando tipo_destino for checkin_evento.';

-- 2. REGISTRO CANÔNICO DO QR INSTITUCIONAL DO SITE (slug 'site')
insert into public.qr_codes_unicos (nome, slug, tipo_destino, destino_url, ativo)
values ('QR Institucional — Gauchinho', 'site', 'site', '/', true)
on conflict (slug) do update
set tipo_destino = excluded.tipo_destino,
    destino_url = coalesce(public.qr_codes_unicos.destino_url, '/');

-- 3. HISTÓRICO AUDITÁVEL DE ALTERAÇÕES DE DESTINO DO QR
create table if not exists public.qr_codes_unicos_destinos_historico (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid not null references public.qr_codes_unicos (id) on delete cascade,
  tipo_destino_anterior text,
  destino_url_anterior text,
  destino_evento_id_anterior uuid references public.eventos (id) on delete set null,
  tipo_destino_novo text not null,
  destino_url_novo text,
  destino_evento_id_novo uuid references public.eventos (id) on delete set null,
  alterado_por_id uuid references public.usuarios (id) on delete set null,
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists qr_destinos_hist_qr_idx
  on public.qr_codes_unicos_destinos_historico (qr_code_id, created_at desc);

alter table public.qr_codes_unicos_destinos_historico enable row level security;

drop policy if exists qr_destinos_hist_staff on public.qr_codes_unicos_destinos_historico;
create policy qr_destinos_hist_staff on public.qr_codes_unicos_destinos_historico
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());

-- 4. TELEFONE NORMALIZADO EM public.leads
alter table public.leads
  add column if not exists telefone_normalizado text;

-- Backfill seguro: extrai dígitos e remove DDI 55 caso tenha 12 ou 13 dígitos
update public.leads
set telefone_normalizado = case
  when length(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g')) in (12, 13)
       and regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') like '55%'
  then substring(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') from 3)
  else regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g')
end
where (telefone_normalizado is null or telefone_normalizado = '')
  and whatsapp is not null;

create index if not exists leads_telefone_normalizado_idx
  on public.leads (telefone_normalizado);

-- Trigger de normalização automática ao inserir/alterar whatsapp
create or replace function public.trg_normalizar_telefone_lead()
returns trigger
language plpgsql
as $$
declare
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(new.whatsapp, ''), '\D', '', 'g');
  if length(v_digits) in (12, 13) and v_digits like '55%' then
    new.telefone_normalizado := substring(v_digits from 3);
  else
    new.telefone_normalizado := v_digits;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_telefone_normalizado on public.leads;
create trigger trg_leads_telefone_normalizado
  before insert or update of whatsapp on public.leads
  for each row execute function public.trg_normalizar_telefone_lead();

-- 5. RPC ATÔMICA DE UPSERT DE LEAD (ANTI-DUPLICIDADE COM ADVISORY LOCK)
create or replace function public.rpc_upsert_lead_por_telefone(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_raw_tel text;
  v_digits text;
  v_tel_norm text;
  v_lead_id uuid;
  v_action text;
  v_nome text;
  v_email text;
  v_cidade text;
  v_origem text;
  v_origem_detalhe text;
  v_tipo_interesse text;
  v_produto_interesse text;
  v_tipo_credito text;
  v_valor_simulado numeric;
  v_prazo_simulado integer;
  v_entrada numeric;
  v_renda numeric;
  v_valor_estimado numeric;
  v_dados_simulacao jsonb;
  v_resultado_resumido text;
  v_empresa_id uuid;
  v_parceiro_id uuid;
  v_imovel_id uuid;
  v_carta_id uuid;
  v_evento_id uuid;
  v_evento_nome text;
  v_host_origem text;
  v_pagina_origem text;
  v_utm_source text;
  v_utm_medium text;
  v_utm_campaign text;
  v_participante_comercial_id uuid;
  v_lead_rec record;
begin
  -- 1. Extração e normalização do telefone
  v_raw_tel := coalesce(p_payload->>'whatsapp', p_payload->>'telefone', '');
  v_digits := regexp_replace(v_raw_tel, '\D', '', 'g');
  if length(v_digits) in (12, 13) and v_digits like '55%' then
    v_tel_norm := substring(v_digits from 3);
  else
    v_tel_norm := v_digits;
  end if;

  if length(v_tel_norm) < 10 then
    return jsonb_build_object('ok', false, 'error', 'Telefone inválido para cadastro do lead');
  end if;

  -- 2. Lock transacional atômico pelo hash do telefone normalizado
  perform pg_advisory_xact_lock(hashtext('lead_upsert_' || v_tel_norm));

  -- 3. Extração dos campos do payload
  v_nome := nullif(trim(coalesce(p_payload->>'nome', '')), '');
  v_email := nullif(lower(trim(coalesce(p_payload->>'email', ''))), '');
  v_cidade := nullif(trim(coalesce(p_payload->>'cidade', '')), '');
  v_origem := nullif(trim(coalesce(p_payload->>'origem', '')), '');
  v_origem_detalhe := nullif(trim(coalesce(p_payload->>'origem_detalhe', '')), '');
  v_tipo_interesse := nullif(trim(coalesce(p_payload->>'tipo_interesse', '')), '');
  v_produto_interesse := nullif(trim(coalesce(p_payload->>'produto_interesse', '')), '');
  v_tipo_credito := nullif(trim(coalesce(p_payload->>'tipo_credito', '')), '');
  v_valor_simulado := (p_payload->>'valor_simulado')::numeric;
  v_prazo_simulado := (p_payload->>'prazo_simulado')::integer;
  v_entrada := (p_payload->>'entrada')::numeric;
  v_renda := (p_payload->>'renda')::numeric;
  v_valor_estimado := (p_payload->>'valor_estimado')::numeric;
  v_dados_simulacao := p_payload->'dados_simulacao';
  v_resultado_resumido := nullif(trim(coalesce(p_payload->>'resultado_resumido', '')), '');
  v_empresa_id := (p_payload->>'empresa_id')::uuid;
  v_parceiro_id := (p_payload->>'parceiro_id')::uuid;
  v_imovel_id := (p_payload->>'imovel_id')::uuid;
  v_carta_id := (p_payload->>'carta_contemplada_id')::uuid;
  v_evento_id := (p_payload->>'evento_id')::uuid;
  v_evento_nome := nullif(trim(coalesce(p_payload->>'evento_nome', '')), '');
  v_host_origem := nullif(trim(coalesce(p_payload->>'host_origem', '')), '');
  v_pagina_origem := nullif(trim(coalesce(p_payload->>'pagina_origem', '')), '');
  v_utm_source := nullif(trim(coalesce(p_payload->>'utm_source', '')), '');
  v_utm_medium := nullif(trim(coalesce(p_payload->>'utm_medium', '')), '');
  v_utm_campaign := nullif(trim(coalesce(p_payload->>'utm_campaign', '')), '');
  v_participante_comercial_id := (p_payload->>'participante_comercial_id')::uuid;

  -- 4. Busca lead canônico existente (o mais antigo caso haja duplicados legados)
  select *
  into v_lead_rec
  from public.leads
  where telefone_normalizado = v_tel_norm
     or regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = v_tel_norm
  order by created_at asc
  limit 1;

  if v_lead_rec.id is not null then
    v_lead_id := v_lead_rec.id;
    v_action := 'updated';

    update public.leads
    set
      -- Atualiza nome se o existente for vazio ou genérico
      nome = case
        when (v_lead_rec.nome is null or trim(v_lead_rec.nome) = '' or lower(v_lead_rec.nome) = 'teste') and v_nome is not null then v_nome
        else coalesce(v_lead_rec.nome, v_nome)
      end,
      email = coalesce(v_lead_rec.email, v_email),
      cidade = coalesce(v_lead_rec.cidade, v_cidade),
      whatsapp = coalesce(v_lead_rec.whatsapp, v_raw_tel),
      telefone_normalizado = v_tel_norm,
      -- Enriquece simulação mais recente sem perder a anterior se a nova for nula
      valor_simulado = coalesce(v_valor_simulado, v_lead_rec.valor_simulado),
      prazo_simulado = coalesce(v_prazo_simulado, v_lead_rec.prazo_simulado),
      entrada = coalesce(v_entrada, v_lead_rec.entrada),
      renda = coalesce(v_renda, v_lead_rec.renda),
      valor_estimado = coalesce(v_valor_estimado, v_lead_rec.valor_estimado),
      tipo_interesse = coalesce(v_tipo_interesse, v_lead_rec.tipo_interesse),
      produto_interesse = coalesce(v_produto_interesse, v_lead_rec.produto_interesse),
      tipo_credito = coalesce(v_tipo_credito, v_lead_rec.tipo_credito),
      dados_simulacao = coalesce(v_dados_simulacao, v_lead_rec.dados_simulacao),
      resultado_resumido = coalesce(v_resultado_resumido, v_lead_rec.resultado_resumido),
      origem_detalhe = case
        when v_origem_detalhe is not null then v_origem_detalhe
        else v_lead_rec.origem_detalhe
      end,
      evento_id = coalesce(v_evento_id, v_lead_rec.evento_id),
      evento_nome = coalesce(v_evento_nome, v_lead_rec.evento_nome),
      imovel_id = coalesce(v_imovel_id, v_lead_rec.imovel_id),
      carta_contemplada_id = coalesce(v_carta_id, v_lead_rec.carta_contemplada_id),
      empresa_id = coalesce(v_lead_rec.empresa_id, v_empresa_id),
      parceiro_id = coalesce(v_lead_rec.parceiro_id, v_parceiro_id),
      participante_comercial_id = coalesce(v_lead_rec.participante_comercial_id, v_participante_comercial_id),
      host_origem = coalesce(v_lead_rec.host_origem, v_host_origem),
      pagina_origem = coalesce(v_lead_rec.pagina_origem, v_pagina_origem),
      utm_source = coalesce(v_lead_rec.utm_source, v_utm_source),
      utm_medium = coalesce(v_lead_rec.utm_medium, v_utm_medium),
      utm_campaign = coalesce(v_lead_rec.utm_campaign, v_utm_campaign),
      ultima_interacao_at = now(),
      updated_at = now()
    where id = v_lead_id;

  else
    v_action := 'created';

    insert into public.leads (
      nome,
      whatsapp,
      telefone_normalizado,
      email,
      cidade,
      origem,
      origem_detalhe,
      tipo_interesse,
      produto_interesse,
      tipo_credito,
      valor_simulado,
      prazo_simulado,
      entrada,
      renda,
      valor_estimado,
      dados_simulacao,
      resultado_resumido,
      status,
      empresa_id,
      parceiro_id,
      imovel_id,
      carta_contemplada_id,
      evento_id,
      evento_nome,
      host_origem,
      pagina_origem,
      utm_source,
      utm_medium,
      utm_campaign,
      participante_comercial_id,
      ultima_interacao_at,
      criado_manual
    ) values (
      coalesce(v_nome, 'Contato sem nome'),
      v_raw_tel,
      v_tel_norm,
      v_email,
      v_cidade,
      coalesce(v_origem, 'site'),
      v_origem_detalhe,
      v_tipo_interesse,
      v_produto_interesse,
      v_tipo_credito,
      v_valor_simulado,
      v_prazo_simulado,
      v_entrada,
      v_renda,
      v_valor_estimado,
      v_dados_simulacao,
      v_resultado_resumido,
      'Novo',
      v_empresa_id,
      v_parceiro_id,
      v_imovel_id,
      v_carta_id,
      v_evento_id,
      v_evento_nome,
      v_host_origem,
      v_pagina_origem,
      v_utm_source,
      v_utm_medium,
      v_utm_campaign,
      v_participante_comercial_id,
      now(),
      false
    )
    returning id into v_lead_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'action', v_action,
    'lead_id', v_lead_id,
    'telefone_normalizado', v_tel_norm
  );
end;
$$;
