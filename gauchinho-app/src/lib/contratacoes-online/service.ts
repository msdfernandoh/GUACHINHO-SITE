import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import type { UsuarioNegocio } from "@/lib/auth/permissions";
import { generatePublicToken } from "./public-token";
import { formatProtocoloFromSequence, parseProtocoloNumber } from "./protocolo";
import { extrairCamposFlat } from "./extract-fields";
import {
  DEFAULT_CONTRATACAO_ONLINE_CONFIG,
  pixConfigValida,
} from "./pagamento";
import type {
  ContratacaoOnlineRow,
  FormaPagamento,
  IniciarContratacaoBody,
  TipoDocumentoContratacao,
  TipoPessoa,
} from "./types";
import { statusPermiteEdicaoPublica } from "./status";
import {
  sanitizeCnpj,
  sanitizeCpf,
  sanitizeTelefone,
  validarCnpj,
  validarCpf,
  validarEmail,
} from "./validacao";
import {
  enderecoJsonFromCampos,
  enderecoToDbUpdates,
  hydrateContratacaoEndereco,
  isContratacaoEnderecoSchemaError,
  parseEnderecoContratacao,
  stripEnderecoDbUpdates,
  contratacaoEnderecoMigrationHint,
  type EnderecoContratacaoCampos,
  type EnderecoContratacaoPatch,
} from "./endereco";

const MIME_PERMITIDOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_BYTES = 5 * 1024 * 1024;

async function allocProtocoloSafe(admin: SupabaseClient): Promise<string> {
  const { data: seqRow } = await admin
    .from("contratacoes_online")
    .select("protocolo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (seqRow?.protocolo) {
    const last = parseProtocoloNumber(seqRow.protocolo) ?? 0;
    return formatProtocoloFromSequence(last + 1);
  }
  return formatProtocoloFromSequence(1);
}

export async function criarContratacaoOnline(
  body: IniciarContratacaoBody,
  gerador: UsuarioNegocio | null,
): Promise<{ row: ContratacaoOnlineRow; publicPath: string }> {
  const admin = createAdminClient();
  const flat = extrairCamposFlat(body.origem, body.dados_simulacao);
  const statusInicial = body.modo === "sdr_link" ? "link_gerado" : "proposta_aberta";

  let row: ContratacaoOnlineRow | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const public_token = generatePublicToken();
    const protocolo = await allocProtocoloSafe(admin);
    const { data, error } = await admin
      .from("contratacoes_online")
      .insert({
        public_token,
        protocolo,
        origem: body.origem,
        status: statusInicial,
        gerado_por_usuario_id: gerador?.id ?? null,
        gerado_por_nome: gerador?.nome ?? null,
        gerado_por_email: gerador?.email ?? null,
        nome: body.cliente_pre_nome?.trim() || null,
        telefone: body.cliente_pre_telefone
          ? sanitizeTelefone(body.cliente_pre_telefone)
          : null,
        email: body.cliente_pre_email?.trim() || null,
        ...flat,
        dados_simulacao: {
          ...body.dados_simulacao,
          origem_fluxo: body.origem,
          modo: body.modo,
        },
      })
      .select("*")
      .single();
    if (!error && data) {
      row = data as ContratacaoOnlineRow;
      break;
    }
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(error.message);
    }
  }
  if (!row) throw new Error("Não foi possível criar a contratação");

  return { row, publicPath: `/proposta/${row.public_token}` };
}

export async function buscarContratacaoPorToken(
  token: string,
): Promise<ContratacaoOnlineRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("contratacoes_online")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  const row = (data as ContratacaoOnlineRow) ?? null;
  return row ? hydrateContratacaoEndereco(row) : null;
}

export async function marcarPrimeiroAcesso(row: ContratacaoOnlineRow): Promise<ContratacaoOnlineRow> {
  if (row.primeiro_acesso_em) return row;
  const admin = createAdminClient();
  const updates: Record<string, unknown> = {
    primeiro_acesso_em: new Date().toISOString(),
  };
  if (row.status === "link_gerado") {
    updates.status = "proposta_aberta";
  }
  const { data } = await admin
    .from("contratacoes_online")
    .update(updates)
    .eq("id", row.id)
    .select("*")
    .single();
  return (data as ContratacaoOnlineRow) ?? row;
}

export async function confirmarProposta(token: string): Promise<ContratacaoOnlineRow> {
  const row = await buscarContratacaoPorToken(token);
  if (!row) throw new Error("Proposta não encontrada");
  if (!statusPermiteEdicaoPublica(row.status)) {
    throw new Error("Esta solicitação já foi finalizada");
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contratacoes_online")
    .update({
      status: "proposta_confirmada",
      confirmado_em: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContratacaoOnlineRow;
}

export type PatchContratacaoPublica = {
  etapa: "dados" | "pessoa" | "documentos" | "pagamento";
  nome?: string;
  telefone?: string;
  email?: string;
  tipo_pessoa?: TipoPessoa;
  cpf?: string;
  data_nascimento?: string;
  razao_social?: string;
  cnpj?: string;
  responsavel_nome?: string;
  responsavel_cpf?: string;
  forma_pagamento?: FormaPagamento;
} & EnderecoContratacaoPatch;

export async function atualizarContratacaoPublica(
  token: string,
  patch: PatchContratacaoPublica,
): Promise<ContratacaoOnlineRow> {
  const row = await buscarContratacaoPorToken(token);
  if (!row) throw new Error("Proposta não encontrada");
  if (!statusPermiteEdicaoPublica(row.status)) {
    throw new Error("Esta solicitação já foi finalizada");
  }

  const admin = createAdminClient();
  const updates: Record<string, unknown> = {};
  let enderecoCampos: EnderecoContratacaoCampos | null = null;

  if (patch.etapa === "dados") {
    const nome = patch.nome?.trim();
    const telefone = patch.telefone ? sanitizeTelefone(patch.telefone) : "";
    const email = patch.email?.trim() ?? "";
    if (!nome || telefone.length < 10) {
      throw new Error("Nome e telefone/WhatsApp são obrigatórios");
    }
    if (!validarEmail(email)) throw new Error("E-mail inválido");
    updates.nome = nome;
    updates.telefone = telefone;
    updates.email = email;
    updates.status = "dados_preenchidos";
    await upsertLeadContratacao(row, { nome, telefone, email });
  }

  if (patch.etapa === "pessoa") {
    if (patch.tipo_pessoa === "cpf") {
      const cpf = sanitizeCpf(patch.cpf ?? "");
      if (!validarCpf(cpf)) throw new Error("CPF inválido");
      updates.tipo_pessoa = "cpf";
      updates.cpf = cpf;
      updates.data_nascimento = patch.data_nascimento?.trim() || null;
      updates.razao_social = null;
      updates.cnpj = null;
      updates.responsavel_nome = null;
      updates.responsavel_cpf = null;
    } else if (patch.tipo_pessoa === "cnpj") {
      const cnpj = sanitizeCnpj(patch.cnpj ?? "");
      if (!validarCnpj(cnpj)) throw new Error("CNPJ inválido");
      const respCpf = sanitizeCpf(patch.responsavel_cpf ?? "");
      if (!validarCpf(respCpf)) throw new Error("CPF do responsável inválido");
      if (!patch.razao_social?.trim() || !patch.responsavel_nome?.trim()) {
        throw new Error("Razão social e responsável são obrigatórios");
      }
      updates.tipo_pessoa = "cnpj";
      updates.cnpj = cnpj;
      updates.razao_social = patch.razao_social.trim();
      updates.responsavel_nome = patch.responsavel_nome.trim();
      updates.responsavel_cpf = respCpf;
      updates.cpf = null;
    } else {
      throw new Error("Tipo de pessoa inválido");
    }
    const endereco = parseEnderecoContratacao(patch);
    enderecoCampos = endereco;
    Object.assign(updates, enderecoToDbUpdates(endereco));
  }

  if (patch.etapa === "documentos") {
    updates.status = "documentos_enviados";
  }

  if (patch.etapa === "pagamento") {
    const cfg = await getConfigJsonPublic(
      "contratacao_online_config",
      DEFAULT_CONTRATACAO_ONLINE_CONFIG,
    );
    const forma = patch.forma_pagamento;
    if (!forma || !["pix", "boleto", "cartao"].includes(forma)) {
      throw new Error("Forma de pagamento inválida");
    }
    if (forma === "pix" && !pixConfigValida(cfg)) {
      throw new Error("Pix não está disponível no momento");
    }
    updates.forma_pagamento = forma;
    updates.status = "pagamento_escolhido";
    if (forma === "pix") {
      updates.pix_ativo_na_solicitacao = true;
      updates.pix_chave = cfg.pix_chave.trim();
      updates.pix_recebedor = cfg.pix_recebedor.trim();
      updates.pix_instrucoes = cfg.pix_instrucoes.trim();
    }
  }

  let rowUpdated: ContratacaoOnlineRow;
  const { data, error } = await admin
    .from("contratacoes_online")
    .update(updates)
    .eq("id", row.id)
    .select("*")
    .single();

  if (error && patch.etapa === "pessoa" && enderecoCampos && isContratacaoEnderecoSchemaError(error.message)) {
    const dadosPrev = (row.dados_simulacao ?? {}) as Record<string, unknown>;
    const fallbackUpdates = stripEnderecoDbUpdates(updates);
    fallbackUpdates.dados_simulacao = {
      ...dadosPrev,
      endereco: enderecoJsonFromCampos(enderecoCampos),
    };
    const retry = await admin
      .from("contratacoes_online")
      .update(fallbackUpdates)
      .eq("id", row.id)
      .select("*")
      .single();
    if (retry.error) {
      throw new Error(
        `Não foi possível salvar o endereço. ${contratacaoEnderecoMigrationHint()} Detalhe: ${retry.error.message}`,
      );
    }
    rowUpdated = hydrateContratacaoEndereco(retry.data as ContratacaoOnlineRow);
  } else if (error) {
    if (isContratacaoEnderecoSchemaError(error.message)) {
      throw new Error(contratacaoEnderecoMigrationHint());
    }
    throw new Error(error.message);
  } else {
    rowUpdated = hydrateContratacaoEndereco(data as ContratacaoOnlineRow);
  }

  if (patch.etapa === "pessoa" && enderecoCampos) {
    await syncLeadEnderecoContratacao(rowUpdated, enderecoCampos);
  }
  return rowUpdated;
}

async function upsertLeadContratacao(
  row: ContratacaoOnlineRow,
  cliente: { nome: string; telefone: string; email: string },
) {
  const admin = createAdminClient();
  const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);
  const dadosSim = {
    origem: "contratacao_online",
    contratacao_id: row.id,
    protocolo: row.protocolo,
    origem_fluxo: row.origem,
    modo: (row.dados_simulacao as { modo?: string }).modo,
    dados_simulacao: row.dados_simulacao,
  };

  if (row.lead_id) {
    await admin
      .from("leads")
      .update({
        nome: cliente.nome,
        whatsapp: cliente.telefone,
        email: cliente.email,
        origem: "contratacao_online",
        tipo_interesse: "consorcio",
        produto_interesse: row.tipo_bem,
        valor_simulado: row.credito_selecionado,
        prazo_simulado: row.prazo,
        dados_simulacao: dadosSim,
      })
      .eq("id", row.lead_id);
    return;
  }

  const { data: leadRow } = await admin
    .from("leads")
    .insert({
      nome: cliente.nome,
      whatsapp: cliente.telefone,
      email: cliente.email,
      origem: "contratacao_online",
      origem_detalhe: row.protocolo,
      tipo_interesse: "consorcio",
      produto_interesse: row.tipo_bem,
      valor_simulado: row.credito_selecionado,
      prazo_simulado: row.prazo,
      dados_simulacao: dadosSim,
      status: leadsConfig.statusInicialPadrao,
      criado_manual: false,
    })
    .select("id")
    .single();

  if (leadRow?.id) {
    await admin.from("contratacoes_online").update({ lead_id: leadRow.id }).eq("id", row.id);
  }
}

async function syncLeadEnderecoContratacao(
  row: ContratacaoOnlineRow,
  endereco: EnderecoContratacaoCampos,
) {
  if (!row.lead_id) return;
  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("dados_simulacao")
    .eq("id", row.lead_id)
    .maybeSingle();
  const prev = (lead?.dados_simulacao ?? {}) as Record<string, unknown>;
  const enderecoJson = enderecoJsonFromCampos(endereco);
  await admin
    .from("leads")
    .update({
      cidade: endereco.cidade.trim() || null,
      dados_simulacao: { ...prev, endereco: enderecoJson },
    })
    .eq("id", row.lead_id);
}

export async function uploadDocumentoContratacao(
  token: string,
  tipo: TipoDocumentoContratacao,
  file: File,
): Promise<{ ok: true; path: string }> {
  const row = await buscarContratacaoPorToken(token);
  if (!row) throw new Error("Proposta não encontrada");
  if (!statusPermiteEdicaoPublica(row.status)) {
    throw new Error("Esta solicitação já foi finalizada");
  }
  if (!MIME_PERMITIDOS.has(file.type)) {
    throw new Error("Tipo de arquivo não permitido");
  }
  if (file.size > MAX_BYTES) throw new Error("Arquivo muito grande (máx. 5 MB)");

  const admin = createAdminClient();
  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
  const path = `${row.id}/${tipo}_${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from("contratacoes-documentos").upload(path, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);

  await admin.from("contratacoes_documentos").insert({
    contratacao_id: row.id,
    tipo_documento: tipo,
    arquivo_url: path,
    arquivo_nome: file.name,
    mime_type: file.type,
    tamanho_bytes: file.size,
  });

  if (tipo === "comprovante_pix") {
    await admin
      .from("contratacoes_online")
      .update({ pix_comprovante_url: path, pix_status: "enviado" })
      .eq("id", row.id);
  }

  return { ok: true, path };
}

export async function finalizarContratacao(token: string): Promise<ContratacaoOnlineRow> {
  const row = await buscarContratacaoPorToken(token);
  if (!row) throw new Error("Proposta não encontrada");
  if (!statusPermiteEdicaoPublica(row.status)) {
    throw new Error("Esta solicitação já foi finalizada");
  }
  if (!row.nome?.trim()) {
    throw new Error("Informe o nome do cliente antes de finalizar a contratação.");
  }
  if (!row.forma_pagamento) throw new Error("Selecione a forma de pagamento");

  const cfg = await getConfigJsonPublic(
    "contratacao_online_config",
    DEFAULT_CONTRATACAO_ONLINE_CONFIG,
  );
  if (
    row.forma_pagamento === "pix" &&
    cfg.comprovante_pix_obrigatorio &&
    !row.pix_comprovante_url
  ) {
    throw new Error("Envie o comprovante Pix para finalizar");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contratacoes_online")
    .update({
      status: "aguardando_consultor",
      finalizado_em: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContratacaoOnlineRow;
}

export async function signedUrlDocumento(path: string, expiresIn = 3600): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from("contratacoes-documentos").createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function listarDocumentos(contratacaoId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("contratacoes_documentos")
    .select("*")
    .eq("contratacao_id", contratacaoId)
    .order("created_at", { ascending: true });
  return data ?? [];
}
