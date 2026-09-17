-- Um mesmo tipo pode ter programas diferentes para perfis distintos, como o
-- programa canônico Racon e o programa Franquia Antiga. A resolução permanece
-- inequívoca dentro do conjunto de regras do perfil selecionado.
BEGIN;

DROP INDEX IF EXISTS public.uq_comissao_programa_tipo_operacional;
CREATE INDEX IF NOT EXISTS idx_comissao_programa_tipos_resolucao
  ON public.comissao_programa_tipos (empresa_id, tipo_administradora_id, programa_id)
  WHERE ativo;

INSERT INTO public.comissao_programa_tipos (
  empresa_id, programa_id, tipo_administradora_id, ativo
)
VALUES
  (
    '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid,
    'cbeba2f1-19f7-4465-be43-4d4ff5d4534d'::uuid,
    '57295700-5e68-498c-8882-2ef4ccc8c08d'::uuid,
    true
  ),
  (
    '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid,
    'cbeba2f1-19f7-4465-be43-4d4ff5d4534d'::uuid,
    '877a793f-21b3-4ea8-b3c3-b1e56dc216c9'::uuid,
    true
  )
ON CONFLICT (programa_id, tipo_administradora_id)
DO UPDATE SET ativo = true, updated_at = now();

COMMIT;
NOTIFY pgrst, 'reload schema';
