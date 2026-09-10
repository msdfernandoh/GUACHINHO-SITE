-- 218 — Conversão de Proposta em Contratação no SaaS (Login, ERP e Site)
-- Permite converter atomicamente uma proposta existente em contratações_online,
-- copiando documentos, preservando dados e atualizando o status para 'Contratada'.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_converter_proposta_em_contratacao(
  p_empresa_id uuid,
  p_proposta_id uuid,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS public.contratacoes_online
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_proposta public.propostas%ROWTYPE;
  v_existente public.contratacoes_online%ROWTYPE;
  v_nova public.contratacoes_online%ROWTYPE;
  v_preenchimento jsonb;
  v_protocolo text;
  v_token text;
  v_origem text;
  v_tipo_pessoa text;
  v_forma_pagamento text;
BEGIN
  SELECT * INTO v_proposta
  FROM public.propostas
  WHERE id = p_proposta_id
  FOR UPDATE;

  IF NOT FOUND OR v_proposta.empresa_id IS DISTINCT FROM p_empresa_id THEN
    RAISE EXCEPTION 'Proposta não encontrada neste tenant';
  END IF;

  -- Se já existe contratação vinculada a esta proposta, garante o status 'Contratada' e retorna a existente
  SELECT * INTO v_existente
  FROM public.contratacoes_online
  WHERE proposta_id = p_proposta_id;

  IF FOUND THEN
    UPDATE public.propostas
    SET status = 'Contratada', updated_at = now()
    WHERE id = p_proposta_id;
    RETURN v_existente;
  END IF;

  v_preenchimento := COALESCE(v_proposta.preenchimento_contratacao, '{}'::jsonb);

  -- Define origem válida ('simulador' ou 'grupos')
  v_origem := CASE
    WHEN v_proposta.origem_contratacao IN ('simulador', 'grupos') THEN v_proposta.origem_contratacao
    WHEN v_proposta.tipo_proposta ILIKE '%grupo%' THEN 'grupos'
    ELSE 'simulador'
  END;

  -- Gera protocolo padrão GC-YYYY-XXXXXX
  v_protocolo := 'GC-' || to_char(clock_timestamp(), 'YYYY') || '-' ||
    lpad(nextval('public.contratacao_protocolo_seq')::text, 6, '0');

  -- Token público único
  v_token := COALESCE(
    NULLIF(trim(v_proposta.public_token), ''),
    'ct_' || encode(gen_random_bytes(16), 'hex')
  );

  IF EXISTS (SELECT 1 FROM public.contratacoes_online WHERE public_token = v_token) THEN
    v_token := 'ct_' || encode(gen_random_bytes(16), 'hex');
  END IF;

  -- Tipo de pessoa sanitizado
  v_tipo_pessoa := NULLIF(trim(v_preenchimento->>'tipo_pessoa'), '');
  IF v_tipo_pessoa NOT IN ('cpf', 'cnpj') THEN
    v_tipo_pessoa := CASE
      WHEN length(regexp_replace(COALESCE(v_preenchimento->>'cnpj', ''), '[^0-9]', '', 'g')) = 14 THEN 'cnpj'
      ELSE 'cpf'
    END;
  END IF;

  -- Forma de pagamento sanitizada
  v_forma_pagamento := NULLIF(trim(v_preenchimento->>'forma_pagamento'), '');
  IF v_forma_pagamento NOT IN ('pix', 'boleto', 'cartao') THEN
    v_forma_pagamento := NULL;
  END IF;

  INSERT INTO public.contratacoes_online (
    proposta_id,
    empresa_id,
    public_token,
    protocolo,
    origem,
    status,
    lead_id,
    gerado_por_usuario_id,
    gerado_por_nome,
    gerado_por_email,
    nome,
    telefone,
    email,
    tipo_pessoa,
    cpf,
    data_nascimento,
    razao_social,
    cnpj,
    responsavel_nome,
    responsavel_cpf,
    cep,
    endereco,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    tipo_bem,
    credito_selecionado,
    parcela_estimada,
    prazo,
    grupo_id,
    grupo_nome,
    administradora,
    cota_id,
    dados_simulacao,
    forma_pagamento,
    observacao_cliente,
    confirmado_em,
    finalizado_em,
    contrato_assinado,
    contrato_assinado_em,
    participante_comercial_id,
    organizacao_parceira_id
  ) VALUES (
    v_proposta.id,
    v_proposta.empresa_id,
    v_token,
    v_protocolo,
    v_origem,
    'aguardando_consultor',
    v_proposta.lead_id,
    COALESCE(p_usuario_id, NULLIF(v_preenchimento->>'gerado_por_usuario_id', '')::uuid),
    v_proposta.consultor_nome,
    v_proposta.consultor_email,
    COALESCE(NULLIF(trim(v_proposta.nome_cliente), ''), 'Cliente não informado'),
    regexp_replace(COALESCE(v_proposta.whatsapp_cliente, ''), '[^0-9]', '', 'g'),
    COALESCE(NULLIF(trim(v_preenchimento->>'email'), ''), NULLIF(trim(v_proposta.email_cliente), '')),
    v_tipo_pessoa,
    NULLIF(regexp_replace(COALESCE(v_preenchimento->>'cpf', ''), '[^0-9]', '', 'g'), ''),
    NULLIF(v_preenchimento->>'data_nascimento', '')::date,
    NULLIF(trim(v_preenchimento->>'razao_social'), ''),
    NULLIF(regexp_replace(COALESCE(v_preenchimento->>'cnpj', ''), '[^0-9]', '', 'g'), ''),
    NULLIF(trim(v_preenchimento->>'responsavel_nome'), ''),
    NULLIF(regexp_replace(COALESCE(v_preenchimento->>'responsavel_cpf', ''), '[^0-9]', '', 'g'), ''),
    NULLIF(trim(v_preenchimento->>'cep'), ''),
    NULLIF(trim(v_preenchimento->>'endereco'), ''),
    NULLIF(trim(v_preenchimento->>'numero'), ''),
    NULLIF(trim(v_preenchimento->>'complemento'), ''),
    NULLIF(trim(v_preenchimento->>'bairro'), ''),
    COALESCE(NULLIF(trim(v_preenchimento->>'cidade'), ''), NULLIF(trim(v_proposta.cidade_cliente), '')),
    NULLIF(trim(v_preenchimento->>'uf'), ''),
    v_proposta.tipo_bem,
    v_proposta.valor_credito,
    v_proposta.valor_parcela,
    v_proposta.prazo,
    NULLIF(v_preenchimento->>'grupo_id', '')::uuid,
    NULLIF(trim(v_preenchimento->>'grupo_nome'), ''),
    NULLIF(trim(v_preenchimento->>'administradora'), ''),
    NULLIF(trim(v_preenchimento->>'cota_id'), ''),
    COALESCE(v_proposta.dados_simulacao, '{}'::jsonb),
    v_forma_pagamento,
    NULLIF(trim(v_preenchimento->>'observacao_cliente'), ''),
    now(),
    now(),
    true,
    now(),
    v_proposta.participante_comercial_id,
    v_proposta.organizacao_parceira_id
  )
  RETURNING * INTO v_nova;

  -- Migra documentos já anexados na proposta se houver
  INSERT INTO public.contratacoes_documentos (
    contratacao_id,
    tipo_documento,
    arquivo_url,
    arquivo_nome,
    mime_type,
    tamanho_bytes
  )
  SELECT
    v_nova.id,
    tipo_documento,
    arquivo_url,
    arquivo_nome,
    mime_type,
    tamanho_bytes
  FROM public.propostas_documentos
  WHERE proposta_id = v_proposta.id
    AND empresa_id = p_empresa_id;

  -- Marca status da proposta como Contratada
  UPDATE public.propostas
  SET status = 'Contratada', updated_at = now()
  WHERE id = v_proposta.id;

  RETURN v_nova;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_converter_proposta_em_contratacao(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_converter_proposta_em_contratacao(uuid, uuid, uuid)
  TO authenticated, service_role;

COMMIT;
