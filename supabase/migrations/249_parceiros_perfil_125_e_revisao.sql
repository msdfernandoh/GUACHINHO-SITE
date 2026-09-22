-- Parceiros do programa começam no perfil existente de 12,5%, sem criar perfil.
-- A mudança posterior é manual e só é sinalizada após a primeira indicação.
begin;

do $$
declare
  v_empresa uuid;
  v_perfil_125 uuid;
  v_perfil_antigo uuid;
  v_imovel uuid;
  v_veiculo uuid;
  v_regra public.comissao_regras_participantes%rowtype;
  v_def text;
  v_antigo text := 'AND pc.papel_tipo=''INDICADOR'' AND cp.papel_base=''INDICADOR'' AND cp.ativo';
  v_novo text := 'AND pc.papel_tipo=''INDICADOR'' AND (cp.papel_base=''INDICADOR'' OR (cp.papel_base=''SDR'' AND cp.nome=''Gerador de Oportunidades'')) AND cp.ativo';
begin
  select id into strict v_empresa from public.empresas where slug='gauchinho';
  select id into strict v_perfil_125 from public.comissao_perfis
    where empresa_id=v_empresa and nome='Gerador de Oportunidades' and papel_base='SDR' and ativo;
  select id into strict v_perfil_antigo from public.comissao_perfis
    where empresa_id=v_empresa and nome='Indicador' and papel_base='INDICADOR' and ativo;
  select id into strict v_veiculo from public.comissao_programas
    where empresa_id=v_empresa and nome='Racon Veiculo — Comissão';

  select * into strict v_regra from public.comissao_regras_participantes
    where empresa_id=v_empresa and perfil_id=v_perfil_125
      and programa_id in (select id from public.comissao_programas
        where empresa_id=v_empresa and nome='Racon Imóvel — Comissão V2')
      and ativa and configuracao_homologada and status='HOMOLOGADA';
  v_imovel := v_regra.programa_id;
  if v_regra.percentual_comissao <> 12.5 then
    raise exception 'Regra existente do Gerador de Oportunidades não é 12,5%%';
  end if;

  if not exists (select 1 from public.comissao_regras_participantes
    where empresa_id=v_empresa and perfil_id=v_perfil_125 and programa_id=v_veiculo
      and ativa and configuracao_homologada and status='HOMOLOGADA') then
    insert into public.comissao_regras_participantes (
      empresa_id,programa_id,participante_comercial_id,tipo_participante,
      organizacao_parceira_id,percentual_comissao,base_calculo,ativa,versao,
      vigencia_inicio,vigencia_fim,modalidade,opcao_cota_id,plano_condicao,
      valor_fixo_total,etapas_cronograma,configuracao_homologada,
      origem_configuracao,tipo_administradora_id,modalidade_comissao_id,
      modo_regra,base_v2,fonte_comissao,perfil_id,curva_estorno_id,
      aplicar_curva_estorno,seguir_cronograma_franquia,status,nome_regra,
      observacoes,participante_tipo_id,aplicar_desconto_impostos
    ) values (
      v_regra.empresa_id,v_veiculo,v_regra.participante_comercial_id,v_regra.tipo_participante,
      v_regra.organizacao_parceira_id,v_regra.percentual_comissao,v_regra.base_calculo,true,v_regra.versao,
      current_date,v_regra.vigencia_fim,v_regra.modalidade,v_regra.opcao_cota_id,v_regra.plano_condicao,
      v_regra.valor_fixo_total,v_regra.etapas_cronograma,true,
      'MIGRATION_249_REGRA_VEICULO_125',v_regra.tipo_administradora_id,v_regra.modalidade_comissao_id,
      v_regra.modo_regra,v_regra.base_v2,v_regra.fonte_comissao,v_regra.perfil_id,v_regra.curva_estorno_id,
      v_regra.aplicar_curva_estorno,v_regra.seguir_cronograma_franquia,'HOMOLOGADA',
      'Gerador de Oportunidades 12,5% — Veículo',
      'Mesma condição homologada para o perfil no programa Racon Imóvel.',
      v_regra.participante_tipo_id,v_regra.aplicar_desconto_impostos
    );
  end if;

  -- A indicação continua sendo a função técnica; muda apenas o perfil atribuído.
  update public.participante_comissao_perfis pcp
  set perfil_id=v_perfil_125, updated_at=now()
  where pcp.empresa_id=v_empresa and pcp.perfil_id=v_perfil_antigo
    and pcp.papel_tipo='INDICADOR' and pcp.ativo
    and exists (select 1 from public.programa_indicadores i
      where i.empresa_id=v_empresa and i.participante_id=pcp.participante_id
        and i.origem_cadastro='LANDING_PARCEIROS')
    and not exists (select 1 from public.participante_comissao_perfis outro
      where outro.empresa_id=v_empresa and outro.participante_id=pcp.participante_id
        and outro.papel_tipo='INDICADOR' and outro.perfil_id=v_perfil_125);

  insert into public.participante_tipos (empresa_id,participante_id,tipo_codigo)
  select i.empresa_id,i.participante_id,'CONSULTOR'
  from public.programa_indicadores i
  where i.empresa_id=v_empresa and i.origem_cadastro='LANDING_PARCEIROS'
    and not exists (select 1 from public.participante_tipos pt
      where pt.participante_id=i.participante_id and pt.tipo_codigo='CONSULTOR');

  v_def := pg_get_functiondef('public.comissao_gerar_indicador_176(uuid,uuid)'::regprocedure);
  if position(v_antigo in v_def)>0 then
    execute replace(v_def,v_antigo,v_novo);
  elsif position(v_novo in v_def)=0 then
    raise exception 'Motor de comissão alterado; revisão manual necessária';
  end if;
end $$;

create or replace function public.programa_indicacao_sinalizar_revisao_perfil()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_modelo text; v_status text;
begin
  select modelo_interesse,status_solicitacao_modelo into v_modelo,v_status
  from public.programa_indicadores
  where id=new.indicador_id and empresa_id=new.empresa_id
    and origem_cadastro='LANDING_PARCEIROS';
  if not found or v_status <> 'APROVADO_NIVEL_1' then return new; end if;
  update public.programa_indicadores
  set status_solicitacao_modelo='EM_ANALISE'
  where id=new.indicador_id and empresa_id=new.empresa_id
    and status_solicitacao_modelo='APROVADO_NIVEL_1';
  if v_modelo in ('MICROFRANQUEADO','GERADOR_NEGOCIOS','GERADOR_POSSIBILIDADES') then
    insert into public.programa_indicadores_solicitacoes
      (empresa_id,indicador_id,modelo_solicitado,status)
    values (new.empresa_id,new.indicador_id,v_modelo,'EM_ANALISE')
    on conflict (empresa_id,indicador_id,modelo_solicitado,status) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists programa_indicacao_sinalizar_revisao_perfil on public.programa_indicacoes;
create trigger programa_indicacao_sinalizar_revisao_perfil
after insert on public.programa_indicacoes for each row
execute function public.programa_indicacao_sinalizar_revisao_perfil();

-- Cadastros que já fizeram ao menos uma indicação antes desta migration também
-- entram na fila do gestor, sem trocar automaticamente o modelo escolhido.
update public.programa_indicadores i
set status_solicitacao_modelo='EM_ANALISE'
where i.origem_cadastro='LANDING_PARCEIROS'
  and i.status_solicitacao_modelo='APROVADO_NIVEL_1'
  and exists (select 1 from public.programa_indicacoes pi where pi.indicador_id=i.id and pi.empresa_id=i.empresa_id);

insert into public.programa_indicadores_solicitacoes
  (empresa_id,indicador_id,modelo_solicitado,status)
select i.empresa_id,i.id,i.modelo_interesse,'EM_ANALISE'
from public.programa_indicadores i
where i.origem_cadastro='LANDING_PARCEIROS'
  and i.status_solicitacao_modelo='EM_ANALISE'
  and i.modelo_interesse in ('MICROFRANQUEADO','GERADOR_NEGOCIOS','GERADOR_POSSIBILIDADES')
on conflict (empresa_id,indicador_id,modelo_solicitado,status) do nothing;

revoke all on function public.programa_indicacao_sinalizar_revisao_perfil() from public,anon,authenticated;
grant execute on function public.programa_indicacao_sinalizar_revisao_perfil() to service_role;

commit;
notify pgrst, 'reload schema';
