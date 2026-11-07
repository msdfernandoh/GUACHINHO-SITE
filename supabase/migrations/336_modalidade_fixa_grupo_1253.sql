-- O grupo 1253 possui Lance Livre padrão e Lance Fixo de 25%.
-- O registro personalizado estava ausente e fazia o ERP ocultar o fixo.
INSERT INTO public.grupos_modalidades_lance (
  grupo_id,
  nome,
  percentual_lance_embutido,
  percentual_recurso_proprio_minimo,
  descricao,
  ativo,
  ordem,
  tipo_parcela,
  base_referencia
)
SELECT
  g.id,
  'Lance Fixo 25%',
  25,
  0,
  'Lance fixo de 25% com até 25% de lance embutido',
  true,
  0,
  null,
  'CREDITO'
FROM public.grupos_consorcio g
WHERE trim(g.codigo_grupo) = '1253'
  AND NOT EXISTS (
    SELECT 1
    FROM public.grupos_modalidades_lance existente
    WHERE existente.grupo_id = g.id
      AND upper(existente.nome) = upper('Lance Fixo 25%')
  );
