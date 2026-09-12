-- ===========================================================================
-- Migration 220: Eventos — Check-in Conversacional, Número da Sorte,
--                Prêmios, Telão e Histórico de Qualificação no CRM
-- ===========================================================================

-- 1. Colunas de experiência conversacional e identidade visual em eventos
alter table public.eventos
  add column if not exists checkin_interativo_ativo boolean not null default false,
  add column if not exists cor_primaria text,
  add column if not exists cor_secundaria text,
  add column if not exists logo_personalizado_url text,
  add column if not exists prefixo_codigo_sorteio text default '';

comment on column public.eventos.checkin_interativo_ativo is 'Se true, exibe a experiência mobile conversacional passo a passo; se false (padrão seguro), preserva o formulário tradicional.';
comment on column public.eventos.cor_primaria is 'Cor primária customizada do evento (ex: #0066cc para Racon ou #f59e0b para Gauchinho). Se nula, usa a marca do tenant.';
comment on column public.eventos.cor_secundaria is 'Cor secundária customizada do evento.';
comment on column public.eventos.logo_personalizado_url is 'Logotipo específico do evento. Se nulo, usa o logotipo da marca do tenant.';
comment on column public.eventos.prefixo_codigo_sorteio is 'Prefixo opcional para os números da sorte (ex: RCN-, GCH-). Se vazio, gera números limpos (001, 002, 027).';

-- 2. Colunas de qualificação comercial e LGPD em eventos_sorteio_participantes (SEM contaminar nps_respostas)
alter table public.eventos_sorteio_participantes
  add column if not exists qualificacao_respostas jsonb,
  add column if not exists lgpd_termo_versao text default 'v1_checkin_evento',
  add column if not exists lgpd_consentimento_at timestamptz;

comment on column public.eventos_sorteio_participantes.qualificacao_respostas is 'Respostas das perguntas comerciais (veículo, moradia, investimento mensal). Separado de nps_respostas.';
comment on column public.eventos_sorteio_participantes.lgpd_termo_versao is 'Versão do termo de consentimento aceito no momento do check-in.';
comment on column public.eventos_sorteio_participantes.lgpd_consentimento_at is 'Data/hora exata do aceite do termo de consentimento.';

-- 3. Tabela de histórico auditável de qualificações e eventos por Lead (preserva múltiplos eventos sem sobrescrever)
create table if not exists public.leads_eventos_qualificacoes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  evento_id uuid not null references public.eventos (id) on delete cascade,
  evento_nome text not null,
  sorteio_participante_id uuid references public.eventos_sorteio_participantes (id) on delete set null,
  codigo_sorteio text not null,
  qualificacao_respostas jsonb not null default '{}'::jsonb,
  lgpd_termo_versao text not null default 'v1_checkin_evento',
  lgpd_consentimento_at timestamptz not null default now(),
  checkin_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists leads_eventos_qualificacoes_lead_idx on public.leads_eventos_qualificacoes (lead_id);
create index if not exists leads_eventos_qualificacoes_evento_idx on public.leads_eventos_qualificacoes (evento_id);
create index if not exists leads_eventos_qualificacoes_lead_evento_idx on public.leads_eventos_qualificacoes (lead_id, evento_id);

alter table public.leads_eventos_qualificacoes enable row level security;

drop policy if exists leads_eventos_qualificacoes_staff on public.leads_eventos_qualificacoes;
create policy leads_eventos_qualificacoes_staff on public.leads_eventos_qualificacoes
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());

-- 4. Tabela de prêmios simples por evento
create table if not exists public.eventos_premios (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  ordem integer not null default 1,
  titulo text not null,
  descricao text,
  imagem_url text,
  status text not null default 'pendente',
  ganhador_participante_id uuid references public.eventos_sorteio_participantes (id) on delete set null,
  sorteado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventos_premios_status_check check (status in ('pendente', 'sorteado', 'cancelado'))
);

create index if not exists eventos_premios_evento_ordem_idx on public.eventos_premios (evento_id, ordem);

alter table public.eventos_premios enable row level security;

drop policy if exists eventos_premios_staff on public.eventos_premios;
create policy eventos_premios_staff on public.eventos_premios
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());

drop policy if exists eventos_premios_public_select on public.eventos_premios;
create policy eventos_premios_public_select on public.eventos_premios
  for select to anon
  using (
    exists (
      select 1 from public.eventos e
      where e.id = evento_id and e.ativo = true and e.publicado = true
    )
  );

drop trigger if exists eventos_premios_updated_at on public.eventos_premios;
create trigger eventos_premios_updated_at before update on public.eventos_premios
  for each row execute function public.set_updated_at();

-- 5. RPC Atômica para Verificação Prévia de Presença no Evento
create or replace function public.rpc_consultar_checkin_evento(
  p_evento_id uuid,
  p_whatsapp text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tel_norm text;
  v_rec record;
begin
  v_tel_norm := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if v_tel_norm = '' or length(v_tel_norm) < 8 then
    return jsonb_build_object('ok', false, 'cadastrado', false, 'error', 'Telefone inválido');
  end if;

  select
    esp.id as participante_sorteio_id,
    esp.codigo,
    esp.nome,
    esp.status,
    ep.checkin_at
  into v_rec
  from public.eventos_sorteio_participantes esp
  left join public.eventos_participantes ep on ep.id = esp.evento_participante_id
  where esp.evento_id = p_evento_id
    and regexp_replace(esp.telefone, '\D', '', 'g') = v_tel_norm
    and esp.status = 'participando'
  limit 1;

  if v_rec.participante_sorteio_id is not null then
    return jsonb_build_object(
      'ok', true,
      'cadastrado', true,
      'nome', v_rec.nome,
      'codigo', v_rec.codigo,
      'checkin_at', v_rec.checkin_at
    );
  end if;

  return jsonb_build_object('ok', true, 'cadastrado', false);
end;
$$;

-- 6. RPC Atômica e Concorrente para Execução Completa do Check-in Mobile
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
  select id, nome, slug, ativo, prefixo_codigo_sorteio
  into v_evento_rec
  from public.eventos
  where id = p_evento_id;

  if v_evento_rec.id is null then
    return jsonb_build_object('ok', false, 'error', 'Evento não encontrado');
  end if;
  if not v_evento_rec.ativo then
    return jsonb_build_object('ok', false, 'error', 'Este evento não está mais ativo');
  end if;

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
    -- Se já existia, garante que o check-in esteja carimbado
    if v_existente.evento_participante_id is not null then
      update public.eventos_participantes
      set status = 'presente',
          checkin_at = coalesce(checkin_at, now()),
          updated_at = now()
      where id = v_existente.evento_participante_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'ja_cadastrado', true,
      'nome', v_existente.nome,
      'codigo', v_existente.codigo,
      'mensagem', 'Olá, ' || v_existente.nome || '! Sua presença já está confirmada.',
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
    -- Atualiza lead existente sem apagar informações anteriores
    update public.leads
    set ultima_interacao_at = now(),
        updated_at = now(),
        evento_id = coalesce(evento_id, p_evento_id),
        evento_nome = coalesce(evento_nome, v_evento_rec.nome)
    where id = v_lead_id;
  else
    -- Cria novo lead no CRM
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
      'evento_checkin',
      v_evento_rec.slug,
      p_evento_id,
      v_evento_rec.nome,
      v_tipo_credito,
      v_tipo_credito,
      v_valor_mensal,
      'Novo',
      jsonb_build_object(
        'origem', 'qr_checkin_conversacional',
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
      when codigo ~ '^[0-9]+$' then codigo::integer
      when codigo ~ '^[A-Za-z0-9]+-[0-9]+$' then substring(codigo from '[0-9]+$')::integer
      else 0
    end
  ), 0) + 1 into v_prox_num
  from public.eventos_sorteio_participantes
  where evento_id = p_evento_id;

  if v_prefixo <> '' then
    v_codigo := v_prefixo || lpad(v_prox_num::text, 3, '0');
  else
    v_codigo := lpad(v_prox_num::text, 3, '0');
  end if;

  -- 9. Auto Check-in em eventos_participantes (status = 'presente', checkin_at = now())
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
    'Check-in automático via QR Code interativo'
  )
  returning id into v_part_id;

  -- 10. Emissão do Número da Sorte em eventos_sorteio_participantes
  insert into public.eventos_sorteio_participantes (
    sorteio_id,
    evento_id,
    evento_participante_id,
    lead_id,
    codigo,
    nome,
    telefone,
    valor_mensal_disponivel,
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
    v_valor_mensal,
    'participando',
    false,
    'completo',
    'cadastro',
    p_qualificacao,
    p_lgpd_versao,
    now(),
    p_qr_code_unico_id
  )
  returning id into v_sorteio_part_id;

  -- 11. Preservação de Histórico no CRM (tabela leads_eventos_qualificacoes)
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
    p_lgpd_versao,
    now(),
    now()
  );

  -- 12. Registro de Atividade na Timeline do Lead (CRM)
  insert into public.lead_atividades (
    lead_id,
    tipo,
    titulo,
    descricao,
    status,
    data_conclusao
  )
  values (
    v_lead_id,
    'evento_checkin',
    'Presença confirmada no evento ' || v_evento_rec.nome,
    'Número da Sorte: ' || v_codigo ||
      E'\nQualificação:' ||
      E'\n• Veículo: ' || coalesce(p_qualificacao->>'veiculo', 'Não informado') ||
      E'\n• Moradia: ' || coalesce(p_qualificacao->>'moradia', 'Não informada') ||
      E'\n• Investimento mensal: ' || coalesce(p_qualificacao->>'capacidade_mensal', 'Não informado'),
    'concluida',
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'ja_cadastrado', false,
    'nome', p_nome,
    'codigo', v_codigo,
    'sorteio_participante_id', v_sorteio_part_id,
    'evento_nome', v_evento_rec.nome
  );
end;
$$;

-- 7. RPC para Confirmação de Vencedor com Vinculação de Prêmio Opcional
create or replace function public.rpc_confirmar_ganhador_com_premio(
  p_evento_id uuid,
  p_sorteio_id uuid,
  p_participante_id uuid,
  p_premio_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_part record;
  v_ordem integer;
  v_tel_norm text;
  v_premio_titulo text;
begin
  -- Apenas operadores autenticados (staff/master) ou service_role podem confirmar vencedores
  if not (
    coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    or (current_setting('role', true) = 'service_role')
    or public.is_master()
    or public.is_staff()
  ) then
    return jsonb_build_object('ok', false, 'error', 'Sem permissão para confirmar ganhador.');
  end if;

  select id, codigo, nome, telefone, status, ganhador
  into v_part
  from public.eventos_sorteio_participantes
  where id = p_participante_id
    and evento_id = p_evento_id
    and sorteio_id = p_sorteio_id;

  if v_part.id is null then
    return jsonb_build_object('ok', false, 'error', 'Participante não encontrado');
  end if;
  if v_part.status <> 'participando' then
    return jsonb_build_object('ok', false, 'error', 'Participante não está com status ativo');
  end if;
  if v_part.ganhador then
    return jsonb_build_object('ok', false, 'error', 'Participante já foi contemplado neste evento');
  end if;

  v_tel_norm := regexp_replace(v_part.telefone, '\D', '', 'g');

  -- 1. Vincula ao prêmio se fornecido (apenas se ainda estiver pendente - proteção atômica prévia)
  if p_premio_id is not null then
    update public.eventos_premios
    set status = 'sorteado',
        ganhador_participante_id = p_participante_id,
        sorteado_at = now(),
        updated_at = now()
    where id = p_premio_id
      and evento_id = p_evento_id
      and status = 'pendente'
    returning titulo into v_premio_titulo;

    if v_premio_titulo is null then
      return jsonb_build_object('ok', false, 'error', 'Este prêmio já foi sorteado.');
    end if;
  end if;

  -- 2. Marca todos os cupons do mesmo telefone como ganhador (impede segunda vitória)
  update public.eventos_sorteio_participantes
  set ganhador = true,
      sorteado_em = now(),
      updated_at = now()
  where evento_id = p_evento_id
    and sorteio_id = p_sorteio_id
    and regexp_replace(telefone, '\D', '', 'g') = v_tel_norm;

  -- 3. Determina ordem do sorteio
  select coalesce(count(*), 0) + 1 into v_ordem
  from public.eventos_sorteio_resultados
  where sorteio_id = p_sorteio_id;

  -- 4. Registra no histórico de resultados
  insert into public.eventos_sorteio_resultados (
    sorteio_id,
    evento_id,
    participante_id,
    codigo,
    nome,
    ordem
  )
  values (
    p_sorteio_id,
    p_evento_id,
    p_participante_id,
    v_part.codigo,
    v_part.nome,
    v_ordem
  );

  return jsonb_build_object(
    'ok', true,
    'codigo', v_part.codigo,
    'nome', v_part.nome,
    'ordem', v_ordem,
    'premio_titulo', v_premio_titulo
  );
end;
$$;

-- 8. Permissões estritas de execução (princípio do menor privilégio)
revoke execute on function public.rpc_confirmar_ganhador_com_premio(uuid, uuid, uuid, uuid) from public;
revoke execute on function public.rpc_confirmar_ganhador_com_premio(uuid, uuid, uuid, uuid) from anon;
grant execute on function public.rpc_confirmar_ganhador_com_premio(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.rpc_confirmar_ganhador_com_premio(uuid, uuid, uuid, uuid) to service_role;

grant execute on function public.rpc_consultar_checkin_evento(uuid, text) to anon, authenticated, service_role;
grant execute on function public.rpc_realizar_checkin_conversacional(uuid, text, text, jsonb, text, uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

