-- 231: Landing de parceiros e PWA do indicador. Forward-only e tenant-aware.
BEGIN;

ALTER TABLE public.programa_indicadores
  ADD COLUMN IF NOT EXISTS modelo_interesse text NOT NULL DEFAULT 'GERADOR_POSSIBILIDADES'
    CHECK (modelo_interesse IN ('MICROFRANQUEADO','GERADOR_NEGOCIOS','GERADOR_POSSIBILIDADES','CONVERSAR_EQUIPE')),
  ADD COLUMN IF NOT EXISTS status_solicitacao_modelo text NOT NULL DEFAULT 'APROVADO_NIVEL_1'
    CHECK (status_solicitacao_modelo IN ('APROVADO_NIVEL_1','EM_ANALISE','APROVADO','RECUSADO')),
  ADD COLUMN IF NOT EXISTS profissao text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS rede_relacionamento jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS potencial_vendas_mensal text,
  ADD COLUMN IF NOT EXISTS network_interesse text,
  ADD COLUMN IF NOT EXISTS observacao_cadastro text;

ALTER TABLE public.programa_indicacoes
  ADD COLUMN IF NOT EXISTS produto_interesse text
    CHECK (produto_interesse IN ('IMOVEL','VEICULO','MOTO','FROTA')),
  ADD COLUMN IF NOT EXISTS credito_desejado numeric(14,2),
  ADD COLUMN IF NOT EXISTS capacidade_mensal numeric(14,2),
  ADD COLUMN IF NOT EXISTS observacao_indicado text;

CREATE TABLE IF NOT EXISTS public.programa_indicadores_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  indicador_id uuid NOT NULL REFERENCES public.programa_indicadores(id) ON DELETE RESTRICT,
  modelo_solicitado text NOT NULL CHECK (modelo_solicitado IN ('MICROFRANQUEADO','GERADOR_NEGOCIOS','GERADOR_POSSIBILIDADES')),
  status text NOT NULL DEFAULT 'EM_ANALISE' CHECK (status IN ('EM_ANALISE','APROVADO','RECUSADO','CANCELADO')),
  decisoes_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  motivo_decisao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decidido_em timestamptz,
  UNIQUE (empresa_id, indicador_id, modelo_solicitado, status)
);

CREATE INDEX IF NOT EXISTS programa_indicacoes_app_idx ON public.programa_indicacoes(empresa_id, indicador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS programa_indicadores_solicitacoes_idx ON public.programa_indicadores_solicitacoes(empresa_id, status, created_at DESC);
ALTER TABLE public.programa_indicadores_solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY programa_indicadores_solicitacoes_select ON public.programa_indicadores_solicitacoes FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY programa_indicadores_solicitacoes_write ON public.programa_indicadores_solicitacoes FOR ALL TO authenticated
  USING (public.can_write_tenant_internal(empresa_id)) WITH CHECK (public.can_write_tenant_internal(empresa_id));
REVOKE ALL ON public.programa_indicadores_solicitacoes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programa_indicadores_solicitacoes TO authenticated, service_role;
COMMIT;
NOTIFY pgrst, 'reload schema';
