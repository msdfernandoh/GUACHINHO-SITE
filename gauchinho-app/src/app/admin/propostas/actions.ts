"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantPermission } from "@/lib/tenant/context";
import { registrarEvento } from "@/lib/eventos/registrar";
import {
  enrichPropostaProjecaoFromSimulacao,
  generateAndStorePropostaPdf,
  getPropostaPdfDownloadUrl,
} from "@/lib/proposta/generate-pdf";
import { assertPropostaMinimum } from "@/lib/proposta/minimum";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function selectedIds(formData: FormData) {
  return [...new Set(formData.getAll("ids").map(String).filter((id) => UUID.test(id)))].slice(0, 200);
}

export type PropostaListItem = {
  id: string;
  created_at: string;
  nome_cliente: string | null;
  whatsapp_cliente?: string | null;
  email_cliente?: string | null;
  cidade_cliente?: string | null;
  tipo_proposta: string | null;
  valor_credito: number | null;
  valor_parcela?: number | null;
  prazo?: number | null;
  status: string;
  lead_id: string | null;
  pdf_url: string | null;
  consultor_nome?: string | null;
  contratacao_id?: string | null;
  contratacao_protocolo?: string | null;
};

export async function fetchPropostasList(status?: string) {
  const { empresaAtiva, vinculoAtivo } = await requireTenantPermission("gerenciar_propostas");
  const supabase = await createClient();
  let q = supabase
    .from("propostas")
    .select("id, created_at, nome_cliente, whatsapp_cliente, email_cliente, cidade_cliente, tipo_proposta, valor_credito, valor_parcela, prazo, status, lead_id, pdf_url, consultor_nome")
    .eq("empresa_id", empresaAtiva.id)
    .is("excluido_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rawRows = data ?? [];
  const propostaIds = rawRows.map((p) => p.id);
  const contratacoesMap = new Map<string, { id: string; protocolo: string }>();

  if (propostaIds.length > 0) {
    const { data: cList } = await supabase
      .from("contratacoes_online")
      .select("id, protocolo, proposta_id")
      .eq("empresa_id", empresaAtiva.id)
      .in("proposta_id", propostaIds);
    for (const c of cList ?? []) {
      if (c.proposta_id) {
        contratacoesMap.set(c.proposta_id, { id: c.id, protocolo: c.protocolo });
      }
    }
  }

  const rows: PropostaListItem[] = rawRows.map((p) => {
    const c = contratacoesMap.get(p.id);
    return {
      ...p,
      contratacao_id: c?.id ?? null,
      contratacao_protocolo: c?.protocolo ?? null,
    };
  });

  return {
    rows,
    podeExcluirEmLote: vinculoAtivo.papel?.codigo === "admin_empresa" || await isPlatformSuperadmin(),
  };
}

export async function excluirPropostasEmLoteAction(formData: FormData): Promise<
  { ok: true; quantidade: number } | { ok: false; error: string }
> {
  try {
    const { empresaAtiva, vinculoAtivo } = await requireTenantPermission("gerenciar_propostas");
    if (vinculoAtivo.papel?.codigo !== "admin_empresa" && !(await isPlatformSuperadmin())) {
      throw new Error("Apenas o usuário Master pode excluir propostas em lote.");
    }
    const ids = selectedIds(formData);
    if (!ids.length) throw new Error("Selecione ao menos uma proposta.");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("rpc_master_excluir_pre_cota_em_lote", {
      p_empresa_id: empresaAtiva.id,
      p_tipo: "PROPOSTA",
      p_ids: ids,
      p_motivo: "Exclusão em lote na tela de propostas do ERP",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/propostas");
    revalidatePath("/erp/propostas");
    return { ok: true, quantidade: Number((data as { quantidade?: number } | null)?.quantidade ?? ids.length) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Não foi possível excluir as propostas." };
  }
}

export async function fetchProposta(id: string) {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_propostas");
  const supabase = await createClient();
  const { data, error } = await supabase.from("propostas").select("*").eq("id", id).eq("empresa_id", empresaAtiva.id).is("excluido_at", null).single();
  if (error) throw new Error(error.message);

  const { data: c } = await supabase
    .from("contratacoes_online")
    .select("id, protocolo")
    .eq("proposta_id", id)
    .eq("empresa_id", empresaAtiva.id)
    .maybeSingle();

  return {
    ...data,
    contratacao_id: c?.id ?? null,
    contratacao_protocolo: c?.protocolo ?? null,
  };
}

function readPropostaPayload(formData: FormData, existingPdfUrl?: string | null) {
  const validadeDiasRaw = formData.get("validade_dias");
  const validadeDias =
    validadeDiasRaw != null && String(validadeDiasRaw).trim() !== ""
      ? Number(validadeDiasRaw)
      : null;
  const validadeManual = String(formData.get("validade_data") ?? "").trim();
  const validade = validadeManual
    ? new Date(validadeManual)
    : validadeDias
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() + validadeDias);
          return d;
        })()
      : null;

  return {
    lead_id: String(formData.get("lead_id") ?? "").trim() || null,
    cliente_id: String(formData.get("cliente_id") ?? "").trim() || null,
    nome_cliente: String(formData.get("nome_cliente") ?? "").trim(),
    whatsapp_cliente: String(formData.get("whatsapp_cliente") ?? "").trim() || null,
    email_cliente: String(formData.get("email_cliente") ?? "").trim() || null,
    cidade_cliente: String(formData.get("cidade_cliente") ?? "").trim() || null,
    tipo_proposta: String(formData.get("tipo_proposta") ?? "").trim() || null,
    tipo_bem: String(formData.get("tipo_bem") ?? "").trim() || null,
    parceiro_nome: String(formData.get("parceiro_nome") ?? "").trim() || null,
    valor_credito: Number(formData.get("valor_credito") ?? 0) || null,
    prazo: Number(formData.get("prazo") ?? 0) || null,
    entrada: Number(formData.get("entrada") ?? 0) || null,
    valor_parcela: Number(formData.get("valor_parcela") ?? 0) || null,
    consultor_nome: String(formData.get("consultor_nome") ?? "").trim() || null,
    consultor_telefone: String(formData.get("consultor_telefone") ?? "").trim() || null,
    consultor_email: String(formData.get("consultor_email") ?? "").trim() || null,
    status: String(formData.get("status") ?? "Gerada").trim(),
    validade_dias: validadeDias,
    validade_data: validade ? validade.toISOString().slice(0, 10) : null,
    validade_origem: validadeManual ? "manual" : validadeDias ? "padrao" : null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    pdf_url: existingPdfUrl ?? null,
  };
}

export async function savePropostaAction(formData: FormData) {
  const { usuario, empresaAtiva } = await requireTenantPermission("gerenciar_propostas");
  const id = String(formData.get("id") ?? "").trim();
  const origemInterface = formData.get("origem_interface") === "erp" ? "erp" : "admin";
  const supabase = await createClient();

  let existingPdf: string | null = null;
  if (id) {
    const { data } = await supabase.from("propostas").select("pdf_url").eq("id", id).eq("empresa_id", empresaAtiva.id).single();
    existingPdf = data?.pdf_url ?? null;
  }

  const payload = readPropostaPayload(formData, existingPdf);
  assertPropostaMinimum({ nome: payload.nome_cliente, telefone: payload.whatsapp_cliente });

  if (payload.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", payload.lead_id)
      .eq("empresa_id", empresaAtiva.id)
      .maybeSingle();
    if (!lead) throw new Error("O lead informado não pertence à empresa ativa.");
  }
  if (payload.cliente_id) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", payload.cliente_id)
      .eq("empresa_id", empresaAtiva.id)
      .maybeSingle();
    if (!cliente) throw new Error("O cliente informado não pertence à empresa ativa.");
  }

  if (id) {
    const { error } = await supabase.from("propostas").update(payload).eq("id", id).eq("empresa_id", empresaAtiva.id);
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/propostas/${id}`);
    redirect(`/admin/propostas/${id}`);
  }

  const { data, error } = await supabase.from("propostas").insert({ ...payload, empresa_id: empresaAtiva.id }).select("id").single();
  if (error) throw new Error(error.message);

  await registrarEvento({
    tipo_evento: "proposta_gerada",
    origem: "admin",
    lead_id: payload.lead_id ?? undefined,
    usuario_id: usuario.id,
    entidade_tipo: "proposta",
    entidade_id: data.id,
  });

  revalidatePath("/admin/propostas");
  revalidatePath("/erp/propostas");
  redirect(origemInterface === "erp" ? "/erp/propostas" : `/admin/propostas/${data.id}`);
}

export async function generatePropostaPdfAction(formData: FormData) {
  const { usuario, empresaAtiva } = await requireTenantPermission("gerenciar_propostas");
  const propostaId = String(formData.get("proposta_id") ?? "").trim();
  if (!propostaId) throw new Error("Proposta inválida");
  const supabase = await createClient();
  const { data: proposta } = await supabase.from("propostas").select("id").eq("id", propostaId).eq("empresa_id", empresaAtiva.id).maybeSingle();
  if (!proposta) throw new Error("Proposta não encontrada nesta empresa.");

  await enrichPropostaProjecaoFromSimulacao(propostaId);
  const { signedUrl } = await generateAndStorePropostaPdf(propostaId, {
    consultor_nome: String(formData.get("consultor_nome") ?? "").trim() || undefined,
    consultor_telefone: String(formData.get("consultor_telefone") ?? "").trim() || undefined,
    consultor_email: String(formData.get("consultor_email") ?? "").trim() || undefined,
    parceiro_nome: String(formData.get("parceiro_nome") ?? "").trim() || undefined,
    validade_dias: Number(formData.get("validade_dias") ?? 0) || undefined,
    validade_data: String(formData.get("validade_data") ?? "").trim() || undefined,
    observacao: String(formData.get("observacao") ?? "").trim() || undefined,
    origem: "admin",
    pagina: `/admin/propostas/${propostaId}`,
    usuario_id: usuario.id,
  });

  revalidatePath(`/admin/propostas/${propostaId}`);
  revalidatePath("/admin/propostas");
  return { ok: true as const, signedUrl };
}

export async function getPropostaDownloadUrlAction(propostaId: string) {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_propostas");
  const supabase = await createClient();
  const { data: proposta } = await supabase.from("propostas").select("id").eq("id", propostaId).eq("empresa_id", empresaAtiva.id).maybeSingle();
  if (!proposta) throw new Error("Proposta não encontrada nesta empresa.");
  const url = await getPropostaPdfDownloadUrl(propostaId);
  await registrarEvento({
    tipo_evento: "proposta_pdf_baixada",
    origem: "admin",
    entidade_tipo: "proposta",
    entidade_id: propostaId,
  });
  return url;
}

export async function searchLeadsForProposta(q: string) {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_propostas");
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, nome, whatsapp")
    .eq("empresa_id", empresaAtiva.id)
    .ilike("nome", `%${q}%`)
    .limit(10);
  return data ?? [];
}

export async function marcarPropostaContratadaAction(input: {
  propostaId: string;
  origemInterface?: "admin" | "erp";
}): Promise<{ ok: true; contratacaoId: string; protocolo: string; redirectUrl: string } | { ok: false; error: string }> {
  try {
    const { empresaAtiva, usuario } = await requireTenantPermission("gerenciar_propostas");
    const admin = createAdminClient();

    // 1. Tenta via RPC 218
    let contratacao: { id: string; protocolo: string } | null = null;
    try {
      const { data: rpcData, error: rpcError } = await admin.rpc("rpc_converter_proposta_em_contratacao", {
        p_empresa_id: empresaAtiva.id,
        p_proposta_id: input.propostaId,
        p_usuario_id: usuario.id,
      });
      if (!rpcError && rpcData) {
        const row = rpcData as { id: string; protocolo: string };
        contratacao = { id: row.id, protocolo: row.protocolo };
      }
    } catch {
      // Prossegue para o fallback resiliente
    }

    // 2. Fallback resiliente se RPC não retornou
    if (!contratacao) {
      const { data: prop, error: propErr } = await admin
        .from("propostas")
        .select("*")
        .eq("id", input.propostaId)
        .eq("empresa_id", empresaAtiva.id)
        .single();
      if (propErr || !prop) throw new Error("Proposta não encontrada neste tenant.");

      const { data: existing } = await admin
        .from("contratacoes_online")
        .select("id, protocolo")
        .eq("proposta_id", input.propostaId)
        .maybeSingle();

      if (existing) {
        await admin.from("propostas").update({ status: "Contratada", updated_at: new Date().toISOString() }).eq("id", input.propostaId);
        contratacao = { id: existing.id, protocolo: existing.protocolo };
      } else {
        const fill = (prop.preenchimento_contratacao ?? {}) as Record<string, unknown>;
        const protocolo = `GC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        const token = prop.public_token || `ct_${crypto.randomUUID().replace(/-/g, "")}`;

        const { data: nova, error: novaErr } = await admin
          .from("contratacoes_online")
          .insert({
            proposta_id: prop.id,
            empresa_id: empresaAtiva.id,
            public_token: token,
            protocolo,
            origem: prop.origem_contratacao === "grupos" ? "grupos" : "simulador",
            status: "aguardando_consultor",
            lead_id: prop.lead_id,
            gerado_por_usuario_id: usuario.id,
            gerado_por_nome: prop.consultor_nome,
            gerado_por_email: prop.consultor_email,
            nome: prop.nome_cliente || "Cliente",
            telefone: (prop.whatsapp_cliente || "").replace(/\D/g, ""),
            email: (fill.email as string) || prop.email_cliente,
            tipo_pessoa: (fill.tipo_pessoa as string) || "cpf",
            cpf: (fill.cpf as string) || null,
            data_nascimento: (fill.data_nascimento as string) || null,
            razao_social: (fill.razao_social as string) || null,
            cnpj: (fill.cnpj as string) || null,
            responsavel_nome: (fill.responsavel_nome as string) || null,
            responsavel_cpf: (fill.responsavel_cpf as string) || null,
            cep: (fill.cep as string) || null,
            endereco: (fill.endereco as string) || null,
            numero: (fill.numero as string) || null,
            complemento: (fill.complemento as string) || null,
            bairro: (fill.bairro as string) || null,
            cidade: (fill.cidade as string) || prop.cidade_cliente,
            uf: (fill.uf as string) || null,
            tipo_bem: prop.tipo_bem,
            credito_selecionado: prop.valor_credito,
            parcela_estimada: prop.valor_parcela,
            prazo: prop.prazo,
            grupo_id: (fill.grupo_id as string) || null,
            grupo_nome: (fill.grupo_nome as string) || null,
            administradora: (fill.administradora as string) || null,
            cota_id: (fill.cota_id as string) || null,
            dados_simulacao: prop.dados_simulacao || {},
            forma_pagamento: (fill.forma_pagamento as string) || null,
            observacao_cliente: (fill.observacao_cliente as string) || null,
            confirmado_em: new Date().toISOString(),
            finalizado_em: new Date().toISOString(),
            contrato_assinado: true,
            contrato_assinado_em: new Date().toISOString(),
            participante_comercial_id: prop.participante_comercial_id,
            organizacao_parceira_id: prop.organizacao_parceira_id,
          })
          .select("id, protocolo")
          .single();

        if (novaErr || !nova) throw new Error(novaErr?.message || "Erro ao criar contratação");
        contratacao = { id: nova.id, protocolo: nova.protocolo };

        // Copia documentos se houver
        const { data: pDocs } = await admin
          .from("propostas_documentos")
          .select("tipo_documento, arquivo_url, arquivo_nome, mime_type, tamanho_bytes")
          .eq("proposta_id", prop.id)
          .eq("empresa_id", empresaAtiva.id);

        if (pDocs && pDocs.length > 0) {
          await admin.from("contratacoes_documentos").insert(
            pDocs.map((d) => ({
              contratacao_id: nova.id,
              tipo_documento: d.tipo_documento,
              arquivo_url: d.arquivo_url,
              arquivo_nome: d.arquivo_nome,
              mime_type: d.mime_type,
              tamanho_bytes: d.tamanho_bytes,
            }))
          );
        }

        await admin.from("propostas").update({ status: "Contratada", updated_at: new Date().toISOString() }).eq("id", prop.id);
      }
    }

    if (!contratacao) throw new Error("Não foi possível gerar a contratação.");

    revalidatePath("/admin/propostas");
    revalidatePath("/admin/contratacoes");
    revalidatePath("/erp/propostas");
    revalidatePath("/erp/contratacoes");

    const redirectUrl = input.origemInterface === "erp"
      ? `/erp/contratacoes/${contratacao.id}`
      : `/admin/contratacoes/${contratacao.id}`;

    return {
      ok: true,
      contratacaoId: contratacao.id,
      protocolo: contratacao.protocolo,
      redirectUrl,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao converter proposta em contratação.",
    };
  }
}
