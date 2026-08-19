-- 100 — ERP Clientes: Dados completos, data de nascimento, documentos e sincronização
-- Forward-only: Adiciona colunas cadastrais completas à tabela clientes, atualiza
-- a sincronização de contratações online e realiza backfill seguro sem perder dados.

BEGIN;

-- 1. Adicionar colunas cadastrais completas na tabela clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS orgao_emissor text,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS profissao text,
  ADD COLUMN IF NOT EXISTS telefone_secundario text;

-- 2. Atualizar a rotina de sincronização de clientes a partir de contratações online
CREATE OR REPLACE FUNCTION public.sync_cliente_from_contratacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_cliente public.clientes%ROWTYPE;
  v_documento text;
  v_nome text;
  v_tipo text;
  v_data_nasc date;
  v_rg text;
  v_orgao text;
  v_estado_civil text;
  v_profissao text;
  v_tel_sec text;
  v_dados jsonb;
BEGIN
  IF NOT NEW.contrato_assinado OR (TG_OP = 'UPDATE' AND OLD.contrato_assinado IS TRUE AND NEW.cliente_id IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  v_documento := public.normalizar_documento_cliente(CASE WHEN NEW.tipo_pessoa = 'cnpj' THEN NEW.cnpj ELSE NEW.cpf END);
  v_nome := COALESCE(NULLIF(trim(CASE WHEN NEW.tipo_pessoa = 'cnpj' THEN NEW.razao_social ELSE NEW.nome END), ''), NULLIF(trim(NEW.nome), ''), 'Cadastro sem nome');
  v_tipo := CASE WHEN NEW.tipo_pessoa = 'cnpj' THEN 'PJ' ELSE 'PF' END;
  v_dados := COALESCE(NEW.dados_simulacao, '{}'::jsonb);

  v_data_nasc := COALESCE(NEW.data_nascimento, NULLIF(v_dados->>'data_nascimento', '')::date);
  v_rg := COALESCE(NULLIF(trim(v_dados->>'rg'), ''), NULLIF(trim(v_dados->>'documento_identidade'), ''));
  v_orgao := NULLIF(trim(v_dados->>'orgao_emissor'), '');
  v_estado_civil := NULLIF(trim(v_dados->>'estado_civil'), '');
  v_profissao := NULLIF(trim(v_dados->>'profissao'), '');
  v_tel_sec := NULLIF(trim(COALESCE(v_dados->>'telefone_secundario', v_dados->>'whatsapp_secundario')), '');

  IF v_documento IS NOT NULL THEN
    INSERT INTO public.clientes (
      empresa_id, tipo_pessoa, nome, nome_fantasia, cpf_cnpj, documento_normalizado,
      representante_nome, telefone, email, cep, endereco, numero, complemento,
      bairro, cidade, uf, participante_comercial_id, origem, criado_por_contratacao_id,
      contrato_assinado_referencia_em, data_nascimento, rg, orgao_emissor, estado_civil,
      profissao, telefone_secundario
    )
    VALUES (
      NEW.empresa_id, v_tipo, v_nome, NULLIF(trim(NEW.razao_social), ''),
      CASE WHEN NEW.tipo_pessoa = 'cnpj' THEN NEW.cnpj ELSE NEW.cpf END, v_documento,
      NEW.responsavel_nome, NEW.telefone, NEW.email, NEW.cep, NEW.endereco, NEW.numero,
      NEW.complemento, NEW.bairro, NEW.cidade, NEW.uf, NEW.participante_comercial_id,
      'contratacao_assinada', NEW.id, COALESCE(NEW.contrato_assinado_em, now()),
      v_data_nasc, v_rg, v_orgao, v_estado_civil, v_profissao, v_tel_sec
    )
    ON CONFLICT (empresa_id, documento_normalizado) WHERE documento_normalizado IS NOT NULL DO UPDATE SET
      tipo_pessoa = EXCLUDED.tipo_pessoa,
      nome = EXCLUDED.nome,
      nome_fantasia = COALESCE(EXCLUDED.nome_fantasia, public.clientes.nome_fantasia),
      representante_nome = COALESCE(EXCLUDED.representante_nome, public.clientes.representante_nome),
      telefone = COALESCE(EXCLUDED.telefone, public.clientes.telefone),
      email = COALESCE(EXCLUDED.email, public.clientes.email),
      cep = COALESCE(EXCLUDED.cep, public.clientes.cep),
      endereco = COALESCE(EXCLUDED.endereco, public.clientes.endereco),
      numero = COALESCE(EXCLUDED.numero, public.clientes.numero),
      complemento = COALESCE(EXCLUDED.complemento, public.clientes.complemento),
      bairro = COALESCE(EXCLUDED.bairro, public.clientes.bairro),
      cidade = COALESCE(EXCLUDED.cidade, public.clientes.cidade),
      uf = COALESCE(EXCLUDED.uf, public.clientes.uf),
      participante_comercial_id = COALESCE(EXCLUDED.participante_comercial_id, public.clientes.participante_comercial_id),
      data_nascimento = COALESCE(EXCLUDED.data_nascimento, public.clientes.data_nascimento),
      rg = COALESCE(EXCLUDED.rg, public.clientes.rg),
      orgao_emissor = COALESCE(EXCLUDED.orgao_emissor, public.clientes.orgao_emissor),
      estado_civil = COALESCE(EXCLUDED.estado_civil, public.clientes.estado_civil),
      profissao = COALESCE(EXCLUDED.profissao, public.clientes.profissao),
      telefone_secundario = COALESCE(EXCLUDED.telefone_secundario, public.clientes.telefone_secundario),
      contrato_assinado_referencia_em = GREATEST(public.clientes.contrato_assinado_referencia_em, EXCLUDED.contrato_assinado_referencia_em),
      updated_at = now()
    RETURNING * INTO v_cliente;
  ELSE
    INSERT INTO public.clientes (
      empresa_id, tipo_pessoa, nome, telefone, email, participante_comercial_id,
      origem, criado_por_contratacao_id, contrato_assinado_referencia_em,
      data_nascimento, rg, orgao_emissor, estado_civil, profissao, telefone_secundario
    )
    VALUES (
      NEW.empresa_id, v_tipo, v_nome, NEW.telefone, NEW.email, NEW.participante_comercial_id,
      'contratacao_assinada', NEW.id, COALESCE(NEW.contrato_assinado_em, now()),
      v_data_nasc, v_rg, v_orgao, v_estado_civil, v_profissao, v_tel_sec
    )
    RETURNING * INTO v_cliente;
  END IF;

  NEW.cliente_id := v_cliente.id;
  RETURN NEW;
END $$;

-- 3. Backfill retroativo seguro para enriquecer clientes já existentes criados por contratação
UPDATE public.clientes c
SET
  data_nascimento = COALESCE(c.data_nascimento, co.data_nascimento, NULLIF(co.dados_simulacao->>'data_nascimento', '')::date),
  cep = COALESCE(c.cep, co.cep),
  endereco = COALESCE(c.endereco, co.endereco),
  numero = COALESCE(c.numero, co.numero),
  complemento = COALESCE(c.complemento, co.complemento),
  bairro = COALESCE(c.bairro, co.bairro),
  cidade = COALESCE(c.cidade, co.cidade),
  uf = COALESCE(c.uf, co.uf),
  rg = COALESCE(c.rg, NULLIF(trim(co.dados_simulacao->>'rg'), ''), NULLIF(trim(co.dados_simulacao->>'documento_identidade'), '')),
  orgao_emissor = COALESCE(c.orgao_emissor, NULLIF(trim(co.dados_simulacao->>'orgao_emissor'), '')),
  estado_civil = COALESCE(c.estado_civil, NULLIF(trim(co.dados_simulacao->>'estado_civil'), '')),
  profissao = COALESCE(c.profissao, NULLIF(trim(co.dados_simulacao->>'profissao'), '')),
  telefone_secundario = COALESCE(c.telefone_secundario, NULLIF(trim(COALESCE(co.dados_simulacao->>'telefone_secundario', co.dados_simulacao->>'whatsapp_secundario')), ''))
FROM public.contratacoes_online co
WHERE (co.cliente_id = c.id OR co.id = c.criado_por_contratacao_id)
  AND co.empresa_id = c.empresa_id;

-- 4. Garantir permissões das novas colunas
GRANT SELECT, INSERT, UPDATE ON TABLE public.clientes TO authenticated, service_role;

COMMIT;
