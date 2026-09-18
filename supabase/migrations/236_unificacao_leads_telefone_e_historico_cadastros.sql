-- Migration 236: Unificação de Leads por Telefone e Histórico Cronológico de Abordagens
-- Garante que cadastros com o mesmo telefone sejam consolidados, acumulando
-- todas as informações (eventos, valor de investimento, tipo de investimento) com data na frente.

-- 1. Adiciona coluna historico_cadastros na tabela leads
alter table public.leads add column if not exists historico_cadastros text;

-- 2. Atualiza a RPC atômica de upsert com acumulação cronológica
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
  v_entry_date text;
  v_origem_txt text;
  v_tipo_inv text;
  v_valor_txt text;
  v_entrada_txt text;
  v_new_entry text;
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
  v_valor_simulado := nullif(p_payload->>'valor_simulado', '')::numeric;
  v_prazo_simulado := nullif(p_payload->>'prazo_simulado', '')::integer;
  v_entrada := nullif(p_payload->>'entrada', '')::numeric;
  v_renda := nullif(p_payload->>'renda', '')::numeric;
  v_valor_estimado := nullif(p_payload->>'valor_estimado', '')::numeric;
  v_dados_simulacao := p_payload->'dados_simulacao';
  v_resultado_resumido := nullif(trim(coalesce(p_payload->>'resultado_resumido', '')), '');
  v_empresa_id := nullif(p_payload->>'empresa_id', '')::uuid;
  v_parceiro_id := nullif(p_payload->>'parceiro_id', '')::uuid;
  v_imovel_id := nullif(p_payload->>'imovel_id', '')::uuid;
  v_carta_id := nullif(p_payload->>'carta_contemplada_id', '')::uuid;
  v_evento_id := nullif(p_payload->>'evento_id', '')::uuid;
  v_evento_nome := nullif(trim(coalesce(p_payload->>'evento_nome', '')), '');
  v_host_origem := nullif(trim(coalesce(p_payload->>'host_origem', '')), '');
  v_pagina_origem := nullif(trim(coalesce(p_payload->>'pagina_origem', '')), '');
  v_utm_source := nullif(trim(coalesce(p_payload->>'utm_source', '')), '');
  v_utm_medium := nullif(trim(coalesce(p_payload->>'utm_medium', '')), '');
  v_utm_campaign := nullif(trim(coalesce(p_payload->>'utm_campaign', '')), '');
  v_participante_comercial_id := nullif(p_payload->>'participante_comercial_id', '')::uuid;

  -- 4. Construção do bloco de histórico formatado com data na frente
  v_entry_date := to_char(now() at time zone 'America/Cuiaba', 'DD/MM/YYYY HH24:MI');
  v_origem_txt := coalesce(v_evento_nome, v_origem_detalhe, v_origem, 'Novo contato');
  v_tipo_inv := coalesce(v_produto_interesse, v_tipo_interesse, v_tipo_credito);

  if coalesce(v_valor_estimado, v_valor_simulado) is not null then
    v_valor_txt := 'R$ ' || trim(to_char(coalesce(v_valor_estimado, v_valor_simulado), 'FM999G999G990D00'));
  end if;

  if v_entrada is not null and v_entrada > 0 then
    v_entrada_txt := 'R$ ' || trim(to_char(v_entrada, 'FM999G999G990D00'));
  end if;

  v_new_entry := '[' || v_entry_date || '] Nova abordagem / cadastro (' || v_origem_txt || '):';
  if v_evento_nome is not null then
    v_new_entry := v_new_entry || E'\n• Evento: ' || v_evento_nome;
  end if;
  if v_tipo_inv is not null then
    v_new_entry := v_new_entry || E'\n• Tipo de investimento / interesse: ' || v_tipo_inv;
  end if;
  if v_valor_txt is not null then
    v_new_entry := v_new_entry || E'\n• Valor disponível / pretendido: ' || v_valor_txt;
  end if;
  if v_entrada_txt is not null then
    v_new_entry := v_new_entry || E'\n• Entrada disponível: ' || v_entrada_txt;
  end if;
  if p_payload->>'capacidade_mensal' is not null and trim(p_payload->>'capacidade_mensal') != '' then
    v_new_entry := v_new_entry || E'\n• Capacidade mensal de parcela: ' || (p_payload->>'capacidade_mensal');
  end if;
  if v_prazo_simulado is not null and v_prazo_simulado > 0 then
    v_new_entry := v_new_entry || E'\n• Prazo pretendido: ' || v_prazo_simulado || ' meses';
  end if;
  if v_cidade is not null then
    v_new_entry := v_new_entry || E'\n• Cidade: ' || v_cidade;
  end if;
  if p_payload->>'observacoes' is not null and trim(p_payload->>'observacoes') != '' then
    v_new_entry := v_new_entry || E'\n• Observações: ' || trim(p_payload->>'observacoes');
  end if;

  -- 5. Busca lead canônico existente pelo telefone
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
      -- Preserva nome antigo a menos que o novo seja mais completo ou o antigo seja genérico
      nome = case
        when (v_lead_rec.nome is null or trim(v_lead_rec.nome) = '' or lower(v_lead_rec.nome) = 'teste') and v_nome is not null then v_nome
        else coalesce(v_lead_rec.nome, v_nome)
      end,
      email = coalesce(v_lead_rec.email, v_email),
      cidade = coalesce(v_lead_rec.cidade, v_cidade),
      whatsapp = coalesce(v_lead_rec.whatsapp, v_raw_tel),
      telefone_normalizado = v_tel_norm,
      -- Enriquece com simulação/valores mais recentes sem perder o histórico no campo acumulativo
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
      -- Concatena histórico acumulativo no topo com separador
      historico_cadastros = case
        when v_lead_rec.historico_cadastros is not null and trim(v_lead_rec.historico_cadastros) != ''
          then v_new_entry || E'\n\n---\n\n' || v_lead_rec.historico_cadastros
        else v_new_entry
      end,
      observacoes = case
        when v_lead_rec.observacoes is not null and trim(v_lead_rec.observacoes) != ''
          then v_new_entry || E'\n\n---\n\n' || v_lead_rec.observacoes
        else v_new_entry
      end,
      ultima_interacao_at = now(),
      data_ultimo_contato = now(),
      updated_at = now()
    where id = v_lead_id;

    -- Registro auditável em leads_historico
    insert into public.leads_historico (
      lead_id,
      acao,
      descricao,
      dados_novos
    ) values (
      v_lead_id,
      'lead_recorrente_unificado',
      'Novo cadastro/interação unificado pelo telefone (' || v_origem_txt || ')',
      p_payload
    );

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
      historico_cadastros,
      observacoes,
      ultima_interacao_at,
      data_ultimo_contato,
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
      coalesce(nullif(trim(p_payload->>'status'), ''), 'Novo'),
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
      v_new_entry,
      v_new_entry,
      now(),
      now(),
      false
    )
    returning id into v_lead_id;

    -- Registro auditável em leads_historico
    insert into public.leads_historico (
      lead_id,
      acao,
      descricao,
      dados_novos
    ) values (
      v_lead_id,
      'lead_criado_telefone',
      'Lead criado via cadastro/interação (' || v_origem_txt || ')',
      p_payload
    );

  end if;

  return jsonb_build_object(
    'ok', true,
    'action', v_action,
    'lead_id', v_lead_id,
    'telefone_normalizado', v_tel_norm
  );
end;
$$;
