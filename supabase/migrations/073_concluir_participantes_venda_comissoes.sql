-- 073: conclusão operacional da venda com Microfranquia principal e secundário opcional.
-- Forward-only; preserva 060–063 e só divide previsões novas, antes de sua gravação.
begin;

alter table public.contratacoes_online
  add column if not exists participante_secundario_id uuid references public.participantes_comerciais(id) on delete restrict,
  add column if not exists participante_secundario_fracao_percentual numeric(7,4);

alter table public.contratacoes_online
  drop constraint if exists contratacoes_participante_secundario_fracao_check,
  add constraint contratacoes_participante_secundario_fracao_check check (
    (participante_secundario_id is null and participante_secundario_fracao_percentual is null)
    or (participante_secundario_id is not null and participante_secundario_fracao_percentual > 0 and participante_secundario_fracao_percentual < 100)
  );

create or replace function public.vendas_criar_participantes_comerciais()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_contratacao record; v_config_id uuid; v_secundario_tipo text;
begin
  if new.contratacao_id is null then return new; end if;
  select participante_comercial_id, participante_secundario_id, participante_secundario_fracao_percentual
    into v_contratacao from public.contratacoes_online where id = new.contratacao_id and empresa_id = new.empresa_id;
  if v_contratacao.participante_comercial_id is null then return new; end if;
  insert into public.venda_participantes(empresa_id,venda_id,participante_comercial_id,papel,tipo_atuacao)
  values(new.empresa_id,new.id,v_contratacao.participante_comercial_id,'MICROFRANQUIA_PRINCIPAL','MICROFRANQUIA');
  if v_contratacao.participante_secundario_id is not null then
    select m.id into v_config_id from public.microfranquia_participantes_comissao m
      where m.empresa_id=new.empresa_id and m.microfranquia_participante_id=v_contratacao.participante_comercial_id
        and m.participante_secundario_id=v_contratacao.participante_secundario_id and m.ativo
        and m.inicio_vigencia <= new.data_venda::date and (m.fim_vigencia is null or m.fim_vigencia >= new.data_venda::date)
      order by m.inicio_vigencia desc limit 1;
    if v_config_id is null then raise exception 'O secundário não possui fração ativa configurada para esta Microfranquia'; end if;
    select pt.tipo_codigo into v_secundario_tipo from public.participante_tipos pt
      where pt.empresa_id=new.empresa_id and pt.participante_id=v_contratacao.participante_secundario_id
        and pt.tipo_codigo in ('SDR','PARCEIRO','CONSULTOR') order by pt.tipo_codigo limit 1;
    if v_secundario_tipo is null then raise exception 'O secundário precisa ter atuação SDR, PARCEIRO ou CONSULTOR'; end if;
    insert into public.venda_participantes(empresa_id,venda_id,participante_comercial_id,papel,tipo_atuacao,fracao_comissao_percentual,configuracao_origem_id)
    values(new.empresa_id,new.id,v_contratacao.participante_secundario_id,'PARTICIPANTE_SECUNDARIO',v_secundario_tipo,v_contratacao.participante_secundario_fracao_percentual,v_config_id);
  end if;
  return new;
end $$;

drop trigger if exists vendas_criar_participantes_comerciais on public.vendas;
create trigger vendas_criar_participantes_comerciais after insert on public.vendas
for each row execute function public.vendas_criar_participantes_comerciais();

create or replace function public.comissao_previsao_participante_repartir()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_principal record; v_secundario record; v_parte numeric(15,2); v_original numeric(15,2);
begin
  if coalesce(new.snapshot_regra->>'reparticao_comercial','') = 'aplicada' then return new; end if;
  select * into v_principal from public.venda_participantes where venda_id=new.venda_id and papel='MICROFRANQUIA_PRINCIPAL';
  select * into v_secundario from public.venda_participantes where venda_id=new.venda_id and papel='PARTICIPANTE_SECUNDARIO';
  if v_principal.id is null or v_secundario.id is null or new.participante_comercial_id is distinct from v_principal.participante_comercial_id then return new; end if;
  v_original:=new.valor_previsto; v_parte:=round(v_original*v_secundario.fracao_comissao_percentual/100,2);
  new.valor_previsto:=v_original-v_parte;
  new.snapshot_regra:=new.snapshot_regra || jsonb_build_object('reparticao_comercial','aplicada','venda_participante_id',v_principal.id,'valor_original',v_original,'fracao_secundario_percentual',v_secundario.fracao_comissao_percentual);
  insert into public.comissao_previsoes_participantes(empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,organizacao_parceira_id,regra_participante_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,valor_fixo_aplicado,valor_previsto,status,snapshot_regra)
  values(new.empresa_id,new.venda_id,new.cota_definitiva_id,v_secundario.participante_comercial_id,null,new.regra_participante_id,new.ordem_etapa,new.nome_etapa,new.competencia,new.base_calculo_valor,new.percentual_aplicado,new.valor_fixo_aplicado,v_parte,new.status,new.snapshot_regra || jsonb_build_object('venda_participante_id',v_secundario.id,'beneficiario_secundario',true));
  return new;
end $$;

drop trigger if exists comissao_previsao_participante_repartir on public.comissao_previsoes_participantes;
create trigger comissao_previsao_participante_repartir before insert on public.comissao_previsoes_participantes
for each row execute function public.comissao_previsao_participante_repartir();

commit;
