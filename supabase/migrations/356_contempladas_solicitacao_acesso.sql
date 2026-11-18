-- Solicitação de acesso pelo portal (revenda / administrador de cotas) com dados da empresa; o dono aprova.
ALTER TABLE public.contempladas_usuarios
  ADD COLUMN IF NOT EXISTS administradora text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS empresa text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS tipo_cadastro text CHECK (tipo_cadastro IN ('ADMINISTRA', 'ADMINISTRA_E_REVENDE', 'REVENDE')),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'PENDENTE', 'RECUSADO'));
