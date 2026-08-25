-- 115: Suporte a alteração de Modelo de Comissão do Principal e Secundário na Edição Master de Venda
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_master_atualizar_dados_venda(
  p_empresa_id uuid,
  p_venda_id uuid,
  p_numero_cota text,
  p_participante_principal_id uuid,
  p_participante_secundario_id uuid,
  p_fracao_secundario numeric,
  p_data_primeira_parcela date,
  p_data_segunda_parcela date,
  p_recalcular_comissoes_futuras boolean DEFAULT true,
  p_perfil_principal_id uuid DEFAULT NULL,
  p_perfil_secundario_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado: operação restrita ao tenant master';
  END IF;

  UPDATE public.vendas
  SET participante_comercial_id = p_participante_principal_id,
      participante_secundario_id = p_participante_secundario_id,
      participante_secundario_fracao_percentual = p_fracao_secundario,
      perfil_principal_id = p_perfil_principal_id,
      perfil_secundario_id = p_perfil_secundario_id,
      data_primeira_parcela = p_data_primeira_parcela,
      data_segunda_parcela = p_data_segunda_parcela,
      updated_at = now()
  WHERE id = p_venda_id AND empresa_id = p_empresa_id;

  UPDATE public.cotas_definitivas
  SET numero_cota = NULLIF(trim(p_numero_cota), ''),
      participante_comercial_id = p_participante_principal_id,
      updated_at = now()
  WHERE venda_id = p_venda_id AND empresa_id = p_empresa_id;

  IF p_recalcular_comissoes_futuras THEN
    -- Limpa previsões não pagas e regera no motor V2 com o novo perfil
    DELETE FROM public.comissao_previsoes_participantes WHERE venda_id = p_venda_id AND status IN ('prevista', 'elegivel');
    DELETE FROM public.comissao_previsoes_franquia WHERE venda_id = p_venda_id AND status = 'prevista';
    PERFORM public.rpc_gerar_previsoes_comissao_v2(p_empresa_id, p_venda_id, 'recalculo_perfil:' || p_venda_id || ':' || extract(epoch from now())::text);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'venda_id', p_venda_id,
    'perfil_principal_id', p_perfil_principal_id,
    'perfil_secundario_id', p_perfil_secundario_id
  );
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
