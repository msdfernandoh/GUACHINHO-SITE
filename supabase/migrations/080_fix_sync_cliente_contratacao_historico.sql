-- 080 — corrige a ordem contratação → cliente → histórico sem reescrever a 071.
-- O BEFORE preserva a identidade canônica e NEW.cliente_id. O histórico que
-- possui FK para contratacoes_online passa a ser escrito somente no AFTER.
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_cliente_from_contratacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_cliente public.clientes%ROWTYPE; v_documento text; v_nome text; v_tipo text;
BEGIN
  IF NOT NEW.contrato_assinado OR (TG_OP = 'UPDATE' AND OLD.contrato_assinado IS TRUE AND NEW.cliente_id IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  v_documento := public.normalizar_documento_cliente(CASE WHEN NEW.tipo_pessoa = 'cnpj' THEN NEW.cnpj ELSE NEW.cpf END);
  v_nome := COALESCE(NULLIF(trim(CASE WHEN NEW.tipo_pessoa = 'cnpj' THEN NEW.razao_social ELSE NEW.nome END), ''), NULLIF(trim(NEW.nome), ''), 'Cadastro sem nome');
  v_tipo := CASE WHEN NEW.tipo_pessoa = 'cnpj' THEN 'PJ' ELSE 'PF' END;

  IF v_documento IS NOT NULL THEN
    INSERT INTO public.clientes (empresa_id, tipo_pessoa, nome, nome_fantasia, cpf_cnpj, documento_normalizado, representante_nome, telefone, email, cep, endereco, numero, complemento, bairro, cidade, uf, participante_comercial_id, origem, criado_por_contratacao_id, contrato_assinado_referencia_em)
    VALUES (NEW.empresa_id, v_tipo, v_nome, NULLIF(trim(NEW.razao_social), ''), CASE WHEN NEW.tipo_pessoa = 'cnpj' THEN NEW.cnpj ELSE NEW.cpf END, v_documento, NEW.responsavel_nome, NEW.telefone, NEW.email, NEW.cep, NEW.endereco, NEW.numero, NEW.complemento, NEW.bairro, NEW.cidade, NEW.uf, NEW.participante_comercial_id, 'contratacao_assinada', NEW.id, COALESCE(NEW.contrato_assinado_em, now()))
    ON CONFLICT (empresa_id, documento_normalizado) WHERE documento_normalizado IS NOT NULL DO UPDATE SET
      tipo_pessoa = EXCLUDED.tipo_pessoa, nome = EXCLUDED.nome, nome_fantasia = COALESCE(EXCLUDED.nome_fantasia, public.clientes.nome_fantasia), representante_nome = COALESCE(EXCLUDED.representante_nome, public.clientes.representante_nome), telefone = COALESCE(EXCLUDED.telefone, public.clientes.telefone), email = COALESCE(EXCLUDED.email, public.clientes.email), cep = COALESCE(EXCLUDED.cep, public.clientes.cep), endereco = COALESCE(EXCLUDED.endereco, public.clientes.endereco), numero = COALESCE(EXCLUDED.numero, public.clientes.numero), complemento = COALESCE(EXCLUDED.complemento, public.clientes.complemento), bairro = COALESCE(EXCLUDED.bairro, public.clientes.bairro), cidade = COALESCE(EXCLUDED.cidade, public.clientes.cidade), uf = COALESCE(EXCLUDED.uf, public.clientes.uf), participante_comercial_id = COALESCE(EXCLUDED.participante_comercial_id, public.clientes.participante_comercial_id), contrato_assinado_referencia_em = GREATEST(public.clientes.contrato_assinado_referencia_em, EXCLUDED.contrato_assinado_referencia_em), updated_at = now()
    RETURNING * INTO v_cliente;
  ELSE
    INSERT INTO public.clientes (empresa_id, tipo_pessoa, nome, telefone, email, participante_comercial_id, origem, criado_por_contratacao_id, contrato_assinado_referencia_em)
    VALUES (NEW.empresa_id, v_tipo, v_nome, NEW.telefone, NEW.email, NEW.participante_comercial_id, 'contratacao_assinada', NEW.id, COALESCE(NEW.contrato_assinado_em, now()))
    RETURNING * INTO v_cliente;
  END IF;
  NEW.cliente_id := v_cliente.id;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_historico_cliente_contratacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF NOT NEW.contrato_assinado OR NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.contrato_assinado IS TRUE
     AND OLD.cliente_id IS NOT DISTINCT FROM NEW.cliente_id THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.clientes_historico
    (empresa_id, cliente_id, tipo_evento, descricao, contratacao_id)
  SELECT NEW.empresa_id, NEW.cliente_id, 'contrato_assinado',
    'Cliente vinculado por contratação assinada.', NEW.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.clientes_historico h
    WHERE h.empresa_id = NEW.empresa_id
      AND h.cliente_id = NEW.cliente_id
      AND h.contratacao_id = NEW.id
      AND h.tipo_evento = 'contrato_assinado'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contratacoes_sync_cliente_historico ON public.contratacoes_online;
CREATE TRIGGER trg_contratacoes_sync_cliente_historico
AFTER INSERT OR UPDATE OF contrato_assinado, cliente_id ON public.contratacoes_online
FOR EACH ROW EXECUTE FUNCTION public.registrar_historico_cliente_contratacao();

REVOKE ALL ON FUNCTION public.registrar_historico_cliente_contratacao() FROM PUBLIC, anon;

COMMIT;
