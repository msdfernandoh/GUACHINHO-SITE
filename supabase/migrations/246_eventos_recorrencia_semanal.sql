-- Fase 261: eventos recorrentes semanais.
-- Cada edição permanece um evento independente: participantes, sorteio, leads
-- e resultados nunca são copiados para a edição seguinte.

alter table public.eventos
  add column if not exists recorrencia_ativa boolean not null default false,
  add column if not exists recorrencia_frequencia text,
  add column if not exists recorrencia_dia_semana smallint,
  add column if not exists recorrencia_raiz_id uuid references public.eventos(id) on delete set null,
  add column if not exists recorrencia_nome_base text,
  add column if not exists recorrencia_slug_base text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eventos_recorrencia_frequencia_check'
  ) then
    alter table public.eventos add constraint eventos_recorrencia_frequencia_check
      check (recorrencia_frequencia is null or recorrencia_frequencia = 'semanal');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'eventos_recorrencia_dia_semana_check'
  ) then
    alter table public.eventos add constraint eventos_recorrencia_dia_semana_check
      check (recorrencia_dia_semana is null or recorrencia_dia_semana between 0 and 6);
  end if;
end $$;

create index if not exists eventos_recorrencia_raiz_data_idx
  on public.eventos (recorrencia_raiz_id, data_evento desc)
  where recorrencia_ativa = true;

-- O Network de Negócios já recorrente às terças passa a ser a primeira agenda
-- automática. Não altera dados históricos nem cria uma edição nesta migration.
update public.eventos
set
  recorrencia_ativa = true,
  recorrencia_frequencia = 'semanal',
  recorrencia_dia_semana = 2,
  recorrencia_raiz_id = id,
  recorrencia_nome_base = regexp_replace(nome, E'\\s+[—-]\\s+\\d{1,2}/\\d{1,2}(/\\d{2,4})?$', ''),
  recorrencia_slug_base = regexp_replace(slug, E'-\\d{4}-\\d{2}-\\d{2}$', '')
where recorrencia_ativa = false
  and extract(dow from data_evento at time zone 'America/Cuiaba') = 2
  and nome ilike '%network%';

create or replace function public.rpc_gerar_proxima_edicao_evento(
  p_evento_id uuid,
  p_forcar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_origem public.eventos%rowtype;
  v_ultima public.eventos%rowtype;
  v_nova_id uuid;
  v_proxima_data timestamptz;
  v_raiz_id uuid;
  v_nome_base text;
  v_slug_base text;
  v_slug text;
  v_data_label text;
  v_qr record;
begin
  if not (
    coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    or current_setting('role', true) = 'service_role'
    or public.is_master()
    or public.is_staff()
  ) then
    return jsonb_build_object('ok', false, 'error', 'Sem permissão para gerar edição recorrente.');
  end if;

  select * into v_origem from public.eventos where id = p_evento_id for update;
  if v_origem.id is null then
    return jsonb_build_object('ok', false, 'error', 'Evento não encontrado.');
  end if;
  if not v_origem.recorrencia_ativa or v_origem.recorrencia_frequencia <> 'semanal' then
    return jsonb_build_object('ok', false, 'error', 'Este evento não está configurado como semanal.');
  end if;

  v_raiz_id := coalesce(v_origem.recorrencia_raiz_id, v_origem.id);
  perform pg_advisory_xact_lock(hashtext('evento_recorrente_' || v_raiz_id::text));

  select * into v_ultima
  from public.eventos
  where coalesce(recorrencia_raiz_id, id) = v_raiz_id
  order by data_evento desc nulls last, created_at desc
  limit 1
  for update;

  if v_ultima.data_evento is null then
    return jsonb_build_object('ok', false, 'error', 'Defina a data da edição atual antes de ativar a recorrência.');
  end if;
  -- A geração manual deve abrir a próxima edição já preparada, nunca saltar
  -- outra semana quando o agendador já a criou.
  if v_ultima.data_evento > now() then
    return jsonb_build_object('ok', true, 'created', false, 'id', v_ultima.id, 'message', 'A próxima edição já está criada.');
  end if;

  v_proxima_data := v_ultima.data_evento + interval '7 days';
  select id into v_nova_id
  from public.eventos
  where coalesce(recorrencia_raiz_id, id) = v_raiz_id
    and data_evento = v_proxima_data
  limit 1;
  if v_nova_id is not null then
    return jsonb_build_object('ok', true, 'created', false, 'id', v_nova_id, 'message', 'A próxima edição já está criada.');
  end if;

  v_nome_base := coalesce(nullif(trim(v_origem.recorrencia_nome_base), ''), regexp_replace(v_origem.nome, E'\\s+[—-]\\s+\\d{1,2}/\\d{1,2}(/\\d{2,4})?$', ''));
  v_slug_base := coalesce(nullif(trim(v_origem.recorrencia_slug_base), ''), regexp_replace(v_origem.slug, E'-\\d{4}-\\d{2}-\\d{2}$', ''));
  v_data_label := to_char(v_proxima_data at time zone 'America/Cuiaba', 'DD/MM');
  v_slug := v_slug_base || '-' || to_char(v_proxima_data at time zone 'America/Cuiaba', 'YYYY-MM-DD');

  insert into public.eventos (
    nome, slug, descricao_curta, descricao, data_evento, local, endereco, cidade, estado,
    imagem_capa_url, banner_url, ativo, publicado, somente_por_link, evento_destaque,
    limite_participantes, permitir_acompanhante, exigir_convidou, mostrar_vagas,
    mensagem_confirmacao, observacoes_internas, inscricao_tipo, inscricao_url_externa,
    leads_acesso_todos, checkin_interativo_ativo, checkin_modo,
    checkin_abertura_antecipada_minutos, cor_primaria, cor_secundaria,
    logo_personalizado_url, prefixo_codigo_sorteio, recorrencia_ativa,
    recorrencia_frequencia, recorrencia_dia_semana, recorrencia_raiz_id,
    recorrencia_nome_base, recorrencia_slug_base
  ) values (
    v_nome_base || ' — ' || v_data_label, v_slug, v_ultima.descricao_curta, v_ultima.descricao,
    v_proxima_data, v_ultima.local, v_ultima.endereco, v_ultima.cidade, v_ultima.estado,
    v_ultima.imagem_capa_url, v_ultima.banner_url, true, v_ultima.publicado,
    v_ultima.somente_por_link, v_ultima.evento_destaque, v_ultima.limite_participantes,
    v_ultima.permitir_acompanhante, v_ultima.exigir_convidou, v_ultima.mostrar_vagas,
    v_ultima.mensagem_confirmacao, v_ultima.observacoes_internas, v_ultima.inscricao_tipo,
    v_ultima.inscricao_url_externa, v_ultima.leads_acesso_todos,
    v_ultima.checkin_interativo_ativo, 'agendado',
    v_ultima.checkin_abertura_antecipada_minutos, v_ultima.cor_primaria,
    v_ultima.cor_secundaria, v_ultima.logo_personalizado_url, v_ultima.prefixo_codigo_sorteio,
    true, 'semanal', v_origem.recorrencia_dia_semana, v_raiz_id, v_nome_base, v_slug_base
  ) returning id into v_nova_id;

  -- Responsáveis pelos leads são configuração operacional; participantes e
  -- sorteios não são copiados para preservar a independência de cada edição.
  insert into public.eventos_leads_usuarios (evento_id, usuario_id)
  select v_nova_id, usuario_id from public.eventos_leads_usuarios where evento_id = v_ultima.id;

  -- Mantém o QR físico permanente: encerra o vínculo anterior e cria um novo
  -- com o mesmo intervalo relativo ao horário da próxima edição.
  if v_ultima.data_evento <= now() then
    select * into v_qr from public.qr_codes_unicos_vinculos
    where evento_id = v_ultima.id and ativo = true
    limit 1 for update;
    if v_qr.id is not null then
      update public.qr_codes_unicos_vinculos set ativo = false, updated_at = now() where id = v_qr.id;
      insert into public.qr_codes_unicos_vinculos (qr_code_id, evento_id, periodo_inicio, periodo_fim, ativo)
      values (
        v_qr.qr_code_id,
        v_nova_id,
        v_proxima_data + (v_qr.periodo_inicio - v_ultima.data_evento),
        v_proxima_data + (v_qr.periodo_fim - v_ultima.data_evento),
        true
      );
    end if;
    update public.eventos
    set ativo = false, evento_destaque = false, checkin_modo = 'encerrado', updated_at = now()
    where id = v_ultima.id;
  end if;

  return jsonb_build_object('ok', true, 'created', true, 'id', v_nova_id, 'data_evento', v_proxima_data);
end;
$$;

create or replace function public.rpc_processar_eventos_recorrentes()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evento record;
  v_resultado jsonb;
  v_resultados jsonb := '[]'::jsonb;
begin
  if not (
    coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    or current_setting('role', true) = 'service_role'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Rotina exclusiva do agendador.');
  end if;

  for v_evento in
    select id from public.eventos
    where recorrencia_ativa = true
      and coalesce(recorrencia_raiz_id, id) = id
      and recorrencia_frequencia = 'semanal'
  loop
    v_resultado := public.rpc_gerar_proxima_edicao_evento(v_evento.id, false);
    v_resultados := v_resultados || jsonb_build_array(v_resultado || jsonb_build_object('origem_id', v_evento.id));
  end loop;
  return jsonb_build_object('ok', true, 'resultados', v_resultados);
end;
$$;

revoke execute on function public.rpc_gerar_proxima_edicao_evento(uuid, boolean) from public, anon;
grant execute on function public.rpc_gerar_proxima_edicao_evento(uuid, boolean) to authenticated, service_role;
revoke execute on function public.rpc_processar_eventos_recorrentes() from public, anon, authenticated;
grant execute on function public.rpc_processar_eventos_recorrentes() to service_role;

notify pgrst, 'reload schema';
