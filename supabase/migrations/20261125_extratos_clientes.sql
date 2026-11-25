create table if not exists public.extratos_clientes_envios (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id),
 cliente_id uuid not null references public.clientes(id),
 competencia date not null,
 enviado_em timestamptz not null default now(),
 criado_por uuid not null default auth.uid(),
 unique(empresa_id,cliente_id,competencia)
);
alter table public.extratos_clientes_envios enable row level security;
grant select,insert on public.extratos_clientes_envios to authenticated;
create policy extratos_leitura on public.extratos_clientes_envios for select to authenticated using (can_read_tenant_internal(empresa_id));
create policy extratos_registro on public.extratos_clientes_envios for insert to authenticated with check (
 criado_por=auth.uid() and (has_company_permission(empresa_id,'gerenciar_leads') or has_company_permission(empresa_id,'gerenciar_propostas'))
 and exists(select 1 from public.clientes c where c.id=cliente_id and c.empresa_id=extratos_clientes_envios.empresa_id)
);
create or replace function public.rpc_listar_extratos_clientes(p_empresa_id uuid,p_busca text default '',p_mes text default null,p_pagina int default 1)
returns jsonb language sql stable security invoker set search_path=public as $$
 with carteira as (
 select cl.id,cl.nome, count(*) quantidade,
 string_agg(distinct c.numero_grupo||' / '||c.numero_cota,', ') cotas,
 bool_or(exists(select 1 from jsonb_array_elements(
 case when jsonb_typeof(c.snapshot_cota#>'{historico_reajustes_newcon,registros}')='array'
 then c.snapshot_cota#>'{historico_reajustes_newcon,registros}' else '[]'::jsonb end) r
 where r->>'tipo'='X' and left(r->>'data_iso',7)=p_mes
 and r->>'data_iso'>=coalesce(c.data_adesao_newcon,v.data_venda::date)::text)) reajustou
 from public.clientes cl join public.vendas v on v.cliente_id=cl.id and v.empresa_id=cl.empresa_id
 join public.cotas_definitivas c on c.venda_id=v.id and c.empresa_id=v.empresa_id
 where cl.empresa_id=p_empresa_id and can_read_tenant_internal(p_empresa_id)
 and c.status<>'cancelada' and v.status<>'cancelada'
 group by cl.id,cl.nome
 ), filtrados as (
 select * from carteira where (coalesce(p_busca,'')='' or nome ilike '%'||p_busca||'%' or cotas ilike '%'||p_busca||'%')
 and (p_mes is null or reajustou)
 ), pagina as (select * from filtrados order by nome,id limit 25 offset (greatest(1,least(coalesce(p_pagina,1),100000))-1)*25)
 select jsonb_build_object('total',(select count(*) from filtrados),'clientes',coalesce((select jsonb_agg(to_jsonb(pagina)) from pagina),'[]'::jsonb))
$$;
revoke all on function public.rpc_listar_extratos_clientes(uuid,text,text,int) from public,anon;
grant execute on function public.rpc_listar_extratos_clientes(uuid,text,text,int) to authenticated;
