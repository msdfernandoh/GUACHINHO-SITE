"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenantPermission, requireCurrentTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { converterContratacaoEmVenda } from "@/lib/vendas/vendas-service";
import { assertSnapshotCalculoGruposIntegro, calcularHashSnapshotGrupos } from "@/lib/contratacoes-online/snapshot-calculo-grupos";
import { assertSelecoesAutorizadasForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
import { parcelaDaNovaCota, valoresNovaCota } from "@/lib/erp/valores-nova-cota";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function excluirContratacoesEmLoteAction(formData: FormData): Promise<
  { ok: true; quantidade: number } | { ok: false; error: string }
> {
  try {
    const context = await requireTenantPermission("formalizar_vendas");
    if (context.vinculoAtivo.papel?.codigo !== "admin_empresa" && !(await isPlatformSuperadmin())) {
      throw new Error("Apenas o usuário Master pode excluir contratações em lote.");
    }
    const ids = [...new Set(formData.getAll("ids").map(String).filter((id) => UUID.test(id)))].slice(0, 200);
    if (!ids.length) throw new Error("Selecione ao menos uma contratação.");
    const db = await createClient();
    const { data, error } = await db.rpc("rpc_master_excluir_pre_cota_em_lote", {
      p_empresa_id: context.empresaAtiva.id,
      p_tipo: "CONTRATACAO",
      p_ids: ids,
      p_motivo: "Exclusão em lote na fila de contratações do ERP",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/contratacoes");
    return { ok: true, quantidade: Number((data as { quantidade?: number } | null)?.quantidade ?? ids.length) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Não foi possível excluir as contratações." };
  }
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function classificarPendencia(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("grupo")) return "GRUPO_NAO_CONFIGURADO";
  if (normalized.includes("produto") || normalized.includes("cota")) return "PRODUTO_COMERCIAL_AUSENTE";
  if (normalized.includes("consultor") || normalized.includes("participante")) return "CONSULTOR_INVALIDO";
  if (normalized.includes("comiss") || normalized.includes("regra") || normalized.includes("programa")) return "REGRA_COMISSAO_AUSENTE";
  if (normalized.includes("documento")) return "DOCUMENTO_OBRIGATORIO_AUSENTE";
  if (normalized.includes("cliente")) return "CLIENTE_INCOMPLETO";
  if (normalized.includes("venda já") || normalized.includes("venda existente")) return "VENDA_JA_EXISTENTE";
  return "DADOS_INCOMPLETOS";
}

export async function formalizarContratacaoAction(formData: FormData) {
  const { empresaAtiva } = await requireTenantPermission("formalizar_vendas");
  const contratacaoId = value(formData, "contratacao_id");
  const grupoId = value(formData, "grupo_id");
  const opcaoCotaId = value(formData, "opcao_cota_id");
  const principalId = value(formData, "participante_principal_id");
  let secundarioId = value(formData, "participante_secundario_id") || null;
  let fracao = value(formData, "fracao_secundario");
  const perfilPrincipalId = value(formData, "perfil_principal_id") || null;
  let perfilSecundarioId = value(formData, "perfil_secundario_id") || null;
  const modalidadeComissaoId = value(formData, "modalidade_comissao_id");
  const cronogramaSecundario = value(formData, "cronograma_secundario") || "SEGUIR_PRINCIPAL";
  const dataPrimeiraParcela = value(formData, "data_primeira_parcela") || null;
  const dataSegundaParcela = value(formData, "data_segunda_parcela") || null;
  const quantidadeCotas = Number(value(formData, "quantidade_cotas"));
  const taxaAjustadaRaw = value(formData, "taxa_administracao_ajustada");
  const parcelaAjustadaRaw = value(formData, "valor_parcela_ajustado");
  const motivoPromo = value(formData, "motivo_ajuste_promocional");
  const admin = createAdminClient();
  const db = await createClient();
  let dadosSimulacaoAtual: Record<string, unknown> = {};
  try {
    const { data: contratacao, error: contratacaoError } = await admin
      .from("contratacoes_online")
      .select("id,nome,cpf,cnpj,email,telefone,cliente_id,lead_id,contrato_assinado,dados_simulacao,parcela_estimada,status,updated_at")
      .eq("id", contratacaoId).eq("empresa_id", empresaAtiva.id).is("excluido_at", null).maybeSingle();
    if (contratacaoError || !contratacao) throw new Error(contratacaoError?.message || "Contratação não encontrada.");
    dadosSimulacaoAtual = (contratacao.dados_simulacao ?? {}) as Record<string, unknown>;
    if (contratacao.lead_id) {
      const { data: indicacao } = await admin
        .from("programa_indicacoes")
        .select("indicador_id")
        .eq("empresa_id", empresaAtiva.id)
        .eq("lead_id", contratacao.lead_id)
        .maybeSingle();
      if (indicacao?.indicador_id) {
        const { data: indicadorAtivo } = await admin
          .from("programa_indicadores")
          .select("participante_id")
          .eq("empresa_id", empresaAtiva.id)
          .eq("id", indicacao.indicador_id)
          .eq("ativo", true)
          .maybeSingle();
        if (indicadorAtivo?.participante_id) {
          // O indicador é materializado como PARTICIPANTE_SECUNDARIO pelo
          // gatilho da venda e remunerado pela regra INDICADOR. Não o duplica
          // no rateio manual da contratação.
          secundarioId = null;
          perfilSecundarioId = null;
          fracao = "";
        }
      }
    }
    if (typeof dadosSimulacaoAtual.proposta_opcao_indice === "number" &&
      (dadosSimulacaoAtual.proposta_grupo_id !== grupoId || dadosSimulacaoAtual.proposta_cota_id !== opcaoCotaId ||
        Number(dadosSimulacaoAtual.quantidade_cotas) !== quantidadeCotas)) {
      throw new Error("Use o grupo, a cota e a quantidade da opção escolhida na proposta.");
    }
    if (!contratacao.contrato_assinado) throw new Error("Contrato ainda não foi assinado.");
    assertSnapshotCalculoGruposIntegro(
      (contratacao.dados_simulacao ?? {}) as Record<string, unknown>,
    );

    const taxaAjustada = taxaAjustadaRaw ? Number(taxaAjustadaRaw) : null;
    const parcelaAjustada = parcelaAjustadaRaw ? Number(parcelaAjustadaRaw) : null;
    const temAjustePromocional = (taxaAjustada !== null && !isNaN(taxaAjustada)) || (parcelaAjustada !== null && !isNaN(parcelaAjustada));

    if (temAjustePromocional) {
      if (taxaAjustada !== null && (isNaN(taxaAjustada) || taxaAjustada < 0 || taxaAjustada > 100)) {
        throw new Error("Taxa de administração promocional inválida.");
      }
      if (parcelaAjustada !== null && (isNaN(parcelaAjustada) || parcelaAjustada <= 0)) {
        throw new Error("Valor da parcela promocional inválido.");
      }

      const dadosSimulacaoOriginal = ((contratacao.dados_simulacao ?? {}) as Record<string, unknown>);
      const novoDadosSimulacao: Record<string, unknown> = {
        ...dadosSimulacaoOriginal,
        ajuste_promocional: {
          aplicado: true,
          taxa_administracao_ajustada: taxaAjustada !== null && !isNaN(taxaAjustada) ? taxaAjustada : null,
          valor_parcela_ajustada: parcelaAjustada !== null && !isNaN(parcelaAjustada) ? parcelaAjustada : null,
          motivo: motivoPromo || "Ajuste comercial / promoção de fechamento",
          aplicado_em: new Date().toISOString(),
        },
      };
      dadosSimulacaoAtual = novoDadosSimulacao;

      if (parcelaAjustada !== null && !isNaN(parcelaAjustada) && parcelaAjustada > 0) {
        novoDadosSimulacao.valor_parcela = parcelaAjustada;
        novoDadosSimulacao.primeiraParcelaTotal = parcelaAjustada;
        if (Array.isArray(novoDadosSimulacao.selecoes) && novoDadosSimulacao.selecoes[0]) {
          const selecao0 = { ...(novoDadosSimulacao.selecoes[0] as Record<string, unknown>) };
          if (selecao0.resultado && typeof selecao0.resultado === "object") {
            selecao0.resultado = {
              ...(selecao0.resultado as Record<string, unknown>),
              primeiraParcela: parcelaAjustada,
            };
          }
          novoDadosSimulacao.selecoes = [selecao0, ...novoDadosSimulacao.selecoes.slice(1)];
        }
        if (novoDadosSimulacao.totais && typeof novoDadosSimulacao.totais === "object") {
          novoDadosSimulacao.totais = {
            ...(novoDadosSimulacao.totais as Record<string, unknown>),
            primeiraParcela: parcelaAjustada,
          };
        }
      }

      if (taxaAjustada !== null && !isNaN(taxaAjustada) && taxaAjustada >= 0) {
        novoDadosSimulacao.taxa_administrativa = taxaAjustada;
        if (Array.isArray(novoDadosSimulacao.selecoes) && novoDadosSimulacao.selecoes[0]) {
          const selecao0 = { ...(novoDadosSimulacao.selecoes[0] as Record<string, unknown>) };
          if (selecao0.grupo && typeof selecao0.grupo === "object") {
            selecao0.grupo = {
              ...(selecao0.grupo as Record<string, unknown>),
              taxa_administrativa_percentual: taxaAjustada,
            };
          }
          novoDadosSimulacao.selecoes = [selecao0, ...novoDadosSimulacao.selecoes.slice(1)];
        }
      }

      if (novoDadosSimulacao.snapshot_calculo && typeof novoDadosSimulacao.snapshot_calculo === "object") {
        const novoHash = calcularHashSnapshotGrupos(novoDadosSimulacao);
        novoDadosSimulacao.snapshot_calculo = {
          ...(novoDadosSimulacao.snapshot_calculo as Record<string, unknown>),
          hash_sha256: novoHash,
          atualizado_em: new Date().toISOString(),
        };
      }

      const updatePayload: Record<string, unknown> = {
        dados_simulacao: novoDadosSimulacao,
      };
      if (parcelaAjustada !== null && !isNaN(parcelaAjustada) && parcelaAjustada > 0) {
        updatePayload.parcela_estimada = parcelaAjustada;
      }

      const { error: updatePromoError } = await admin
        .from("contratacoes_online")
        .update(updatePayload)
        .eq("id", contratacaoId)
        .eq("empresa_id", empresaAtiva.id);
      if (updatePromoError) throw new Error(`Erro ao aplicar ajuste comercial: ${updatePromoError.message}`);

      await admin.from("contratacoes_formalizacao_historico").insert({
        empresa_id: empresaAtiva.id,
        contratacao_id: contratacaoId,
        evento: "AJUSTE_PROMOCIONAL_APLICADO",
        descricao: `Ajuste comercial aplicado antes da formalização. Parcela: ${parcelaAjustada ? `R$ ${parcelaAjustada}` : "mantida"}, Taxa: ${taxaAjustada ? `${taxaAjustada}%` : "mantida"}.${motivoPromo ? ` Motivo: ${motivoPromo}` : ""}`,
        dados: {
          taxa_administracao_ajustada: taxaAjustada,
          valor_parcela_ajustada: parcelaAjustada,
          motivo: motivoPromo,
        },
      });
    }

    if (!(contratacao.cpf || contratacao.cnpj) || !contratacao.nome || !contratacao.telefone || !contratacao.email) throw new Error("Cliente incompleto: nome, documento, telefone e e-mail são obrigatórios.");
    const { count: documentos, error: documentosError } = await admin.from("contratacoes_documentos").select("id", { count: "exact", head: true }).eq("contratacao_id", contratacaoId);
    if (documentosError) throw new Error(documentosError.message);
    if (!documentos) throw new Error("Documento obrigatório ausente.");

    if (!grupoId || !opcaoCotaId || !principalId || !modalidadeComissaoId) {
      throw new Error("Grupo, produto, modalidade e participante comercial principal são obrigatórios.");
    }
    if (!Number.isInteger(quantidadeCotas) || quantidadeCotas < 1 || quantidadeCotas > 100) {
      throw new Error("A quantidade de cotas deve ser um número inteiro entre 1 e 100.");
    }

    if (contratacao.status !== "finalizada" && dadosSimulacaoAtual.origem_operacional === "NOVA_COTA_CLIENTE") {
      if (!contratacao.cliente_id || taxaAjustadaRaw || parcelaAjustadaRaw) {
        throw new Error("A nova cota requer cliente vinculado e condições do catálogo.");
      }
      const seguro = value(formData, "usa_seguro");
      if (seguro !== "sim" && seguro !== "nao") throw new Error("Escolha com ou sem seguro.");
      const catalogo = await assertSelecoesAutorizadasForEmpresa(empresaAtiva.id, [{ grupoId, cotaId: opcaoCotaId }]);
      const grupo = catalogo.grupos.get(grupoId)!;
      const cota = catalogo.cotas.get(opcaoCotaId)!;
      const [{ data: habilitada, error: erroGrupo }, { data: homologada, error: erroValor }, { data: modalidade, error: erroModalidade }] = await Promise.all([
        admin.from("grupos_modalidades_disponiveis").select("administradora_modalidade_id")
          .eq("grupo_id", grupoId).eq("administradora_modalidade_id", modalidadeComissaoId).eq("ativo", true).maybeSingle(),
        admin.from("grupo_cota_modalidade_valores").select("valor_parcela,percentual_reducao")
          .eq("grupo_cota_id", opcaoCotaId).eq("administradora_modalidade_id", modalidadeComissaoId)
          .eq("habilitado", true).eq("ativo", true).maybeSingle(),
        admin.from("administradora_modalidades_comissao").select("codigo").eq("id", modalidadeComissaoId)
          .eq("administradora_id", grupo.administradora_id).eq("ativo", true).maybeSingle(),
      ]);
      const credito = Number(cota.valor_credito);
      const parcela = modalidade && parcelaDaNovaCota(grupo, cota, modalidade.codigo, homologada);
      if (erroGrupo || erroModalidade || erroValor || !habilitada || !parcela || !Number.isFinite(credito) || credito <= 0) {
        throw new Error("A modalidade não tem parcela disponível para esta cota.");
      }
      const numeroCota = value(formData, "numero_cota");
      if (numeroCota && (!/^\d{1,15}$/.test(numeroCota) || quantidadeCotas !== 1)) {
        throw new Error("Informe o número da cota somente para uma cota individual.");
      }
      const valores = valoresNovaCota(credito, parcela.valor_parcela, grupo, seguro === "sim");
      if (seguro === "sim" && valores.seguroMensal <= 0) throw new Error("O grupo escolhido não oferece seguro.");
      dadosSimulacaoAtual = {
        ...dadosSimulacaoAtual,
        grupoId,
        cotaId: opcaoCotaId,
        modalidade_comissao_id: modalidadeComissaoId,
        usa_seguro: seguro === "sim",
        total_seguro: valores.seguroMensal,
        numero_cota: numeroCota || null,
        valor_credito: credito * quantidadeCotas,
        valor_parcela: Math.round(valores.parcela * quantidadeCotas * 100) / 100,
      };
      const { data: salva, error: erroSalvar } = await admin.from("contratacoes_online").update({
        grupo_id: grupoId, grupo_nome: grupo.codigo_grupo, cota_id: opcaoCotaId, quantidade_cotas: quantidadeCotas,
        credito_selecionado: dadosSimulacaoAtual.valor_credito, parcela_estimada: dadosSimulacaoAtual.valor_parcela,
        dados_simulacao: dadosSimulacaoAtual,
      }).eq("empresa_id", empresaAtiva.id).eq("id", contratacaoId).eq("updated_at", contratacao.updated_at).neq("status", "finalizada").select("id").maybeSingle();
      if (erroSalvar || !salva) throw new Error(erroSalvar?.message ?? "A contratação foi atualizada. Recarregue antes de tentar novamente.");
    }

    // Uma única RPC autenticada valida todos os UUIDs no tenant e congela o snapshot
    // comercial antes da conversão. Percentuais nunca são aceitos do navegador.
    const { error: prepararError } = await db.rpc("rpc_preparar_formalizacao_contratacao", {
      p_empresa_id: empresaAtiva.id,
      p_contratacao_id: contratacaoId,
      p_grupo_id: grupoId,
      p_opcao_cota_id: opcaoCotaId,
      p_modalidade_comissao_id: modalidadeComissaoId,
      p_participante_principal_id: principalId,
      p_participante_secundario_id: secundarioId,
      p_fracao_secundario: secundarioId && fracao ? Number(fracao) : null,
      p_perfil_principal_id: perfilPrincipalId,
      p_perfil_secundario_id: perfilSecundarioId,
      p_cronograma_secundario: cronogramaSecundario,
      p_data_primeira_parcela: dataPrimeiraParcela,
      p_data_segunda_parcela: dataSegundaParcela,
    });
    if (prepararError) throw new Error(prepararError.message);

    // A preparação resolve e congela o programa canônico. Se uma etapa
    // posterior falhar, preserve esse snapshot atualizado ao registrar a
    // pendência, inclusive para perfis que atendem Imóvel e Veículo.
    const { data: contratacaoPreparada, error: preparadaError } = await admin
      .from("contratacoes_online")
      .select("dados_simulacao")
      .eq("id", contratacaoId)
      .eq("empresa_id", empresaAtiva.id)
      .single();
    if (preparadaError) throw new Error(preparadaError.message);
    dadosSimulacaoAtual = (contratacaoPreparada.dados_simulacao ?? {}) as Record<string, unknown>;

    const result = await converterContratacaoEmVenda(
      empresaAtiva.id,
      contratacaoId,
      `erp-formalizacao:${contratacaoId}`,
      quantidadeCotas,
    );

    revalidatePath("/erp/contratacoes");
    revalidatePath(`/erp/contratacoes/${contratacaoId}`);
    revalidatePath("/erp/clientes");
    revalidatePath("/erp/vendas");
    revalidatePath("/erp/minhas-comissoes");
    redirect(`/erp/contratacoes/${contratacaoId}?sucesso=1&venda=${result.venda.id}&cota=${result.cotaDefinitiva.id}&quantidade=${result.cotasDefinitivas.length}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw error;
    const message = error instanceof Error ? error.message : "Não foi possível formalizar.";
    const codigo = classificarPendencia(message);
    const selecaoValida = UUID.test(grupoId) && UUID.test(opcaoCotaId) && UUID.test(principalId)
      && UUID.test(modalidadeComissaoId) && Boolean(perfilPrincipalId && UUID.test(perfilPrincipalId))
      && (!secundarioId || UUID.test(secundarioId))
      && (!perfilSecundarioId || UUID.test(perfilSecundarioId));
    const payloadPendencia: Record<string, unknown> = {
      status_operacional_erp: "PENDENCIA",
      pendencia_codigo: codigo,
      pendencia_descricao: message,
    };
    if (dadosSimulacaoAtual.origem_operacional !== "NOVA_COTA_CLIENTE" &&
      typeof dadosSimulacaoAtual.proposta_opcao_indice !== "number" && selecaoValida) {
      payloadPendencia.grupo_id = grupoId;
      payloadPendencia.cota_id = opcaoCotaId;
      payloadPendencia.participante_comercial_id = principalId;
      payloadPendencia.participante_secundario_id = secundarioId;
      payloadPendencia.participante_secundario_fracao_percentual = secundarioId && fracao ? Number(fracao) : null;
      payloadPendencia.dados_simulacao = {
        ...dadosSimulacaoAtual,
        grupoId,
        cotaId: opcaoCotaId,
        modalidade_comissao_id: modalidadeComissaoId,
        perfil_principal_id: perfilPrincipalId,
        perfil_secundario_id: perfilSecundarioId,
        participante_principal_id: principalId,
        participante_secundario_id: secundarioId,
        fracao_secundario: secundarioId && fracao ? Number(fracao) : null,
        cronograma_secundario: cronogramaSecundario,
        data_primeira_parcela: dataPrimeiraParcela,
        data_segunda_parcela: dataSegundaParcela,
      };
    }
    await admin.from("contratacoes_online").update(payloadPendencia).eq("id", contratacaoId).eq("empresa_id", empresaAtiva.id).neq("status", "finalizada");
    await admin.from("contratacoes_formalizacao_historico").insert({ empresa_id: empresaAtiva.id, contratacao_id: contratacaoId, evento: "PENDENCIA_REGISTRADA", descricao: message, dados: { codigo } });
    revalidatePath("/erp/contratacoes");
    redirect(`/erp/contratacoes/${contratacaoId}?erro=${encodeURIComponent(message)}`);
  }
}

export async function alternarContratoAssinadoAction(input: {
  contratacaoId: string;
  assinado: boolean;
}): Promise<{ ok: true; assinado: boolean } | { ok: false; error: string }> {
  try {
    const context = await requireCurrentTenantContext();
    const podeAlterar =
      context.permissoes.has("formalizar_vendas") ||
      context.permissoes.has("gerenciar_propostas") ||
      context.vinculoAtivo?.papel?.codigo === "admin_empresa" ||
      context.vinculoAtivo?.papel?.codigo === "super_admin" ||
      context.usuario.perfil === "master";

    if (!podeAlterar) {
      return { ok: false, error: "Sem permissão para alterar o status de assinatura da contratação." };
    }

    if (!UUID.test(input.contratacaoId)) {
      return { ok: false, error: "Identificador de contratação inválido." };
    }

    const admin = createAdminClient();
    const { data: contratacao, error: fetchErr } = await admin
      .from("contratacoes_online")
      .select("id,protocolo,nome,contrato_assinado,empresa_id,vendas(id)")
      .eq("id", input.contratacaoId)
      .eq("empresa_id", context.empresaAtiva.id)
      .is("excluido_at", null)
      .maybeSingle();

    if (fetchErr || !contratacao) {
      return { ok: false, error: fetchErr?.message || "Contratação não encontrada nesta empresa." };
    }

    const temVenda = Array.isArray(contratacao.vendas) ? contratacao.vendas.length > 0 : Boolean(contratacao.vendas);
    if (!input.assinado && temVenda) {
      return { ok: false, error: "Não é possível desmarcar assinatura de uma contratação já formalizada em venda." };
    }

    const agora = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      contrato_assinado: input.assinado,
      contrato_assinado_em: input.assinado ? agora : null,
    };

    if (input.assinado) {
      updatePayload.status_operacional_erp = null;
      updatePayload.pendencia_codigo = null;
      updatePayload.pendencia_descricao = null;
    }

    const { error: updateErr } = await admin
      .from("contratacoes_online")
      .update(updatePayload)
      .eq("id", input.contratacaoId)
      .eq("empresa_id", context.empresaAtiva.id);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    await admin.from("contratacoes_formalizacao_historico").insert({
      empresa_id: context.empresaAtiva.id,
      contratacao_id: input.contratacaoId,
      evento: input.assinado ? "CONTRATO_ASSINADO" : "CONTRATO_NAO_ASSINADO",
      descricao: input.assinado
        ? `Contrato marcado como assinado por ${context.usuario.nome || "usuário"}.`
        : `Marcação de contrato assinado removida por ${context.usuario.nome || "usuário"}.`,
      dados: {
        usuario_id: context.usuario.id,
        usuario_nome: context.usuario.nome,
        anterior: contratacao.contrato_assinado,
        novo: input.assinado,
      },
    });

    revalidatePath("/erp/contratacoes");
    revalidatePath(`/erp/contratacoes/${input.contratacaoId}`);
    revalidatePath("/erp/clientes");

    return { ok: true, assinado: input.assinado };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao alterar status de assinatura.",
    };
  }
}
export async function anexarDocumentoNovaCotaAction(formData: FormData) {
  const { empresaAtiva } = await requireTenantPermission("formalizar_vendas");
  const contratacaoId = value(formData, "contratacao_id");
  if (!UUID.test(contratacaoId)) throw new Error("Contratação inválida.");
  const admin = createAdminClient();
  const { data: contratacao } = await admin.from("contratacoes_online")
    .select("id,status,dados_simulacao").eq("empresa_id", empresaAtiva.id).eq("id", contratacaoId).is("excluido_at", null).maybeSingle();
  if (!contratacao || contratacao.status === "finalizada" ||
    (contratacao.dados_simulacao?.origem_operacional !== "NOVA_COTA_CLIENTE" &&
      typeof contratacao.dados_simulacao?.proposta_opcao_indice !== "number")) {
    throw new Error("Nova cota disponível para anexos não encontrada.");
  }

  const file = formData.get("documento");
  const extensoes: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
  if (!(file instanceof File) || !Object.hasOwn(extensoes, file.type) || file.size === 0 || file.size > 850 * 1024) {
    redirect(`/erp/contratacoes/${contratacaoId}?erro=Anexe%20um%20PDF%2C%20JPG%20ou%20PNG%20de%20at%C3%A9%20850%20KB.`);
  }

  const path = `${contratacao.id}/outro_${crypto.randomUUID()}.${extensoes[file.type]}`;
  const bucket = admin.storage.from("contratacoes-documentos");
  const { error: uploadError } = await bucket.upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type, upsert: false,
  });
  if (uploadError) throw new Error("Não foi possível enviar o documento.");
  const { error } = await admin.from("contratacoes_documentos").insert({
    contratacao_id: contratacao.id,
    tipo_documento: "outro",
    arquivo_url: path,
    arquivo_nome: file.name.slice(0, 200),
    mime_type: file.type,
    tamanho_bytes: file.size,
  });
  if (error) {
    await bucket.remove([path]);
    throw new Error("Não foi possível vincular o documento à contratação.");
  }
  revalidatePath(`/erp/contratacoes/${contratacaoId}`);
}
