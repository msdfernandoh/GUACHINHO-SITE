-- 117: Cadastros Financeiros (Fornecedores com Auto-criação, Bancos e Centros de Custo)
BEGIN;

-- 1. Tabela de Fornecedores
CREATE TABLE IF NOT EXISTS public.financeiro_fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  razao_social text,
  cnpj_cpf text,
  email text,
  telefone text,
  chave_pix text,
  tipo_chave_pix text,
  banco text,
  agencia text,
  conta text,
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, nome)
);

-- 2. Evolução de tabelas existentes
ALTER TABLE public.financeiro_contas_pagar
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.financeiro_fornecedores(id) ON DELETE SET NULL;

ALTER TABLE public.financeiro_contas_bancarias
  ADD COLUMN IF NOT EXISTS tipo_conta text DEFAULT 'CORRENTE',
  ADD COLUMN IF NOT EXISTS chave_pix text,
  ADD COLUMN IF NOT EXISTS saldo_inicial numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacao text;

ALTER TABLE public.financeiro_centros_custo
  ADD COLUMN IF NOT EXISTS departamento text,
  ADD COLUMN IF NOT EXISTS descricao text;

-- 3. RLS para Fornecedores
ALTER TABLE public.financeiro_fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_fornecedores_select ON public.financeiro_fornecedores;
CREATE POLICY financeiro_fornecedores_select ON public.financeiro_fornecedores
  FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));

DROP POLICY IF EXISTS financeiro_fornecedores_insert ON public.financeiro_fornecedores;
CREATE POLICY financeiro_fornecedores_insert ON public.financeiro_fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_tenant_internal(empresa_id));

DROP POLICY IF EXISTS financeiro_fornecedores_update ON public.financeiro_fornecedores;
CREATE POLICY financeiro_fornecedores_update ON public.financeiro_fornecedores
  FOR UPDATE TO authenticated
  USING (public.can_write_tenant_internal(empresa_id))
  WITH CHECK (public.can_write_tenant_internal(empresa_id));

DROP POLICY IF EXISTS financeiro_fornecedores_delete ON public.financeiro_fornecedores;
CREATE POLICY financeiro_fornecedores_delete ON public.financeiro_fornecedores
  FOR DELETE TO authenticated
  USING (public.can_write_tenant_internal(empresa_id));

-- 4. Função para obter ou criar fornecedor por nome
CREATE OR REPLACE FUNCTION public.rpc_obter_ou_criar_fornecedor(
  p_empresa_id uuid,
  p_nome text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_nome_limpo text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  v_nome_limpo := trim(coalesce(p_nome, ''));
  IF length(v_nome_limpo) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM public.financeiro_fornecedores
  WHERE empresa_id = p_empresa_id
    AND lower(trim(nome)) = lower(v_nome_limpo)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.financeiro_fornecedores (empresa_id, nome, ativo)
  VALUES (p_empresa_id, v_nome_limpo, true)
  ON CONFLICT (empresa_id, nome) DO UPDATE
  SET ativo = true
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 5. Backfill de fornecedores existentes
DO $$
DECLARE
  v_rec record;
  v_forn_id uuid;
BEGIN
  FOR v_rec IN
    SELECT DISTINCT empresa_id, trim(fornecedor) AS nome
    FROM public.financeiro_contas_pagar
    WHERE fornecedor IS NOT NULL AND length(trim(fornecedor)) > 0
  LOOP
    BEGIN
      INSERT INTO public.financeiro_fornecedores (empresa_id, nome, ativo)
      VALUES (v_rec.empresa_id, v_rec.nome, true)
      ON CONFLICT (empresa_id, nome) DO NOTHING;

      SELECT id INTO v_forn_id
      FROM public.financeiro_fornecedores
      WHERE empresa_id = v_rec.empresa_id AND lower(trim(nome)) = lower(v_rec.nome)
      LIMIT 1;

      UPDATE public.financeiro_contas_pagar
      SET fornecedor_id = v_forn_id
      WHERE empresa_id = v_rec.empresa_id
        AND lower(trim(fornecedor)) = lower(v_rec.nome)
        AND fornecedor_id IS NULL;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
