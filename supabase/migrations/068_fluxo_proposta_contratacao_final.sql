-- 068 — separa proposta em preenchimento da contratação formal.
-- A contratação nasce somente na confirmação final, com documento persistido.

BEGIN;

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS public_token text,
  ADD COLUMN IF NOT EXISTS origem_contratacao text,
  ADD COLUMN IF NOT EXISTS preenchimento_contratacao jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.propostas
  DROP CONSTRAINT IF EXISTS propostas_origem_contratacao_check,
  ADD CONSTRAINT propostas_origem_contratacao_check
    CHECK (origem_contratacao IS NULL OR origem_contratacao IN ('simulador', 'grupos'));

CREATE UNIQUE INDEX IF NOT EXISTS propostas_public_token_uidx
  ON public.propostas (public_token) WHERE public_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS propostas_id_empresa_uidx
  ON public.propostas (id, empresa_id);

ALTER TABLE public.contratacoes_online
  ADD COLUMN IF NOT EXISTS proposta_id uuid REFERENCES public.propostas(id) ON DELETE RESTRICT;

ALTER TABLE public.contratacoes_online
  ADD CONSTRAINT contratacoes_online_proposta_empresa_fkey
    FOREIGN KEY (proposta_id, empresa_id)
    REFERENCES public.propostas (id, empresa_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS contratacoes_online_proposta_uidx
  ON public.contratacoes_online (proposta_id) WHERE proposta_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.propostas_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  proposta_id uuid NOT NULL,
  tipo_documento text NOT NULL,
  arquivo_url text NOT NULL CHECK (length(trim(arquivo_url)) > 0),
  arquivo_nome text,
  mime_type text,
  tamanho_bytes integer NOT NULL CHECK (tamanho_bytes > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT propostas_documentos_proposta_empresa_fkey
    FOREIGN KEY (proposta_id, empresa_id)
    REFERENCES public.propostas (id, empresa_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS propostas_documentos_proposta_idx
  ON public.propostas_documentos (proposta_id, created_at);

ALTER TABLE public.propostas_documentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.propostas_documentos FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.propostas_documentos TO service_role;
GRANT SELECT ON TABLE public.propostas_documentos TO authenticated;

CREATE POLICY propostas_documentos_tenant_select
ON public.propostas_documentos FOR SELECT TO authenticated
USING (public.can_read_tenant_internal(empresa_id));

CREATE OR REPLACE FUNCTION public.rpc_finalizar_contratacao_proposta(
  p_empresa_id uuid,
  p_proposta_id uuid,
  p_public_token text
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
  v_doc_count integer;
  v_protocolo text;
BEGIN
  IF p_public_token IS NULL OR length(trim(p_public_token)) = 0 THEN
    RAISE EXCEPTION 'Confirmação final inválida';
  END IF;

  SELECT * INTO v_proposta
  FROM public.propostas
  WHERE id = p_proposta_id
  FOR UPDATE;

  IF NOT FOUND OR v_proposta.empresa_id IS DISTINCT FROM p_empresa_id THEN
    RAISE EXCEPTION 'Proposta não encontrada neste tenant';
  END IF;
  IF v_proposta.public_token IS DISTINCT FROM p_public_token THEN
    RAISE EXCEPTION 'Token da proposta inválido';
  END IF;
  IF v_proposta.origem_contratacao = 'grupos'
     AND (length(trim(COALESCE(v_proposta.preenchimento_contratacao->>'grupo_id', ''))) = 0
       OR length(trim(COALESCE(v_proposta.preenchimento_contratacao->>'cota_id', ''))) = 0) THEN
    RAISE EXCEPTION 'Grupo/opção da proposta estão incompletos';
  END IF;

  SELECT * INTO v_existente
  FROM public.contratacoes_online
  WHERE proposta_id = p_proposta_id;
  IF FOUND THEN
    RETURN v_existente;
  END IF;

  IF length(trim(COALESCE(v_proposta.nome_cliente, ''))) = 0
     OR length(regexp_replace(COALESCE(v_proposta.whatsapp_cliente, ''), '[^0-9]', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Proposta exige nome e telefone válidos';
  END IF;

  v_preenchimento := COALESCE(v_proposta.preenchimento_contratacao, '{}'::jsonb);
  IF length(trim(COALESCE(v_preenchimento->>'email', v_proposta.email_cliente, ''))) = 0
     OR length(trim(COALESCE(v_preenchimento->>'tipo_pessoa', ''))) = 0
     OR length(trim(COALESCE(v_preenchimento->>'cep', ''))) = 0
     OR length(trim(COALESCE(v_preenchimento->>'endereco', ''))) = 0
     OR length(trim(COALESCE(v_preenchimento->>'numero', ''))) = 0
     OR length(trim(COALESCE(v_preenchimento->>'bairro', ''))) = 0
     OR length(trim(COALESCE(v_preenchimento->>'cidade', ''))) = 0
     OR length(trim(COALESCE(v_preenchimento->>'uf', ''))) = 0
     OR length(trim(COALESCE(v_preenchimento->>'forma_pagamento', ''))) = 0 THEN
    RAISE EXCEPTION 'Dados mínimos da contratação estão incompletos';
  END IF;

  SELECT count(*) INTO v_doc_count
  FROM public.propostas_documentos
  WHERE proposta_id = p_proposta_id
    AND empresa_id = p_empresa_id
    AND length(trim(arquivo_url)) > 0
    AND tamanho_bytes > 0;
  IF v_doc_count < 1 THEN
    RAISE EXCEPTION 'Envie pelo menos um documento válido antes de confirmar a contratação';
  END IF;

  v_protocolo := 'GC-' || to_char(clock_timestamp(), 'YYYY') || '-' ||
    lpad(nextval('public.contratacao_protocolo_seq')::text, 6, '0');

  INSERT INTO public.contratacoes_online (
    proposta_id, empresa_id, public_token, protocolo, origem, status,
    lead_id, gerado_por_usuario_id, gerado_por_nome, gerado_por_email,
    nome, telefone, email, tipo_pessoa, cpf, data_nascimento,
    razao_social, cnpj, responsavel_nome, responsavel_cpf,
    cep, endereco, numero, complemento, bairro, cidade, uf,
    tipo_bem, credito_selecionado, parcela_estimada, prazo,
    grupo_id, grupo_nome, administradora, cota_id, dados_simulacao,
    forma_pagamento, observacao_cliente, pix_ativo_na_solicitacao,
    pix_chave, pix_recebedor, pix_instrucoes, pix_comprovante_url,
    pix_status, confirmado_em, finalizado_em,
    participante_comercial_id, organizacao_parceira_id
  ) VALUES (
    v_proposta.id, v_proposta.empresa_id, v_proposta.public_token, v_protocolo,
    COALESCE(v_proposta.origem_contratacao, 'simulador'), 'aguardando_consultor',
    v_proposta.lead_id, (v_preenchimento->>'gerado_por_usuario_id')::uuid,
    v_proposta.consultor_nome, v_proposta.consultor_email,
    v_proposta.nome_cliente, regexp_replace(v_proposta.whatsapp_cliente, '[^0-9]', '', 'g'),
    COALESCE(v_preenchimento->>'email', v_proposta.email_cliente),
    v_preenchimento->>'tipo_pessoa', NULLIF(v_preenchimento->>'cpf', ''),
    NULLIF(v_preenchimento->>'data_nascimento', '')::date,
    NULLIF(v_preenchimento->>'razao_social', ''), NULLIF(v_preenchimento->>'cnpj', ''),
    NULLIF(v_preenchimento->>'responsavel_nome', ''), NULLIF(v_preenchimento->>'responsavel_cpf', ''),
    v_preenchimento->>'cep', v_preenchimento->>'endereco', v_preenchimento->>'numero',
    NULLIF(v_preenchimento->>'complemento', ''), v_preenchimento->>'bairro',
    v_preenchimento->>'cidade', v_preenchimento->>'uf',
    v_proposta.tipo_bem, v_proposta.valor_credito, v_proposta.valor_parcela, v_proposta.prazo,
    NULLIF(v_preenchimento->>'grupo_id', '')::uuid, NULLIF(v_preenchimento->>'grupo_nome', ''),
    NULLIF(v_preenchimento->>'administradora', ''), NULLIF(v_preenchimento->>'cota_id', ''),
    COALESCE(v_proposta.dados_simulacao, '{}'::jsonb), v_preenchimento->>'forma_pagamento',
    NULLIF(v_preenchimento->>'observacao_cliente', ''),
    COALESCE((v_preenchimento->>'pix_ativo_na_solicitacao')::boolean, false),
    NULLIF(v_preenchimento->>'pix_chave', ''), NULLIF(v_preenchimento->>'pix_recebedor', ''),
    NULLIF(v_preenchimento->>'pix_instrucoes', ''), NULLIF(v_preenchimento->>'pix_comprovante_url', ''),
    CASE WHEN NULLIF(v_preenchimento->>'pix_comprovante_url', '') IS NULL THEN 'nao_enviado' ELSE 'enviado' END,
    now(), now(), v_proposta.participante_comercial_id, v_proposta.organizacao_parceira_id
  )
  RETURNING * INTO v_nova;

  INSERT INTO public.contratacoes_documentos (
    contratacao_id, tipo_documento, arquivo_url, arquivo_nome, mime_type, tamanho_bytes
  )
  SELECT v_nova.id, tipo_documento, arquivo_url, arquivo_nome, mime_type, tamanho_bytes
  FROM public.propostas_documentos
  WHERE proposta_id = v_proposta.id AND empresa_id = p_empresa_id;

  UPDATE public.propostas
  SET status = 'Enviada', updated_at = now()
  WHERE id = v_proposta.id;

  RETURN v_nova;
END
$$;

REVOKE ALL ON FUNCTION public.rpc_finalizar_contratacao_proposta(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_finalizar_contratacao_proposta(uuid, uuid, text)
  TO service_role;

COMMIT;
