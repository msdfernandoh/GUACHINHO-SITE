import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolverConsultorPorId } from "@/lib/admin/consultores";
import { assertDadosSimulacaoGruposAutorizadosForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
import { DEFAULT_CONTRATACAO_ONLINE_CONFIG, pixConfigValida } from "./pagamento";
import { getConfigJsonPublic } from "@/server/config";
import { extrairCamposFlat } from "./extract-fields";
import {
  assertSnapshotCalculoGruposIntegro,
  canonicalizarDadosSimulacaoGrupos,
} from "./snapshot-calculo-grupos";
import { generatePublicToken } from "./public-token";
import { parseEnderecoContratacao } from "./endereco";
import { sanitizeCnpj, sanitizeCpf, sanitizeTelefone, validarCnpj, validarCpf, validarEmail } from "./validacao";
import type { UsuarioNegocio } from "@/lib/auth/permissions";
import type { ContratacaoDraftPayload } from "./draft";
import type { ContratacaoOnlineRow, FormaPagamento, TipoDocumentoContratacao, TipoPessoa } from "./types";

type PublicProposalPatch = {
  etapa?: "dados" | "pessoa" | "documentos" | "pagamento";
  acao?: string;
  nome?: string; telefone?: string; email?: string;
  tipo_pessoa?: TipoPessoa; cpf?: string; data_nascimento?: string;
  razao_social?: string; cnpj?: string; responsavel_nome?: string; responsavel_cpf?: string;
  cep?: string; endereco?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string;
  forma_pagamento?: FormaPagamento; observacao_cliente?: string;
};

const MIME_PERMITIDOS = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

type PropostaFluxoRow = {
  id: string;
  empresa_id: string;
  public_token: string;
  origem_contratacao: "simulador" | "grupos";
  nome_cliente: string | null;
  whatsapp_cliente: string | null;
  email_cliente: string | null;
  tipo_bem: string | null;
  valor_credito: number | null;
  valor_parcela: number | null;
  prazo: number | null;
  lead_id: string | null;
  consultor_nome: string | null;
  consultor_email: string | null;
  participante_comercial_id: string | null;
  organizacao_parceira_id: string | null;
  dados_simulacao: Record<string, unknown>;
  preenchimento_contratacao: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
};

async function assertConsultorDoTenant(admin: SupabaseClient, empresaId: string, usuarioId: string) {
  const { data, error } = await admin
    .from("empresa_usuarios")
    .select("usuario_id")
    .eq("empresa_id", empresaId)
    .eq("usuario_id", usuarioId)
    .eq("ativo", true)
    .maybeSingle();
  if (error || !data) throw new Error("Consultor responsável não pertence a este tenant.");
}

function preenchimento(row: PropostaFluxoRow) {
  return (row.preenchimento_contratacao ?? {}) as Record<string, unknown>;
}

function str(value: unknown): string | null {
  const result = value == null ? "" : String(value).trim();
  return result || null;
}

function propostaAsWizardRow(row: PropostaFluxoRow): ContratacaoOnlineRow {
  const fill = preenchimento(row);
  const flat = extrairCamposFlat(row.origem_contratacao, row.dados_simulacao ?? {});
  return {
    id: row.id,
    public_token: row.public_token,
    protocolo: `PROP-${row.id.slice(0, 8).toUpperCase()}`,
    origem: row.origem_contratacao,
    status: (str(fill.etapa_status) ?? "proposta_aberta") as ContratacaoOnlineRow["status"],
    lead_id: row.lead_id,
    gerado_por_usuario_id: str(fill.gerado_por_usuario_id),
    gerado_por_nome: row.consultor_nome,
    gerado_por_email: row.consultor_email,
    nome: row.nome_cliente,
    telefone: row.whatsapp_cliente,
    email: str(fill.email) ?? row.email_cliente,
    tipo_pessoa: (str(fill.tipo_pessoa) as ContratacaoOnlineRow["tipo_pessoa"]) ?? null,
    cpf: str(fill.cpf), data_nascimento: str(fill.data_nascimento), razao_social: str(fill.razao_social),
    cnpj: str(fill.cnpj), responsavel_nome: str(fill.responsavel_nome), responsavel_cpf: str(fill.responsavel_cpf),
    cep: str(fill.cep), endereco: str(fill.endereco), numero: str(fill.numero), complemento: str(fill.complemento),
    bairro: str(fill.bairro), cidade: str(fill.cidade), uf: str(fill.uf),
    ...flat,
    dados_simulacao: row.dados_simulacao ?? {},
    forma_pagamento: (str(fill.forma_pagamento) as FormaPagamento) ?? null,
    pagamento_observacao: null,
    observacao_cliente: str(fill.observacao_cliente),
    pix_ativo_na_solicitacao: Boolean(fill.pix_ativo_na_solicitacao),
    pix_chave: str(fill.pix_chave), pix_recebedor: str(fill.pix_recebedor), pix_instrucoes: str(fill.pix_instrucoes),
    pix_comprovante_url: str(fill.pix_comprovante_url), pix_status: str(fill.pix_comprovante_url) ? "enviado" : "nao_enviado",
    confirmado_em: str(fill.confirmado_em), finalizado_em: null, primeiro_acesso_em: str(fill.primeiro_acesso_em),
    contrato_assinado: false, contrato_assinado_em: null,
    created_at: row.created_at, updated_at: row.updated_at,
  };
}

async function findProposal(admin: SupabaseClient, token: string, empresaId: string): Promise<PropostaFluxoRow | null> {
  const { data, error } = await admin.from("propostas").select("*").eq("public_token", token).eq("empresa_id", empresaId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PropostaFluxoRow | null) ?? null;
}

export async function criarPropostaDoFluxo(input: {
  draft: ContratacaoDraftPayload;
  empresaId: string;
  nome: string;
  telefone: string;
  email?: string;
  gerador: UsuarioNegocio | null;
}): Promise<ContratacaoOnlineRow> {
  const nome = input.nome.trim();
  const telefone = sanitizeTelefone(input.telefone);
  const email = input.email?.trim() ?? "";
  if (!nome || telefone.length < 10) throw new Error("Nome e telefone/WhatsApp são obrigatórios.");
  if (email && !validarEmail(email)) throw new Error("E-mail inválido.");

  const admin = createAdminClient();
  let consultorId = input.gerador?.id ?? input.draft.consultor_id?.trim() ?? "";
  let consultorNome = input.gerador?.nome ?? input.draft.consultor_nome?.trim() ?? null;
  let consultorEmail = input.gerador?.email ?? null;
  if (input.draft.consultor_id?.trim()) {
    const consultor = await resolverConsultorPorId(
      admin,
      input.draft.consultor_id.trim(),
      input.empresaId,
    );
    if (!consultor) throw new Error("Consultor responsável inválido.");
    consultorId = consultor.id;
    consultorNome = input.draft.consultor_nome?.trim() || consultor.nome;
    consultorEmail = consultor.email ?? null;
  }
  if (!consultorId) throw new Error("Selecione o consultor responsável pela proposta.");
  await assertConsultorDoTenant(admin, input.empresaId, consultorId);

  const dadosSimulacao =
    input.draft.origem === "grupos"
      ? await canonicalizarDadosSimulacaoGrupos(input.empresaId, input.draft.dados_simulacao)
      : input.draft.dados_simulacao;
  const flat = extrairCamposFlat(input.draft.origem, dadosSimulacao);
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generatePublicToken();
    const { data, error } = await admin.from("propostas").insert({
      empresa_id: input.empresaId,
      public_token: token,
      origem_contratacao: input.draft.origem,
      nome_cliente: nome,
      whatsapp_cliente: telefone,
      email_cliente: email || null,
      tipo_proposta: input.draft.origem === "grupos" ? "Consórcio — Grupos" : "Consórcio — Simulador",
      tipo_bem: flat.tipo_bem,
      valor_credito: flat.credito_selecionado,
      valor_parcela: flat.parcela_estimada,
      prazo: flat.prazo,
      dados_simulacao: dadosSimulacao,
      consultor_nome: consultorNome,
      consultor_email: consultorEmail,
      status: "Gerada",
      preenchimento_contratacao: {
        etapa_status: "dados_preenchidos",
        gerado_por_usuario_id: consultorId,
        email: email || null,
        grupo_id: flat.grupo_id,
        grupo_nome: flat.grupo_nome,
        administradora: flat.administradora,
        cota_id: flat.cota_id,
      },
    }).select("*").single();
    if (!error && data) return propostaAsWizardRow(data as PropostaFluxoRow);
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  }
  throw new Error("Não foi possível criar a proposta.");
}

export async function buscarFluxoProposta(token: string, empresaId: string): Promise<ContratacaoOnlineRow | null> {
  const admin = createAdminClient();
  const proposal = await findProposal(admin, token, empresaId);
  if (!proposal) return null;
  const { data: contract, error } = await admin.from("contratacoes_online").select("*").eq("proposta_id", proposal.id).eq("empresa_id", empresaId).maybeSingle();
  if (error) throw new Error(error.message);
  return contract ? contract as ContratacaoOnlineRow : propostaAsWizardRow(proposal);
}

export async function atualizarFluxoProposta(token: string, empresaId: string, patch: PublicProposalPatch): Promise<ContratacaoOnlineRow> {
  const admin = createAdminClient();
  const proposal = await findProposal(admin, token, empresaId);
  if (!proposal) throw new Error("Proposta não encontrada.");
  const { data: contract } = await admin.from("contratacoes_online").select("id").eq("proposta_id", proposal.id).maybeSingle();
  if (contract) throw new Error("Esta solicitação já foi finalizada.");
  const fill = { ...preenchimento(proposal) };
  const updates: Record<string, unknown> = {};

  if (patch.acao === "confirmar") {
    fill.etapa_status = "proposta_confirmada";
    fill.confirmado_em = new Date().toISOString();
  } else if (patch.etapa === "dados") {
    const nome = patch.nome?.trim() ?? "";
    const telefone = sanitizeTelefone(patch.telefone ?? "");
    const email = patch.email?.trim() ?? "";
    if (!nome || telefone.length < 10) throw new Error("Nome e telefone/WhatsApp são obrigatórios.");
    if (email && !validarEmail(email)) throw new Error("E-mail inválido.");
    updates.nome_cliente = nome; updates.whatsapp_cliente = telefone; updates.email_cliente = email || null;
    fill.email = email || null; fill.etapa_status = "dados_preenchidos";
  } else if (patch.etapa === "pessoa") {
    if (patch.tipo_pessoa === "cpf") {
      const cpf = sanitizeCpf(patch.cpf ?? "");
      if (!validarCpf(cpf)) throw new Error("CPF inválido.");
      Object.assign(fill, { tipo_pessoa: "cpf", cpf, data_nascimento: patch.data_nascimento?.trim() || null, razao_social: null, cnpj: null, responsavel_nome: null, responsavel_cpf: null });
    } else if (patch.tipo_pessoa === "cnpj") {
      const cnpj = sanitizeCnpj(patch.cnpj ?? ""); const responsavelCpf = sanitizeCpf(patch.responsavel_cpf ?? "");
      if (!validarCnpj(cnpj)) throw new Error("CNPJ inválido.");
      if (!validarCpf(responsavelCpf)) throw new Error("CPF do responsável inválido.");
      if (!patch.razao_social?.trim() || !patch.responsavel_nome?.trim()) throw new Error("Razão social e responsável são obrigatórios.");
      Object.assign(fill, { tipo_pessoa: "cnpj", cnpj, razao_social: patch.razao_social.trim(), responsavel_nome: patch.responsavel_nome.trim(), responsavel_cpf: responsavelCpf, cpf: null, data_nascimento: null });
    } else throw new Error("Tipo de pessoa inválido.");
    Object.assign(fill, parseEnderecoContratacao(patch));
    fill.etapa_status = "dados_preenchidos";
  } else if (patch.etapa === "documentos") {
    const { count, error } = await admin.from("propostas_documentos").select("*", { count: "exact", head: true }).eq("proposta_id", proposal.id).eq("empresa_id", empresaId);
    if (error || !count) throw new Error("Envie pelo menos um documento válido antes de continuar.");
    fill.observacao_cliente = patch.observacao_cliente?.trim() || null; fill.etapa_status = "documentos_enviados";
  } else if (patch.etapa === "pagamento") {
    if (!patch.forma_pagamento || !["pix", "boleto", "cartao"].includes(patch.forma_pagamento)) throw new Error("Forma de pagamento inválida.");
    const cfg = await getConfigJsonPublic("contratacao_online_config", DEFAULT_CONTRATACAO_ONLINE_CONFIG);
    if (patch.forma_pagamento === "pix" && !pixConfigValida(cfg)) throw new Error("Pix não está disponível no momento.");
    Object.assign(fill, { forma_pagamento: patch.forma_pagamento, etapa_status: "pagamento_escolhido" });
    if (patch.forma_pagamento === "pix") Object.assign(fill, { pix_ativo_na_solicitacao: true, pix_chave: cfg.pix_chave.trim(), pix_recebedor: cfg.pix_recebedor.trim(), pix_instrucoes: cfg.pix_instrucoes.trim() });
  }

  updates.preenchimento_contratacao = fill;
  const { data, error } = await admin.from("propostas").update(updates).eq("id", proposal.id).eq("empresa_id", empresaId).select("*").single();
  if (error) throw new Error(error.message);
  return propostaAsWizardRow(data as PropostaFluxoRow);
}

export async function uploadDocumentoProposta(token: string, empresaId: string, tipo: TipoDocumentoContratacao, file: File) {
  const admin = createAdminClient();
  const proposal = await findProposal(admin, token, empresaId);
  if (!proposal) throw new Error("Proposta não encontrada.");
  const { data: contract } = await admin.from("contratacoes_online").select("id").eq("proposta_id", proposal.id).maybeSingle();
  if (contract) throw new Error("Esta solicitação já foi finalizada.");
  if (!MIME_PERMITIDOS.has(file.type)) throw new Error("Tipo de arquivo não permitido.");
  if (file.size <= 0) throw new Error("O documento está vazio.");
  if (file.size > MAX_BYTES) throw new Error("Arquivo muito grande (máx. 5 MB).");
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `propostas/${proposal.id}/${tipo}_${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage.from("contratacoes-documentos").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { error } = await admin.from("propostas_documentos").insert({ empresa_id: empresaId, proposta_id: proposal.id, tipo_documento: tipo, arquivo_url: path, arquivo_nome: file.name, mime_type: file.type, tamanho_bytes: file.size });
  if (error) {
    await admin.storage.from("contratacoes-documentos").remove([path]);
    throw new Error(error.message);
  }
  if (tipo === "comprovante_pix") {
    await admin.from("propostas").update({ preenchimento_contratacao: { ...preenchimento(proposal), pix_comprovante_url: path } }).eq("id", proposal.id);
  }
  return { ok: true as const, path };
}

export async function listarDocumentosProposta(token: string, empresaId: string) {
  const admin = createAdminClient();
  const proposal = await findProposal(admin, token, empresaId);
  if (!proposal) return null;
  const { data, error } = await admin.from("propostas_documentos").select("*").eq("proposta_id", proposal.id).eq("empresa_id", empresaId).order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function finalizarPropostaEmContratacao(token: string, empresaId: string): Promise<ContratacaoOnlineRow> {
  const admin = createAdminClient();
  const proposal = await findProposal(admin, token, empresaId);
  if (!proposal) throw new Error("Proposta não encontrada neste tenant.");
  const fill = preenchimento(proposal);
  const email = str(fill.email) ?? proposal.email_cliente ?? "";
  if (!proposal.nome_cliente?.trim() || sanitizeTelefone(proposal.whatsapp_cliente ?? "").length < 10) throw new Error("Informe nome e telefone válidos.");
  if (!validarEmail(email)) throw new Error("Informe um e-mail válido.");
  if (fill.tipo_pessoa === "cpf" && !validarCpf(sanitizeCpf(String(fill.cpf ?? "")))) throw new Error("CPF inválido.");
  if (fill.tipo_pessoa === "cnpj" && (!validarCnpj(sanitizeCnpj(String(fill.cnpj ?? ""))) || !validarCpf(sanitizeCpf(String(fill.responsavel_cpf ?? ""))))) throw new Error("Dados da pessoa jurídica inválidos.");
  parseEnderecoContratacao(fill);
  if (!fill.forma_pagamento) throw new Error("Selecione a forma de pagamento.");
  if (proposal.origem_contratacao === "grupos") {
    await assertDadosSimulacaoGruposAutorizadosForEmpresa(empresaId, proposal.dados_simulacao);
    assertSnapshotCalculoGruposIntegro(proposal.dados_simulacao);
  }
  const { data: docs, error: docsError } = await admin
    .from("propostas_documentos")
    .select("arquivo_url,tamanho_bytes")
    .eq("proposta_id", proposal.id)
    .eq("empresa_id", empresaId);
  if (docsError) throw new Error(docsError.message);
  let documentoPersistido = false;
  for (const doc of docs ?? []) {
    if (!doc.arquivo_url || Number(doc.tamanho_bytes) <= 0) continue;
    const { data, error } = await admin.storage.from("contratacoes-documentos").download(doc.arquivo_url);
    if (!error && data && data.size > 0) {
      documentoPersistido = true;
      break;
    }
  }
  if (!documentoPersistido) throw new Error("Envie pelo menos um documento válido antes de confirmar a contratação.");
  const { data, error } = await admin.rpc("rpc_finalizar_contratacao_proposta", { p_empresa_id: empresaId, p_proposta_id: proposal.id, p_public_token: token });
  if (error) throw new Error(error.message);
  return data as ContratacaoOnlineRow;
}
