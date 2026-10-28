-- Diagnóstico somente leitura. Não executado: revisão automática indisponível.
-- Consulta catálogo ativo; não acessa clientes, propostas ou fatos financeiros.
-- Referência teórica é triagem, não substitui tabela oficial Prorrogada/Diluída.
with cotas as (
  select g.id grupo_id, g.codigo_grupo, g.prazo_total,
    g.taxa_administrativa_percentual, g.fundo_reserva_percentual,
    g.seguro_percentual, c.id cota_id, c.tipo_transcorrido, c.valor_credito,
    c.parcela_integral, c.parcela_reduzida_50, c.parcela_reduzida_60,
    c.parcela_reduzida_70, c.parcelas_reduzidas, c.updated_at,
    row_number() over (
      partition by g.id, c.tipo_transcorrido order by c.valor_credito, c.id
    ) ordem_credito,
    lead(c.valor_credito) over (
      partition by g.id, c.tipo_transcorrido order by c.valor_credito, c.id
    ) proximo_credito,
    lead(c.parcela_reduzida_60) over (
      partition by g.id, c.tipo_transcorrido order by c.valor_credito, c.id
    ) proxima_reduzida_60
  from public.grupos_consorcio g
  join public.grupos_cotas c on c.grupo_id = g.id
  where g.ativo = true and c.ativo = true
    and c.status not in ('Inativo', 'Esgotado')
)
select *,
  round(valor_credito * (
    1 + coalesce(taxa_administrativa_percentual,0)/100
      + coalesce(fundo_reserva_percentual,0)/100
  ) / nullif(prazo_total,0) * 0.60, 2) referencia_reduzida_60,
  (parcela_reduzida_60 > proxima_reduzida_60) menor_com_parcela_maior,
  (parcela_reduzida_60 > valor_credito * 0.20) bloqueada_pelo_guard_atual
from cotas
-- As duas primeiras opções permitem comparar a menor com a seguinte.
where ordem_credito <= 2
order by codigo_grupo, tipo_transcorrido, ordem_credito;
