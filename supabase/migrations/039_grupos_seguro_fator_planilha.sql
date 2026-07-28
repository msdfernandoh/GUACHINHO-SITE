-- Corrige seguro cadastrado como percentual/percentual absurdo (ex.: 1 = 1% a.m.).
-- A planilha usa fator 0,0004 (0,04% a.m. sobre o saldo).
-- Valores >= 0,5 eram lidos como >= 0,5% a.m. e inflavam a parcela pós (ex.: R$ 11 mil em vez de ~R$ 444).

update public.grupos_consorcio
set seguro_percentual = 0.0004
where seguro_percentual is not null
  and seguro_percentual >= 0.5;

-- Normaliza percentuais a.m. comuns (ex.: 0,04 → 0,0004) para o fator canônico.
update public.grupos_consorcio
set seguro_percentual = round((seguro_percentual / 100.0)::numeric, 6)
where seguro_percentual is not null
  and seguro_percentual >= 0.01
  and seguro_percentual < 0.5;
