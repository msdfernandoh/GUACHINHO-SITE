-- Corrige a descrição legada do grupo 1553.
-- "LANCE FIXO 255" era um cadastro incorreto e fazia o parser identificar
-- o dígito 2 como se fosse a modalidade 2º Lance Fixo.
UPDATE public.grupos_modalidades_lance AS m
SET
  nome = 'LANCE FIXO 25%',
  descricao = 'Lance fixo de 25% com até 25% de lance embutido'
FROM public.grupos_consorcio AS g
WHERE m.grupo_id = g.id
  AND g.codigo_grupo LIKE '1553%'
  AND upper(trim(m.nome)) = 'LANCE FIXO 255';
