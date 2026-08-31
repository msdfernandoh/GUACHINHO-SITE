"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { dataParcelaLegado, type ClienteLegadoLinha, type DiagnosticoClienteLegado } from "@/lib/erp/clientes-legado";

type PreviewInput = { linhas: ClienteLegadoLinha[]; regraId: string | null; semComissao: boolean; dataReferencia: string };
type ImportInput = PreviewInput & { participanteId: string | null; arquivoNome: string; arquivoHash: string; idempotencyKey: string };

export async function preverImportacaoLegadoAction(input: PreviewInput) {
  const { empresaAtiva } = await requireErpRouteAccess("clientes");
  if (!empresaAtiva) throw new Error("Empresa ativa não encontrada.");
  if (!input.linhas.length || input.linhas.length > 2000) throw new Error("A planilha deve conter entre 1 e 2.000 linhas.");
  const db = await createClient();
  const { error: preparoError } = await db.rpc("rpc_preparar_catalogo_importacao_legado_racon", {
    p_empresa_id: empresaAtiva.id,
    p_itens: input.linhas,
  });
  if (preparoError) throw new Error(`Não foi possível preparar grupos legados: ${preparoError.message}`);
  const { data: admins } = await db.from("administradoras").select("id,nome,nome_fantasia").eq("status", "ATIVA");
  const racon = (admins ?? []).find((item) => `${item.nome ?? ""} ${item.nome_fantasia ?? ""}`.toUpperCase().includes("RACON"));
  if (!racon) throw new Error("Administradora Racon ativa não encontrada.");

  const [{ data: grupos }, { data: importados }] = await Promise.all([
    db.from("grupos_consorcio").select("id,codigo_grupo,grupos_cotas!inner(id)").eq("administradora_id", racon.id).eq("ativo", true),
    db.from("importacao_clientes_legado_itens").select("numero_grupo,numero_cota").eq("empresa_id", empresaAtiva.id).eq("status", "IMPORTADO"),
  ]);
  const numeroGrupo = (value: string) => value.replace(/\D/g, "");
  const gruposOk = new Set((grupos ?? []).map((item) => numeroGrupo(String(item.codigo_grupo))));
  const cotasImportadas = new Set((importados ?? []).map((item) => `${numeroGrupo(item.numero_grupo)}::${item.numero_cota}`));
  const vistos = new Set<string>();
  let etapas: Array<{ mes_relativo: number | null }> = [];
  let vigenciaRegra: { inicio: string; fim: string | null } | null = null;
  if (!input.semComissao) {
    if (!input.regraId) throw new Error("Selecione a regra histórica ou marque importação sem comissão.");
    const [{ data }, { data: regra }] = await Promise.all([
      db.from("comissao_regra_etapas").select("mes_relativo,tipo_gatilho").eq("regra_franquia_id", input.regraId).eq("tipo_gatilho", "MES_RELATIVO"),
      db.from("comissao_regras_franquia").select("vigencia_inicio,vigencia_fim").eq("id", input.regraId).eq("empresa_id", empresaAtiva.id).maybeSingle(),
    ]);
    if (!regra) throw new Error("A regra histórica selecionada não pertence à empresa ativa.");
    etapas = data ?? [];
    vigenciaRegra = { inicio: regra.vigencia_inicio, fim: regra.vigencia_fim };
  }

  const diagnosticos: DiagnosticoClienteLegado[] = input.linhas.map((linha) => {
    const pendencias: string[] = [];
    const erros: string[] = [];
    const doc = linha.cpf_cnpj.replace(/\D/g, "");
    const tel = linha.telefone.replace(/\D/g, "");
    if (![11, 14].includes(doc.length)) pendencias.push("PENDENTE_CPF_CNPJ");
    if (tel.length < 10) pendencias.push("PENDENTE_TELEFONE");
    if (!linha.cliente_nome) erros.push("Nome não informado");
    if (!linha.data_contrato) erros.push("Data do contrato inválida");
    if (linha.data_contrato && vigenciaRegra && (linha.data_contrato < vigenciaRegra.inicio || (vigenciaRegra.fim && linha.data_contrato > vigenciaRegra.fim))) {
      erros.push(`Contrato fora da vigência da regra (${vigenciaRegra.inicio} a ${vigenciaRegra.fim ?? "sem término"})`);
    }
    if (!linha.grupo) erros.push("Grupo não informado");
    if (!linha.cota) erros.push("Cota não informada");
    if (!(linha.valor_credito > 0)) erros.push("Valor inválido");
    if (!linha.administradora.toUpperCase().includes("RACON")) erros.push("Administradora diferente de Racon");
    const grupoEncontrado = gruposOk.has(numeroGrupo(linha.grupo));
    if (!grupoEncontrado) erros.push("Grupo Racon não pôde ser preparado para importação");
    const natural = `${numeroGrupo(linha.grupo)}::${linha.cota.trim()}`;
    const duplicada = vistos.has(natural) || cotasImportadas.has(natural);
    if (duplicada) erros.push("Grupo/cota já consta no arquivo ou em importação anterior");
    vistos.add(natural);
    const previsoesFuturas = input.semComissao ? 0 : etapas.filter((etapa) => etapa.mes_relativo && dataParcelaLegado(linha.data_contrato, etapa.mes_relativo) >= input.dataReferencia).length;
    return { ...linha, pendencias, erros, grupo_encontrado: grupoEncontrado, duplicada, previsoes_futuras: previsoesFuturas };
  });
  return {
    diagnosticos,
    resumo: {
      total: diagnosticos.length,
      aptas: diagnosticos.filter((item) => item.erros.length === 0).length,
      comPendencias: diagnosticos.filter((item) => item.pendencias.length > 0 && item.erros.length === 0).length,
      bloqueadas: diagnosticos.filter((item) => item.erros.length > 0).length,
      previsoesFuturas: diagnosticos.reduce((total, item) => total + item.previsoes_futuras, 0),
    },
  };
}

export async function confirmarImportacaoLegadoAction(input: ImportInput) {
  const { empresaAtiva } = await requireErpRouteAccess("clientes");
  if (!empresaAtiva) throw new Error("Empresa ativa não encontrada.");
  const preview = await preverImportacaoLegadoAction(input);
  if (preview.resumo.bloqueadas > 0) throw new Error(`A importação possui ${preview.resumo.bloqueadas} linha(s) bloqueada(s). Corrija a planilha antes de confirmar.`);
  if (!input.semComissao && !input.participanteId) throw new Error("Selecione o sócio/beneficiário das comissões futuras.");
  const db = await createClient();
  const { data, error } = await db.rpc("rpc_importar_clientes_legado_racon", {
    p_empresa_id: empresaAtiva.id,
    p_arquivo_nome: input.arquivoNome,
    p_arquivo_hash: input.arquivoHash,
    p_idempotency_key: input.idempotencyKey,
    p_itens: input.linhas,
    p_regra_franquia_id: input.regraId,
    p_participante_comercial_id: input.participanteId,
    p_sem_comissao: input.semComissao,
    p_data_referencia: input.dataReferencia,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/erp/clientes");
  revalidatePath("/erp/clientes/importar");
  revalidatePath("/erp/minhas-comissoes");
  return data as { lote_id: string; idempotente: boolean; total_importadas: number; total_pendencias: number; total_previsoes_futuras: number };
}
