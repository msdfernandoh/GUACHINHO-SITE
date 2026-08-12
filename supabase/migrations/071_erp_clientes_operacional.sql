-- 071 — ERP Clientes operacional.
-- Forward-only: cria a identidade cadastral tenant-aware sem substituir
-- propostas, contratações, vendas, cotas ou documentos canônicos.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS participantes_comerciais_id_empresa_uidx ON public.participantes_comerciais (id, empresa_id);

CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  tipo_pessoa text NOT NULL CHECK (tipo_pessoa IN ('PF', 'PJ')),
  nome text NOT NULL,
  nome_fantasia text,
  documento_normalizado text,
  cpf_cnpj text,
  representante_nome text,
  telefone text,
  email text,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  participante_comercial_id uuid REFERENCES public.participantes_comerciais(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'contratacao_assinada')),
  observacoes text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  criado_por_contratacao_id uuid,
  contrato_assinado_referencia_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clientes_documento_normalizado_check CHECK (
    documento_normalizado IS NULL OR documento_normalizado ~ '^[0-9]{11}([0-9]{3})?$'
  ),
  CONSTRAINT clientes_participante_empresa_fkey FOREIGN KEY (participante_comercial_id, empresa_id)
    REFERENCES public.participantes_comerciais(id, empresa_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS contratacoes_online_id_empresa_uidx ON public.contratacoes_online (id, empresa_id);
CREATE UNIQUE INDEX IF NOT EXISTS vendas_id_empresa_uidx ON public.vendas (id, empresa_id);
CREATE UNIQUE INDEX IF NOT EXISTS clientes_id_empresa_uidx ON public.clientes (id, empresa_id);
CREATE UNIQUE INDEX IF NOT EXISTS clientes_empresa_documento_uidx
  ON public.clientes (empresa_id, documento_normalizado)
  WHERE documento_normalizado IS NOT NULL;
CREATE INDEX IF NOT EXISTS clientes_empresa_busca_idx
  ON public.clientes (empresa_id, status, nome);

ALTER TABLE public.contratacoes_online ADD COLUMN IF NOT EXISTS cliente_id uuid;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS cliente_id uuid;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cliente_id uuid;

ALTER TABLE public.contratacoes_online DROP CONSTRAINT IF EXISTS contratacoes_online_cliente_empresa_fkey;
ALTER TABLE public.contratacoes_online ADD CONSTRAINT contratacoes_online_cliente_empresa_fkey
  FOREIGN KEY (cliente_id, empresa_id) REFERENCES public.clientes(id, empresa_id) ON DELETE RESTRICT;
ALTER TABLE public.propostas DROP CONSTRAINT IF EXISTS propostas_cliente_empresa_fkey;
ALTER TABLE public.propostas ADD CONSTRAINT propostas_cliente_empresa_fkey
  FOREIGN KEY (cliente_id, empresa_id) REFERENCES public.clientes(id, empresa_id) ON DELETE RESTRICT;
ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS vendas_cliente_empresa_fkey;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_cliente_empresa_fkey
  FOREIGN KEY (cliente_id, empresa_id) REFERENCES public.clientes(id, empresa_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS contratacoes_online_cliente_idx ON public.contratacoes_online (empresa_id, cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS propostas_cliente_idx ON public.propostas (empresa_id, cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendas_cliente_idx ON public.vendas (empresa_id, cliente_id) WHERE cliente_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.clientes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL,
  tipo_evento text NOT NULL CHECK (tipo_evento IN ('cliente_criado', 'cliente_atualizado', 'contrato_assinado', 'cota_vinculada', 'cliente_inativado')),
  descricao text NOT NULL,
  contratacao_id uuid,
  venda_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clientes_historico_cliente_empresa_fkey FOREIGN KEY (cliente_id, empresa_id)
    REFERENCES public.clientes(id, empresa_id) ON DELETE RESTRICT,
  CONSTRAINT clientes_historico_contratacao_empresa_fkey FOREIGN KEY (contratacao_id, empresa_id)
    REFERENCES public.contratacoes_online(id, empresa_id) ON DELETE RESTRICT,
  CONSTRAINT clientes_historico_venda_empresa_fkey FOREIGN KEY (venda_id, empresa_id)
    REFERENCES public.vendas(id, empresa_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS clientes_historico_cliente_idx ON public.clientes_historico (empresa_id, cliente_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.normalizar_documento_cliente(p_documento text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p_documento, ''), '[^0-9]', '', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public.validate_cliente_tenant_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.participantes_comerciais p
    WHERE p.id = NEW.participante_comercial_id AND p.empresa_id = NEW.empresa_id
  ) THEN RAISE EXCEPTION 'consultor não pertence ao tenant do cliente'; END IF;
  NEW.documento_normalizado := public.normalizar_documento_cliente(COALESCE(NEW.cpf_cnpj, NEW.documento_normalizado));
  NEW.updated_at := now();
  RETURN NEW;
END $$;

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
  INSERT INTO public.clientes_historico (empresa_id, cliente_id, tipo_evento, descricao, contratacao_id)
  VALUES (NEW.empresa_id, v_cliente.id, 'contrato_assinado', 'Cliente vinculado por contratação assinada.', NEW.id);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sync_cliente_from_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_cliente_id uuid;
BEGIN
  IF NEW.cliente_id IS NULL AND NEW.contratacao_id IS NOT NULL THEN
    SELECT cliente_id INTO v_cliente_id FROM public.contratacoes_online
    WHERE id = NEW.contratacao_id AND empresa_id = NEW.empresa_id;
    NEW.cliente_id := v_cliente_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contratacoes_sync_cliente ON public.contratacoes_online;
CREATE TRIGGER trg_contratacoes_sync_cliente BEFORE INSERT OR UPDATE OF contrato_assinado ON public.contratacoes_online
FOR EACH ROW EXECUTE FUNCTION public.sync_cliente_from_contratacao();
DROP TRIGGER IF EXISTS trg_vendas_sync_cliente ON public.vendas;
CREATE TRIGGER trg_vendas_sync_cliente BEFORE INSERT OR UPDATE OF contratacao_id ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.sync_cliente_from_venda();
DROP TRIGGER IF EXISTS trg_clientes_tenant_integrity ON public.clientes;
CREATE TRIGGER trg_clientes_tenant_integrity BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.validate_cliente_tenant_integrity();

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clientes, public.clientes_historico FROM PUBLIC, anon;
GRANT ALL ON TABLE public.clientes, public.clientes_historico TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.clientes TO authenticated;
GRANT SELECT, INSERT ON TABLE public.clientes_historico TO authenticated;

CREATE POLICY clientes_tenant_select ON public.clientes FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY clientes_tenant_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.can_write_tenant_internal(empresa_id));
CREATE POLICY clientes_tenant_update ON public.clientes FOR UPDATE TO authenticated USING (public.can_write_tenant_internal(empresa_id)) WITH CHECK (public.can_write_tenant_internal(empresa_id));
CREATE POLICY clientes_historico_tenant_select ON public.clientes_historico FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY clientes_historico_tenant_insert ON public.clientes_historico FOR INSERT TO authenticated WITH CHECK (public.can_write_tenant_internal(empresa_id));

COMMIT;
