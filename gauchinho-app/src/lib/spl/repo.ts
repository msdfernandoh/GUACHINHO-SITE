import "server-only";

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertLeadPorTelefone } from "@/lib/crm/upsert-lead";
import { uploadImagemPublica } from "@/lib/storage/imagens";
import { extrairCodigo, extrairToken } from "./links";
import { gerarCodigo, type CadastroClienteInput, type CadastroImobiliariaInput, type CadastroVendedorInput } from "./validacao";
import {
  labelDe,
  SOLUCOES,
  type ClienteSpl,
  type EmpreendimentoSpl,
  type ImobiliariaSpl,
  modeloPadraoVendedor,
  type ModeloVendedor,
  type VendedorSpl,
} from "./types";

const db = () => createAdminClient({ noStore: true });

const IMOB_COLS =
  "id,empresa_id,nome,logo_url,responsavel,telefone,email,cnpj,chave_pix,chave_pix_tipo,modelo_parceria,quantidade_vendedores,modelo_vendedores,status,exibir_logo,codigo_convite,token_painel,termos_versao,termos_aceito_em,termos_aceite_ip,created_at";
const VEND_COLS = "id,imobiliaria_id,nome,telefone,email,cpf,chave_pix,chave_pix_tipo,modelo,codigo,ativo,created_at";
const CLI_COLS =
  "id,imobiliaria_id,vendedor_id,nome,telefone,email,empreendimento_slug,unidade,situacao,valor_chaves,solucao,status,origem,proposta_expira_em,created_at";

function tokenSeguro() {
  return randomBytes(24).toString("base64url");
}

async function codigoLivre(tabela: "spl_imobiliarias" | "spl_vendedores", coluna: string, empresaId: string) {
  for (let i = 0; i < 8; i++) {
    const codigo = gerarCodigo(8);
    const { data } = await db().from(tabela).select("id").eq("empresa_id", empresaId).eq(coluna, codigo).maybeSingle();
    if (!data) return codigo;
  }
  throw new Error("Não foi possível gerar um código agora. Tente de novo.");
}

/* ----------------------------- Empreendimentos ----------------------------- */

export async function listarEmpreendimentos(empresaId: string): Promise<EmpreendimentoSpl[]> {
  const { data, error } = await db()
    .from("spl_empreendimentos")
    .select("id,slug,nome,cidade,entrega_texto,entrega_data,vendidas,disponiveis,foto_url,solucoes_recomendadas,ordem")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .order("ordem");
  if (error) return [];
  return (data ?? []) as EmpreendimentoSpl[];
}

/* ------------------------------- Contadores -------------------------------- */

export async function estatisticasPublicas(empresaId: string) {
  const [{ count: imobiliarias }, { count: emAtendimento }, logos, empreendimentos] = await Promise.all([
    db().from("spl_imobiliarias").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("status", "APROVADA"),
    db()
      .from("spl_clientes")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .in("status", ["EM_ATENDIMENTO", "PROPOSTA", "FECHADO"]),
    db()
      .from("spl_imobiliarias")
      .select("id,nome,logo_url")
      .eq("empresa_id", empresaId)
      .eq("status", "APROVADA")
      .eq("exibir_logo", true)
      .not("logo_url", "is", null)
      .order("aprovado_em", { ascending: true })
      .limit(40),
    listarEmpreendimentos(empresaId),
  ]);
  const carteira = empreendimentos.reduce((a, e) => a + e.vendidas + e.disponiveis, 0);
  return {
    imobiliarias: imobiliarias ?? 0,
    clientesEmAtendimento: emAtendimento ?? 0,
    carteira,
    vendidas: empreendimentos.reduce((a, e) => a + e.vendidas, 0),
    disponiveis: empreendimentos.reduce((a, e) => a + e.disponiveis, 0),
    logos: (logos.data ?? []) as { id: string; nome: string; logo_url: string }[],
    empreendimentos,
  };
}

/* ------------------------------- Imobiliária ------------------------------- */

export async function cadastrarImobiliaria(
  empresaId: string,
  input: CadastroImobiliariaInput,
  logo: File | null,
): Promise<ImobiliariaSpl> {
  const { data: existente } = await db()
    .from("spl_imobiliarias")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("telefone", input.telefone)
    .maybeSingle();
  if (existente) throw new Error("Já existe uma imobiliária com este telefone. Fale com a nossa equipe para recuperar o acesso.");

  const codigo_convite = await codigoLivre("spl_imobiliarias", "codigo_convite", empresaId);
  const { data, error } = await db()
    .from("spl_imobiliarias")
    .insert({ ...input, empresa_id: empresaId, codigo_convite, token_painel: tokenSeguro(), status: "PENDENTE" })
    .select(IMOB_COLS)
    .single();
  if (error || !data) throw new Error("Não foi possível concluir o cadastro agora.");

  let imob = data as ImobiliariaSpl;
  if (logo && logo.size > 0) {
    if (logo.size > 5 * 1024 * 1024) throw new Error("A logo pode ter até 5 MB.");
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(logo.type)) throw new Error("Envie a logo em PNG, JPG ou WEBP.");
    try {
      const url = await uploadImagemPublica("imobiliarias", `spl/${empresaId}/${imob.id}`, logo);
      await db().from("spl_imobiliarias").update({ logo_url: url }).eq("id", imob.id);
      imob = { ...imob, logo_url: url };
    } catch {
      // A logo pode ser enviada depois pelo painel; o cadastro segue válido.
    }
  }

  // O responsável já entra como primeiro vendedor, para usar o portfólio no celular.
  try {
    await cadastrarVendedor(
      imob,
      { nome: imob.responsavel, telefone: imob.telefone, email: imob.email, cpf: null, chave_pix: null, chave_pix_tipo: null },
      "PROPRIO",
    );
  } catch {
    // Pode ser criado depois pelo painel.
  }

  // Registro também como organização parceira do tipo imobiliária (rascunho até a aprovação).
  try {
    const { data: org } = await db()
      .from("organizacoes_parceiras")
      .insert({
        empresa_id: empresaId,
        tipo: "IMOBILIARIA",
        nome_fantasia: imob.nome,
        cnpj: imob.cnpj,
        status: "RASCUNHO",
        telefone: imob.telefone,
        whatsapp: imob.telefone,
        email: imob.email,
        logo_url: imob.logo_url,
        observacoes: "Cadastro pelo portfólio SPL",
      })
      .select("id")
      .single();
    if (org?.id) await db().from("spl_imobiliarias").update({ organizacao_parceira_id: org.id }).eq("id", imob.id);
  } catch {
    // Vínculo opcional: não bloqueia o cadastro.
  }

  return imob;
}

export async function imobiliariaPorToken(empresaId: string, segmento: string): Promise<ImobiliariaSpl | null> {
  const token = extrairToken(segmento);
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
  const { data } = await db()
    .from("spl_imobiliarias")
    .select(IMOB_COLS)
    .eq("empresa_id", empresaId)
    .eq("token_painel", token)
    .neq("status", "INATIVA")
    .maybeSingle();
  return (data as ImobiliariaSpl | null) ?? null;
}

export async function imobiliariaPorConvite(empresaId: string, segmento: string): Promise<ImobiliariaSpl | null> {
  const codigo = extrairCodigo(segmento);
  if (!/^[A-Za-z0-9]{6,20}$/.test(codigo)) return null;
  const { data } = await db()
    .from("spl_imobiliarias")
    .select(IMOB_COLS)
    .eq("empresa_id", empresaId)
    .eq("codigo_convite", codigo.toUpperCase())
    .in("status", ["PENDENTE", "APROVADA"])
    .maybeSingle();
  return (data as ImobiliariaSpl | null) ?? null;
}

/**
 * Edição pelo painel. O modelo de parceria só muda enquanto o cadastro está em
 * aprovação; depois disso a mudança é feita pela equipe (mexe em comissão).
 */
export async function atualizarImobiliaria(
  imob: ImobiliariaSpl,
  input: CadastroImobiliariaInput,
  logo: File | null,
): Promise<ImobiliariaSpl> {
  const dados: Partial<CadastroImobiliariaInput> & { logo_url?: string } = { ...input };
  if (imob.status !== "PENDENTE") dados.modelo_parceria = imob.modelo_parceria;
  if (input.telefone !== imob.telefone) {
    const { data: outro } = await db()
      .from("spl_imobiliarias")
      .select("id")
      .eq("empresa_id", imob.empresa_id)
      .eq("telefone", input.telefone)
      .neq("id", imob.id)
      .maybeSingle();
    if (outro) throw new Error("Esse telefone já está em outra imobiliária.");
  }
  if (logo && logo.size > 0) {
    if (logo.size > 5 * 1024 * 1024) throw new Error("A logo pode ter até 5 MB.");
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(logo.type)) throw new Error("Envie a logo em PNG, JPG ou WEBP.");
    dados.logo_url = await uploadImagemPublica("imobiliarias", `spl/${imob.empresa_id}/${imob.id}-${Date.now()}`, logo);
  }
  const { data, error } = await db()
    .from("spl_imobiliarias")
    .update(dados)
    .eq("id", imob.id)
    .eq("empresa_id", imob.empresa_id)
    .select(IMOB_COLS)
    .single();
  if (error || !data) throw new Error("Não foi possível salvar as alterações agora.");
  return data as ImobiliariaSpl;
}

/* -------------------------------- Vendedores ------------------------------- */

export async function cadastrarVendedor(
  imob: ImobiliariaSpl,
  input: CadastroVendedorInput,
  modelo?: ModeloVendedor,
): Promise<VendedorSpl> {
  const { data: existente } = await db()
    .from("spl_vendedores")
    .select(VEND_COLS)
    .eq("imobiliaria_id", imob.id)
    .eq("telefone", input.telefone)
    .maybeSingle();
  if (existente) return existente as VendedorSpl;
  const codigo = await codigoLivre("spl_vendedores", "codigo", imob.empresa_id);
  const { data, error } = await db()
    .from("spl_vendedores")
    .insert({ ...input, empresa_id: imob.empresa_id, imobiliaria_id: imob.id, modelo: modelo ?? modeloPadraoVendedor(imob.modelo_vendedores), codigo })
    .select(VEND_COLS)
    .single();
  if (error || !data) throw new Error("Não foi possível cadastrar o vendedor agora.");
  return data as VendedorSpl;
}

export async function vendedorPorCodigo(empresaId: string, segmento: string) {
  const codigo = extrairCodigo(segmento);
  if (!/^[A-Za-z0-9]{6,20}$/.test(codigo)) return null;
  const { data } = await db()
    .from("spl_vendedores")
    .select(VEND_COLS)
    .eq("empresa_id", empresaId)
    .eq("codigo", codigo.toUpperCase())
    .eq("ativo", true)
    .maybeSingle();
  if (!data) return null;
  const vendedor = data as VendedorSpl;
  const { data: imob } = await db()
    .from("spl_imobiliarias")
    .select(IMOB_COLS)
    .eq("id", vendedor.imobiliaria_id)
    .in("status", ["PENDENTE", "APROVADA"])
    .maybeSingle();
  return imob ? { vendedor, imobiliaria: imob as ImobiliariaSpl } : null;
}

export async function listarVendedores(imobiliariaId: string): Promise<VendedorSpl[]> {
  const { data } = await db().from("spl_vendedores").select(VEND_COLS).eq("imobiliaria_id", imobiliariaId).order("nome");
  return (data ?? []) as VendedorSpl[];
}

/* --------------------------------- Clientes -------------------------------- */

export async function cadastrarCliente(args: {
  imob: ImobiliariaSpl;
  vendedor: VendedorSpl | null;
  input: CadastroClienteInput;
  origem: "PAINEL" | "PLANILHA" | "PORTFOLIO";
  dados?: Record<string, unknown>;
  status?: ClienteSpl["status"];
  propostaExpiraEm?: string | null;
  host?: string | null;
}): Promise<ClienteSpl> {
  const { imob, vendedor, input, origem } = args;
  const solucao = labelDe(SOLUCOES, input.solucao);
  let leadId: string | null = null;
  try {
    const lead = await upsertLeadPorTelefone(createAdminClient(), {
      empresa_id: imob.empresa_id,
      nome: input.nome,
      whatsapp: input.telefone,
      email: input.email,
      origem: "spl_portfolio",
      origem_detalhe: `${imob.nome}${vendedor ? ` · ${vendedor.nome}` : ""}`,
      tipo_interesse: "imovel",
      produto_interesse: input.solucao ? solucao : "Carteira SPL",
      valor_credito: input.valor_chaves,
      resultado_resumido: [
        input.empreendimento_slug ? `Empreendimento ${input.empreendimento_slug}` : null,
        input.unidade ? `unidade ${input.unidade}` : null,
        input.valor_chaves ? `chaves R$ ${input.valor_chaves.toLocaleString("pt-BR")}` : null,
        input.solucao ? solucao : null,
      ]
        .filter(Boolean)
        .join(" · "),
      dados_simulacao: { spl: { imobiliaria: imob.nome, vendedor: vendedor?.nome ?? null, ...args.dados } },
      host_origem: args.host ?? null,
      pagina_origem: "spl",
    });
    leadId = lead.ok ? lead.lead_id ?? null : null;
  } catch {
    leadId = null;
  }

  const linha = {
    empresa_id: imob.empresa_id,
    imobiliaria_id: imob.id,
    vendedor_id: vendedor?.id ?? null,
    lead_id: leadId,
    ...input,
    origem,
    status: args.status ?? "NOVO",
    proposta_expira_em: args.propostaExpiraEm ?? null,
    dados: args.dados ?? {},
  };
  const { data, error } = await db()
    .from("spl_clientes")
    .upsert(linha, { onConflict: "imobiliaria_id,telefone" })
    .select(CLI_COLS)
    .single();
  if (error || !data) throw new Error("Não foi possível salvar o cliente agora.");
  return data as ClienteSpl;
}

export async function listarClientes(imobiliariaId: string): Promise<ClienteSpl[]> {
  const todos: ClienteSpl[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await db()
      .from("spl_clientes")
      .select(CLI_COLS)
      .eq("imobiliaria_id", imobiliariaId)
      .order("created_at", { ascending: false })
      .range(from, from + 499);
    if (error) break;
    todos.push(...((data ?? []) as ClienteSpl[]));
    if (!data || data.length < 500) break;
  }
  return todos;
}

/* ---------------------------------- Admin ---------------------------------- */

export async function listarImobiliariasAdmin(empresaId: string) {
  const { data } = await db()
    .from("spl_imobiliarias")
    .select(IMOB_COLS)
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });
  const imobs = (data ?? []) as ImobiliariaSpl[];
  if (!imobs.length) return [];
  const ids = imobs.map((i) => i.id);
  const [{ data: vends }, { data: clis }] = await Promise.all([
    db().from("spl_vendedores").select("imobiliaria_id").in("imobiliaria_id", ids),
    db().from("spl_clientes").select("imobiliaria_id,status").in("imobiliaria_id", ids),
  ]);
  return imobs.map((i) => ({
    ...i,
    vendedores: (vends ?? []).filter((v: { imobiliaria_id: string }) => v.imobiliaria_id === i.id).length,
    clientes: (clis ?? []).filter((c: { imobiliaria_id: string }) => c.imobiliaria_id === i.id).length,
    emAtendimento: (clis ?? []).filter(
      (c: { imobiliaria_id: string; status: string }) => c.imobiliaria_id === i.id && c.status !== "NOVO" && c.status !== "PERDIDO",
    ).length,
  }));
}

export async function listarClientesAdmin(empresaId: string) {
  const { data } = await db()
    .from("spl_clientes")
    .select(`${CLI_COLS},imobiliaria:spl_imobiliarias(nome),vendedor:spl_vendedores(nome)`)
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as unknown as (ClienteSpl & { imobiliaria: { nome: string } | null; vendedor: { nome: string } | null })[];
}

/* ------------------------------ Painel da SPL ------------------------------ */

export const SPL_DASHBOARD_CHAVE = "spl_dashboard";

/** Token do painel da SPL (somente leitura), guardado em configuracoes_sistema. */
export async function tokenDashboardSpl(): Promise<string | null> {
  const { data } = await db().from("configuracoes_sistema").select("valor").eq("chave", SPL_DASHBOARD_CHAVE).maybeSingle();
  const token = (data?.valor as { token?: string } | null)?.token;
  return typeof token === "string" && token.length >= 32 ? token : null;
}

/** Números agregados de todas as imobiliárias: sem nomes ou telefones de clientes. */
export async function dashboardSpl(empresaId: string) {
  const [{ data: imobs }, { data: vends }, { data: clis }, empreendimentos] = await Promise.all([
    db()
      .from("spl_imobiliarias")
      .select("id,nome,logo_url,status,modelo_parceria,quantidade_vendedores,cnpj,created_at")
      .eq("empresa_id", empresaId)
      .neq("status", "RECUSADA")
      .order("created_at"),
    db().from("spl_vendedores").select("imobiliaria_id").eq("empresa_id", empresaId).eq("ativo", true),
    db().from("spl_clientes").select("imobiliaria_id,status,solucao,empreendimento_slug,valor_chaves,situacao").eq("empresa_id", empresaId),
    listarEmpreendimentos(empresaId),
  ]);
  type Cli = { imobiliaria_id: string; status: string; solucao: string | null; empreendimento_slug: string | null; valor_chaves: number | null; situacao: string | null };
  const clientes = (clis ?? []) as Cli[];
  const trabalhado = (c: Cli) => c.status !== "NOVO" && c.status !== "PERDIDO";
  const porStatus = (lista: Cli[], s: string) => lista.filter((c) => c.status === s).length;

  const imobiliarias = ((imobs ?? []) as {
    id: string;
    nome: string;
    logo_url: string | null;
    status: string;
    modelo_parceria: string;
    quantidade_vendedores: number;
    cnpj: string | null;
    created_at: string;
  }[]).map((i) => {
    const cs = clientes.filter((c) => c.imobiliaria_id === i.id);
    return {
      ...i,
      vendedores: (vends ?? []).filter((v: { imobiliaria_id: string }) => v.imobiliaria_id === i.id).length,
      clientes: cs.length,
      emAtendimento: cs.filter(trabalhado).length,
      propostas: porStatus(cs, "PROPOSTA"),
      fechados: porStatus(cs, "FECHADO"),
      valorChaves: cs.reduce((a, c) => a + Number(c.valor_chaves ?? 0), 0),
    };
  });

  const porEmpreendimento = empreendimentos.map((e) => {
    const cs = clientes.filter((c) => c.empreendimento_slug === e.slug);
    return {
      slug: e.slug,
      nome: e.nome,
      cidade: e.cidade,
      entrega: e.entrega_texto,
      unidades: e.vendidas + e.disponiveis,
      clientes: cs.length,
      jaComprou: cs.filter((c) => c.situacao === "JA_COMPROU").length,
      emAtendimento: cs.filter(trabalhado).length,
      fechados: porStatus(cs, "FECHADO"),
    };
  });

  const porSolucao = SOLUCOES.map((s) => ({ label: s.label, total: clientes.filter((c) => c.solucao === s.value).length }));

  return {
    totais: {
      imobiliarias: imobiliarias.length,
      aprovadas: imobiliarias.filter((i) => i.status === "APROVADA").length,
      pendentes: imobiliarias.filter((i) => i.status === "PENDENTE").length,
      vendedores: (vends ?? []).length,
      clientes: clientes.length,
      emAtendimento: clientes.filter(trabalhado).length,
      propostas: porStatus(clientes, "PROPOSTA"),
      fechados: porStatus(clientes, "FECHADO"),
      carteira: empreendimentos.reduce((a, e) => a + e.vendidas + e.disponiveis, 0),
    },
    imobiliarias,
    porEmpreendimento,
    porSolucao,
  };
}
