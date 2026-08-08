-- ============================================================================
-- Migration 048: Fase 4 E5 — backfill controlado grupos_consorcio.administradora_id
--
-- NÃO APLICAR sem autorização explícita do proprietário.
--
-- Escopo:
--   - Preencher administradora_id dos grupos com texto normalizado = 'racon'
--     (legado RACON / Racon) apontando para a administradora global Racon.
--   - Preservar integralmente o texto public.grupos_consorcio.administradora.
--   - NÃO alterar RLS de grupos/cotas/modalidades.
--   - NÃO alterar grupos_cotas / propostas / contratações / APIs.
--   - NÃO tornar administradora_id NOT NULL.
--   - NÃO criar concessão Empresa B.
--
-- Racon global (seed 047):
--   c5f8ecb4-cb5a-5014-b567-50484719b404
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 0. Pré-asserts (abortam a migration se o estado remoto divergir)
-- --------------------------------------------------------------------------
do $$
declare
  v_racon_id constant uuid := 'c5f8ecb4-cb5a-5014-b567-50484719b404';
  v_racon_count int;
  v_racon_slug text;
  v_racon_status text;
  v_total int;
  v_null_id int;
  v_racon_text int;
  v_unknown_text int;
  v_wrong_id int;
  v_cotas int;
begin
  select count(*), max(slug), max(status)
    into v_racon_count, v_racon_slug, v_racon_status
  from public.administradoras
  where id = v_racon_id;

  if v_racon_count <> 1 then
    raise exception
      'E5 assert: Racon global id=% deve existir exatamente 1 vez (encontrado %).',
      v_racon_id, v_racon_count;
  end if;

  if v_racon_slug is distinct from 'racon' then
    raise exception
      'E5 assert: Racon global slug esperado=racon, obtido=%',
      v_racon_slug;
  end if;

  if v_racon_status is distinct from 'ATIVA' then
    raise exception
      'E5 assert: Racon global deve estar ATIVA (status=%).',
      v_racon_status;
  end if;

  if (select count(*) from public.administradoras where slug = 'racon') <> 1 then
    raise exception 'E5 assert: slug=racon deve ser único.';
  end if;

  select count(*) into v_total from public.grupos_consorcio;
  if v_total <> 19 then
    raise exception
      'E5 assert: esperado 19 grupos_consorcio, encontrado %.',
      v_total;
  end if;

  select count(*) into v_null_id
  from public.grupos_consorcio
  where administradora_id is null;
  if v_null_id <> 19 then
    raise exception
      'E5 assert: esperado 19 grupos com administradora_id NULL antes do backfill, encontrado %.',
      v_null_id;
  end if;

  select count(*) into v_racon_text
  from public.grupos_consorcio
  where lower(trim(administradora)) = 'racon';
  if v_racon_text <> 19 then
    raise exception
      'E5 assert: esperado 19 grupos com texto RACON/Racon, encontrado %.',
      v_racon_text;
  end if;

  select count(*) into v_unknown_text
  from public.grupos_consorcio
  where administradora is null
     or trim(administradora) = ''
     or lower(trim(administradora)) <> 'racon';
  if v_unknown_text <> 0 then
    raise exception
      'E5 assert: há % grupo(s) com administradora textual desconhecida/nula. Abortando.',
      v_unknown_text;
  end if;

  select count(*) into v_wrong_id
  from public.grupos_consorcio
  where administradora_id is not null
    and administradora_id <> v_racon_id;
  if v_wrong_id <> 0 then
    raise exception
      'E5 assert: % grupo(s) já apontam para outra administradora_id. Abortando.',
      v_wrong_id;
  end if;

  select count(*) into v_cotas from public.grupos_cotas;
  if v_cotas <> 178 then
    raise exception
      'E5 assert: esperado 178 grupos_cotas, encontrado %.',
      v_cotas;
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 1. Backfill (somente UUID; texto legado intocado)
-- --------------------------------------------------------------------------
update public.grupos_consorcio
set administradora_id = 'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
where administradora_id is null
  and lower(trim(administradora)) = 'racon';

-- --------------------------------------------------------------------------
-- 2. Pós-asserts
-- --------------------------------------------------------------------------
do $$
declare
  v_racon_id constant uuid := 'c5f8ecb4-cb5a-5014-b567-50484719b404';
  v_total int;
  v_filled int;
  v_null_id int;
  v_racon_upper int;
  v_racon_title int;
  v_cotas int;
begin
  select count(*) into v_total from public.grupos_consorcio;
  select count(*) into v_filled
  from public.grupos_consorcio
  where administradora_id = v_racon_id;
  select count(*) into v_null_id
  from public.grupos_consorcio
  where administradora_id is null;
  select count(*) into v_racon_upper
  from public.grupos_consorcio
  where administradora = 'RACON';
  select count(*) into v_racon_title
  from public.grupos_consorcio
  where administradora = 'Racon';
  select count(*) into v_cotas from public.grupos_cotas;

  if v_total <> 19 then
    raise exception 'E5 pós-assert: total grupos=% (esperado 19).', v_total;
  end if;
  if v_filled <> 19 then
    raise exception
      'E5 pós-assert: grupos com administradora_id Racon=% (esperado 19).',
      v_filled;
  end if;
  if v_null_id <> 0 then
    raise exception
      'E5 pós-assert: ainda há % grupos com administradora_id NULL.',
      v_null_id;
  end if;
  if v_racon_upper <> 16 or v_racon_title <> 3 then
    raise exception
      'E5 pós-assert: texto legado alterado (RACON=%, Racon=%; esperado 16/3).',
      v_racon_upper, v_racon_title;
  end if;
  if v_cotas <> 178 then
    raise exception 'E5 pós-assert: grupos_cotas=% (esperado 178).', v_cotas;
  end if;
end $$;

commit;
