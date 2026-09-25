-- Corrige a divergência entre a assinatura ativa e a configuração operacional
-- da master Sorriso. Os módulos são derivados somente do plano contratado.
BEGIN;

WITH modulos_contratados AS (
  SELECT e.id AS empresa_id,
         array_agg(m.codigo ORDER BY m.codigo) AS codigos
  FROM public.empresas e
  JOIN public.saas_assinaturas a ON a.empresa_id = e.id AND a.status = 'ATIVA'
  JOIN public.saas_plano_modulos pm ON pm.plano_id = a.plano_id AND pm.habilitado
  JOIN public.erp_modulos_catalogo m ON m.id = pm.modulo_id AND m.status = 'ATIVO'
  WHERE e.slug = 'sorriso'
  GROUP BY e.id
)
UPDATE public.empresas e
SET configuracoes = coalesce(e.configuracoes, '{}'::jsonb) || jsonb_build_object(
  'erp_sistema', jsonb_build_object(
    'habilitado', true,
    'modulos', to_jsonb(mc.codigos)
  )
)
FROM modulos_contratados mc
WHERE e.id = mc.empresa_id;

-- O vínculo existente foi criado com lista vazia, que significa bloqueio
-- explícito. NULL faz o administrador herdar somente os módulos da empresa.
UPDATE public.empresa_usuarios eu
SET erp_modulos_visiveis = NULL
FROM public.empresas e, public.usuarios u, public.papeis p
WHERE eu.empresa_id = e.id
  AND eu.usuario_id = u.id
  AND eu.papel_id = p.id
  AND e.slug = 'sorriso'
  AND lower(u.email) = 'fernando@msdeducacao.com.br'
  AND p.codigo = 'admin_empresa'
  AND eu.ativo = true
  AND eu.erp_modulos_visiveis = '{}'::text[];

COMMIT;
NOTIFY pgrst, 'reload schema';
