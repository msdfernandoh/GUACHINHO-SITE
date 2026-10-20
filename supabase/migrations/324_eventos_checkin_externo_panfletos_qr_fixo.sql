-- ===========================================================================
-- Migration 324: Check-in de Trabalho Externo / Panfletagem (Rua e Empresas)
--                & QR Code Fixo Permanente (/qr/externo)
-- ===========================================================================

-- 1. Coluna de tipo de checkin na tabela public.eventos
alter table public.eventos
  add column if not exists tipo_checkin text not null default 'evento';

comment on column public.eventos.tipo_checkin is 'Tipo da ação: "evento" (presencial/palestra) ou "externo" (panfletos rua/empresas).';

-- Constraint de tipos permitidos
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'eventos_tipo_checkin_check'
  ) then
    alter table public.eventos
      add constraint eventos_tipo_checkin_check check (tipo_checkin in ('evento', 'externo'));
  end if;
end $$;

-- 2. Trigger para garantir que apenas 1 evento externo fique ativo simultaneamente
create or replace function public.fn_garantir_unico_evento_externo_ativo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo_checkin = 'externo' and new.ativo = true then
    update public.eventos
    set ativo = false,
        updated_at = now()
    where tipo_checkin = 'externo'
      and ativo = true
      and id <> new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_garantir_unico_evento_externo_ativo on public.eventos;
create trigger trg_garantir_unico_evento_externo_ativo
  before insert or update of tipo_checkin, ativo
  on public.eventos
  for each row
  execute function public.fn_garantir_unico_evento_externo_ativo();

-- 3. Atualizar check constraint de tipo_destino em qr_codes_unicos para aceitar 'externo'
alter table public.qr_codes_unicos
  drop constraint if exists qr_codes_unicos_tipo_destino_check;

alter table public.qr_codes_unicos
  add constraint qr_codes_unicos_tipo_destino_check
  check (tipo_destino in ('site', 'externo', 'evento', 'checkin_evento', 'whatsapp', 'pagina_interna', 'custom'));

-- 4. Garantir o QR Code Fixo permanente de trabalho externo (/qr/externo)
insert into public.qr_codes_unicos (nome, slug, tipo_destino, ativo)
values ('QR Fixo — Trabalho Externo (Panfletos / Empresas)', 'externo', 'externo', true)
on conflict (slug) do update set tipo_destino = 'externo', ativo = true, updated_at = now();

-- 5. Atualizar RPC de Check-in Conversacional para lidar com evento e externo
create or replace function public.rpc_realizar_checkin_conversacional(
  p_evento_id uuid,
  p_nome text,
  p_whatsapp text,
  p_qualificacao jsonb default '{}'::jsonb,
  p_lgpd_versao text default 'v1_checkin_evento',
  p_qr_code_unico_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tel_norm text;
  v_evento_rec record;
  v_sorteio_id uuid;
  v_prefixo text;
  v_existente record;
  v_lead_id uuid;
  v_part_id uuid;
  v_sorteio_part_id uuid;
  v_prox_num integer;
  v_codigo text;
  v_tipo_credito text;
  v_valor_mensal numeric(14,2);
  v_capacidade text;
  v_is_externo boolean;
  v_msg_cadastrado text;
begin
  -- 1. Normalização de dados
  p_nome := trim(coalesce(p_nome, ''));
  v_tel_norm := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');

  if p_nome = '' then
    return jsonb_build_object('ok', false, 'error', 'Nome é obrigatório');
  end if;
  if length(v_tel_norm) < 10 then
    return jsonb_build_object('ok', false, 'error', 'WhatsApp inválido. Informe DDD + número.');
  end if;

  -- 2. Bloqueio Transacional por Evento para Garantir Zero Concorrência na Emissão de Números
  perform pg_advisory_xact_lock(hashtext('checkin_evento_' || p_evento_id::text));

  -- 3. Validação do Evento
  select id, nome, slug, ativo, prefixo_codigo_sorteio, tipo_checkin
  into v_evento_rec
  from public.eventos
  where id = p_evento_id;

  if v_evento_rec.id is null then
    return jsonb_build_object('ok', false, 'error', 'Evento não encontrado');
  end if;
  if not v_evento_rec.ativo then
    return jsonb_build_object('ok', false, 'error', 'Esta campanha ou evento não está mais ativo');
  end if;

  v_is_externo := coalesce(v_evento_rec.tipo_checkin, 'evento') = 'externo';
  v_prefixo := trim(coalesce(v_evento_rec.prefixo_codigo_sorteio, ''));

  -- 4. Garantir que a campanha de sorteio exista para o evento
  select id into v_sorteio_id
  from public.eventos_sorteios
  where evento_id = p_evento_id;

  if v_sorteio_id is null then
    insert into public.eventos_sorteios (evento_id, ativo, titulo, status)
    values (p_evento_id, true, 'Sorteio — ' || v_evento_rec.nome, 'aberto')
    returning id into v_sorteio_id;
  end if;

  -- 5. Verificação de Duplicidade no Evento (evento_id + telefone)
  select
    esp.id as sorteio_part_id,
    esp.codigo,
    esp.nome,
    esp.evento_participante_id,
    ep.checkin_at
  into v_existente
  from public.eventos_sorteio_participantes esp
  left join public.eventos_participantes ep on ep.id = esp.evento_participante_id
  where esp.evento_id = p_evento_id
    and regexp_replace(esp.telefone, '\D', '', 'g') = v_tel_norm
    and esp.status = 'participando'
  limit 1;

  if v_existente.sorteio_part_id is not null then
    if v_existente.evento_participante_id is not null then
      update public.eventos_participantes
      set status = 'presente',
          checkin_at = coalesce(checkin_at, now()),
          updated_at = now()
      where id = v_existente.evento_participante_id;
    end if;

    if v_is_externo then
      v_msg_cadastrado := 'Olá, ' || v_existente.nome || '! Seu cadastro já está confirmado.';
    else
      v_msg_cadastrado := 'Olá, ' || v_existente.nome || '! Sua presença já está confirmada.';
    end if;

    return jsonb_build_object(
      'ok', true,
      'ja_cadastrado', true,
      'nome', v_existente.nome,
      'codigo', v_existente.codigo,
      'mensagem', v_msg_cadastrado,
      'sorteio_participante_id', v_existente.sorteio_part_id
    );
  end if;

  -- 6. Mapeamento da Qualificação Comercial para Lead CRM
  v_capacidade := coalesce(p_qualificacao->>'capacidade_mensal', '');
  v_valor_mensal := case
    when v_capacidade = 'ate_500' then 500.00
    when v_capacidade = '500_1000' then 1000.00
    when v_capacidade = '1000_2000' then 2000.00
    when v_capacidade = 'acima_2000' then 3000.00
    else null
  end;

  v_tipo_credito := case
    when p_qualificacao->>'veiculo' in ('carro', 'moto', 'carro_moto') then 'Veículo'
    when p_qualificacao->>'moradia' in ('propria_financiada', 'aluguel') then 'Imóvel'
    else 'Consórcio Geral'
  end;

  -- 7. Localizar ou Criar Lead Preservando Histórico
  select id into v_lead_id
  from public.leads
  where regexp_replace(whatsapp, '\D', '', 'g') = v_tel_norm
  order by created_at desc
  limit 1;

  if v_lead_id is not null then
    update public.leads
    set ultima_interacao_at = now(),
        updated_at = now(),
        evento_id = coalesce(evento_id, p_evento_id),
        evento_nome = coalesce(evento_nome, v_evento_rec.nome)
    where id = v_lead_id;
  else
    insert into public.leads (
      nome,
      whatsapp,
      origem,
      origem_detalhe,
      evento_id,
      evento_nome,
      tipo_interesse,
      tipo_credito,
      valor_estimado,
      status,
      dados_simulacao,
      criado_manual
    )
    values (
      p_nome,
      p_whatsapp,
      case when v_is_externo then 'panfleto_externo' else 'evento_checkin' end,
      v_evento_rec.slug,
      p_evento_id,
      v_evento_rec.nome,
      v_tipo_credito,
      v_tipo_credito,
      v_valor_mensal,
      'Novo',
      jsonb_build_object(
        'origem', case when v_is_externo then 'qr_externo_panfleto' else 'qr_checkin_conversacional' end,
        'tipo_checkin', coalesce(v_evento_rec.tipo_checkin, 'evento'),
        'evento_id', p_evento_id,
        'evento_nome', v_evento_rec.nome,
        'qualificacao', p_qualificacao,
        'qr_code_unico_id', p_qr_code_unico_id
      ),
      false
    )
    returning id into v_lead_id;
  end if;

  -- 8. Calcular Próximo Número Sequencial Seguro para Este Evento
  select coalesce(max(
    case
      when v_prefixo <> '' and esp.codigo like (v_prefixo || '%')
        then nullif(regexp_replace(substring(esp.codigo from (length(v_prefixo) + 1)), '\D', '', 'g'), '')::integer
      else
        nullif(regexp_replace(esp.codigo, '\D', '', 'g'), '')::integer
    end
  ), 0) + 1
  into v_prox_num
  from public.eventos_sorteio_participantes esp
  where esp.evento_id = p_evento_id;

  if v_prefixo <> '' then
    v_codigo := v_prefixo || lpad(v_prox_num::text, 3, '0');
  else
    v_codigo := lpad(v_prox_num::text, 3, '0');
  end if;

  -- 9. Registrar Presença Oficial
  insert into public.eventos_participantes (
    evento_id,
    lead_id,
    nome_participante,
    telefone_participante,
    status,
    checkin_at,
    quantidade_vagas,
    observacao
  )
  values (
    p_evento_id,
    v_lead_id,
    p_nome,
    p_whatsapp,
    'presente',
    now(),
    1,
    case when v_is_externo then 'Cadastro via QR Code externo (panfleto)' else 'Check-in via QR Code conversacional' end
  )
  returning id into v_part_id;

  -- 10. Emissão do Número da Sorte
  insert into public.eventos_sorteio_participantes (
    sorteio_id,
    evento_id,
    evento_participante_id,
    lead_id,
    codigo,
    nome,
    telefone,
    status,
    ganhador,
    fase_cadastro,
    origem_cupom,
    qualificacao_respostas,
    lgpd_termo_versao,
    lgpd_consentimento_at,
    qr_code_unico_id
  )
  values (
    v_sorteio_id,
    p_evento_id,
    v_part_id,
    v_lead_id,
    v_codigo,
    p_nome,
    p_whatsapp,
    'participando',
    false,
    'completo',
    'cadastro',
    p_qualificacao,
    coalesce(p_lgpd_versao, case when v_is_externo then 'v1_panfleto_externo' else 'v1_checkin_evento' end),
    now(),
    p_qr_code_unico_id
  )
  returning id into v_sorteio_part_id;

  -- 11. Histórico Auditável
  insert into public.leads_eventos_qualificacoes (
    lead_id,
    evento_id,
    evento_nome,
    sorteio_participante_id,
    codigo_sorteio,
    qualificacao_respostas,
    lgpd_termo_versao,
    lgpd_consentimento_at,
    checkin_at
  )
  values (
    v_lead_id,
    p_evento_id,
    v_evento_rec.nome,
    v_sorteio_part_id,
    v_codigo,
    p_qualificacao,
    coalesce(p_lgpd_versao, case when v_is_externo then 'v1_panfleto_externo' else 'v1_checkin_evento' end),
    now(),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'ja_cadastrado', false,
    'nome', p_nome,
    'codigo', v_codigo,
    'evento_nome', v_evento_rec.nome,
    'lead_id', v_lead_id,
    'sorteio_participante_id', v_sorteio_part_id,
    'tipo_checkin', coalesce(v_evento_rec.tipo_checkin, 'evento')
  );
end;
$$;
