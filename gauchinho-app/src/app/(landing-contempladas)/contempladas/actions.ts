"use server";

import { revalidatePath } from "next/cache";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerCotasTexto, type LinhaLida } from "@/lib/contempladas/parser";
import { buscarCombinacoes, valorAcrescimo, type Acrescimo, type Preferencia } from "@/lib/contempladas/motor";
import * as repo from "@/lib/contempladas/repo";
import * as acesso from "@/lib/contempladas/acesso";
import { uploadImagemPublica } from "@/lib/storage/imagens";

async function empresa() {
  const t = await getResolvedTenant();
  if (!t) throw new Error("Site não configurado.");
  return t.empresaId;
}

async function exigirGerencia() {
  const empresaId = await empresa();
  const a = await acesso.getAcesso(empresaId);
  if (!acesso.podeGerenciar(a)) throw new Error("Somente gerência do portal.");
  return { empresaId, a: a! };
}

async function exigirLogado() {
  const empresaId = await empresa();
  const a = await acesso.getAcesso(empresaId);
  if (!a) throw new Error("Faça login.");
  return { empresaId, a };
}

const acrescimoValido = (a: Acrescimo | null | undefined): Acrescimo => ({
  tipo: a?.tipo === "PERCENTUAL" ? "PERCENTUAL" : "FIXO",
  valor: Math.max(0, Number(a?.valor) || 0),
});

const resultado = async <T,>(fn: () => Promise<T>) => {
  try {
    return { ok: true as const, ...(await fn()) };
  } catch (e) {
    return { ok: false as const, erro: e instanceof Error ? e.message : "Erro." };
  }
};

/* ------------------------------- Envio ------------------------------- */

/** Gerente vê e mexe só nas próprias cotas; o dono do portal vê todas. */
const escopo = (a: acesso.Acesso) => (a.papel === "DONO" ? undefined : a.authUserId);

/** Configuração de quem está logado: padrão da empresa para o dono, a da unidade para o gerente. */
const minhaConfig = (empresaId: string, a: acesso.Acesso) =>
  a.papel === "DONO" ? repo.getConfig(empresaId) : repo.getConfigGerente(empresaId, a.authUserId);

/** Ágio do envio por tipo de bem: o configurado ou, se desmarcar o padrão, o informado na tela (vale para os dois). */
/** Dono das cotas do envio: o próprio gerente; o dono do portal pode escolher um gerente. */
async function donoDoEnvio(empresaId: string, a: acesso.Acesso, gerenteId: string | null | undefined) {
  if (a.papel !== "DONO" || !gerenteId || gerenteId === a.authUserId) {
    const cfg = await minhaConfig(empresaId, a);
    return { authUserId: a.authUserId, nome: cfg.unidade || a.nome, cfg, proprio: true };
  }
  const g = (await acesso.listarGerentes(empresaId)).find((x) => x.authUserId === gerenteId);
  if (!g) throw new Error("Administrador de cotas não encontrado.");
  const cfg = await repo.getConfigGerente(empresaId, g.authUserId);
  return { authUserId: g.authUserId, nome: g.unidade || g.nome, cfg, proprio: false };
}

async function agioDoEnvio(empresaId: string, a: acesso.Acesso, personalizado: Acrescimo | null | undefined, gerenteId?: string | null) {
  if (personalizado) {
    const v = acrescimoValido(personalizado);
    return () => v;
  }
  const { cfg } = await donoDoEnvio(empresaId, a, gerenteId);
  return (tipo: "imovel" | "automovel"): Acrescimo =>
    tipo === "automovel" ? { tipo: cfg.agio_auto_tipo, valor: cfg.agio_auto_valor } : { tipo: cfg.agio_tipo, valor: cfg.agio_valor };
}

export type LinhaPrevia = LinhaLida & { duplicada: { codigo: string; status: string; dono: string | null; noTexto?: boolean } | null };

/** Prévia do envio com aviso de cota idêntica (já no portal ou repetida no próprio texto). */
export async function preverEnvioAction(texto: string, personalizado: Acrescimo | null = null, gerenteId: string | null = null): Promise<LinhaPrevia[]> {
  const { empresaId, a } = await exigirGerencia();
  const linhas = lerCotasTexto(String(texto ?? ""), await agioDoEnvio(empresaId, a, personalizado, gerenteId));
  const validas = linhas.flatMap((l) => (l.cota ? [l.cota] : []));
  const existentes = await repo.acharDuplicadas(empresaId, validas);
  const vistas = new Set<string>();
  let k = 0;
  return linhas.map((l) => {
    if (!l.cota) return { ...l, duplicada: null };
    const ja = existentes[k++];
    const chave = `${l.cota.administradora}|${l.cota.credito}|${l.cota.prazo}|${l.cota.entrada_original}`;
    const repetida = vistas.has(chave);
    vistas.add(chave);
    return { ...l, duplicada: ja ?? (repetida ? { codigo: "repetida no texto", status: "", dono: null, noTexto: true } : null) };
  });
}

/** Sobe as cotas com o ágio do gerente na entrada; as cotas ficam no nome dele. */
export async function enviarCotasAction(
  texto: string,
  personalizado: Acrescimo | null = null,
  gerenteId: string | null = null,
  comissaoLote: Acrescimo | null = null,
  /** Índices (da prévia) que não devem entrar, ex.: duplicadas desmarcadas. */
  ignorar: number[] = [],
) {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    const dono = await donoDoEnvio(empresaId, a, gerenteId);
    const agio = await agioDoEnvio(empresaId, a, personalizado, gerenteId);
    const fora = new Set(ignorar);
    const cotas = lerCotasTexto(String(texto ?? ""), agio).flatMap((l, i) => (l.cota && !fora.has(i) ? [l.cota] : []));
    if (!cotas.length) throw new Error("Nenhuma cota válida no texto.");
    const { data: erp } = await createAdminClient({ noStore: true }).from("usuarios").select("id").eq("auth_user_id", a.authUserId).maybeSingle();
    const r = await repo.importarCotas({
      empresaId,
      usuarioId: erp?.id ?? null,
      cotas,
      acrescimo: agio("imovel"),
      // Cotas novas somam às que já estão; uma cota só sai quando é vendida ou excluída.
      substituir: false,
      comissaoLote: comissaoLote ? acrescimoValido(comissaoLote) : null,
      texto,
      donoAuthId: dono.authUserId,
      donoNome: dono.nome,
      incluirSemDono: a.papel === "DONO" && dono.proprio,
    });
    revalidatePath("/contempladas");
    return r;
  });
}

/* ------------------------------ Simulação ------------------------------ */

export async function simularAction(p: { credito: number; entradaMax: number | null; preferencia: Preferencia; maxCotas?: number; tipo?: "imovel" | "automovel" | null }) {
  const empresaId = await empresa();
  const [todas, cfgs, a] = await Promise.all([repo.listarCotas(empresaId), repo.configsPorDono(empresaId), acesso.getAcesso(empresaId)]);
  // Comissão só vai para quem está logado.
  const cotas = todas
    .filter((c) => c.status === "DISPONIVEL" && (!p.tipo || c.tipo === p.tipo))
    .map((c) => ({ ...c, comissao_parceiro: a ? repo.comissaoVisivel(c, cfgs.de(c.dono_auth_id)) : 0 }));
  const credito = Math.max(0, Number(p.credito) || 0);
  const entradaMax = p.entradaMax ? Math.max(0, Number(p.entradaMax)) : null;
  const preferencia: Preferencia = p.preferencia === "MENOR_PRAZO" ? "MENOR_PRAZO" : "MENOR_PARCELA";
  await repo.registrarSimulacao(empresaId, credito, entradaMax, preferencia);
  return buscarCombinacoes(cotas, { credito, entradaMax, preferencia, maxCotas: p.maxCotas ?? 0 });
}

export async function gerarPropostaAction(p: { cotaIds: string[]; modo: string; desconto?: number; clienteNome?: string; clienteTelefone?: string }) {
  return resultado(async () => {
    const empresaId = await empresa();
    const [a, cfgs] = await Promise.all([acesso.getAcesso(empresaId), repo.configsPorDono(empresaId)]);
    const cotas = await repo.cotasPorIds(empresaId, p.cotaIds);
    if (!cotas.length) throw new Error("Selecione ao menos uma cota.");
    if (cotas.some((c) => c.status !== "DISPONIVEL")) throw new Error("Uma das cotas não está mais disponível.");
    const credito = cotas.reduce((s, c) => s + c.credito, 0);
    const entradaBase = cotas.reduce((s, c) => s + c.entrada, 0);
    // Adicional fixo do vendedor entra sozinho; desconto só para quem está logado.
    const adicional = a ? valorAcrescimo(credito, a.adicional) : 0;
    const desconto = a ? Math.min(Math.max(0, Number(p.desconto) || 0), entradaBase + adicional) : 0;
    const comissao = a ? cotas.reduce((s, c) => s + repo.comissaoVisivel(c, cfgs.de(c.dono_auth_id)), 0) : 0;
    const modos = ["COMPLETA", "MENSAL", "SEMESTRAL", "ANUAL", "RESUMO"];
    const numero = await repo.salvarProposta({
      empresaId,
      usuarioId: null,
      vendedorAuthId: a?.authUserId ?? null,
      vendedorNome: a?.nome ?? null,
      vendedorTelefone: a?.telefone ?? null,
      vendedorLogo: a?.logoUrl ?? null,
      adicional,
      desconto,
      comissao,
      cotas,
      acrescimo: null,
      modo: modos.includes(p.modo) ? p.modo : "COMPLETA",
      clienteNome: p.clienteNome?.trim() || null,
      clienteTelefone: p.clienteTelefone?.replace(/\D/g, "") || null,
    });
    return { numero };
  });
}

/* ------------------------------- Reservas ------------------------------- */

export async function reservarAction(fd: FormData) {
  return resultado(async () => {
    const empresaId = await empresa();
    const cotaIds = String(fd.get("cotaIds") ?? "").split(",").filter(Boolean);
    const cotas = await repo.cotasPorIds(empresaId, cotaIds);
    if (!cotas.length) throw new Error("Cota não encontrada.");
    const cfg = (await repo.configsPorDono(empresaId)).de(cotas[0].dono_auth_id);
    // Valor do PIX: sinal de bloqueio do tipo de bem, quando configurado; senão a entrada.
    const valorPix = cotas.reduce((s, c) => {
      const sinal = c.tipo === "automovel" ? cfg.sinal_auto : cfg.sinal_imovel;
      return s + (sinal > 0 ? sinal : c.entrada);
    }, 0);
    const tipo = fd.get("tipo") === "PIX" ? "PIX" : "PRE";
    const nome = String(fd.get("nome") ?? "").trim();
    const telefone = String(fd.get("telefone") ?? "").replace(/\D/g, "");
    if (nome.length < 3 || telefone.length < 10) throw new Error("Informe nome e WhatsApp.");
    const comprovante = fd.get("comprovante");
    if (tipo === "PIX" && !(comprovante instanceof File && comprovante.size)) throw new Error("Anexe o comprovante do PIX.");
    const r = await repo.criarReserva({
      empresaId,
      usuarioId: null,
      propostaId: (fd.get("propostaId") as string) || null,
      cotaIds,
      tipo,
      valorPix,
      nome,
      telefone,
      comprovante: comprovante instanceof File ? comprovante : null,
      minutos: cfg.pre_reserva_minutos,
    });
    revalidatePath("/contempladas");
    return r;
  });
}

/* -------------------------------- Gerência -------------------------------- */

export async function decidirReservaAction(reservaId: string, acao: "VENDIDA" | "CANCELAR") {
  const { empresaId, a } = await exigirGerencia();
  await repo.decidirReserva(empresaId, reservaId, acao, escopo(a), { authId: a.authUserId, nome: a.nome });
  revalidatePath("/contempladas/painel");
}

export async function statusCotaAction(cotaId: string, status: "DISPONIVEL" | "VENDIDA" | "INATIVA") {
  const { empresaId, a } = await exigirGerencia();
  // Excluir é só do dono; o gerente pede exclusão.
  if (status === "INATIVA" && a.papel !== "DONO") throw new Error("Peça a exclusão: o dono do portal aprova.");
  await repo.mudarStatusCotas(empresaId, [cotaId], status, escopo(a), { authId: a.authUserId, nome: a.nome });
  revalidatePath("/contempladas");
  revalidatePath("/contempladas/painel");
}

/**
 * Salva a configuração. Sem alvo: a de quem está logado (dono = padrão da empresa).
 * O dono pode salvar a de um administrador de cotas passando o auth id dele.
 */
export async function salvarConfigAction(c: repo.ConfigContempladas, atualizarEntradas = true, alvoAuthId: string | null = null) {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    const v = (x: unknown) => Math.max(0, Number(x) || 0);
    const limpo: repo.ConfigContempladas = {
      pre_reserva_minutos: Math.min(10080, Math.max(5, Math.round(Number(c.pre_reserva_minutos) || 120))),
      whatsapp: c.whatsapp?.replace(/\D/g, "") || null,
      ...validarPix(c.chave_pix_tipo, c.chave_pix),
      favorecido_pix: c.favorecido_pix?.trim() || null,
      comissao_modo: c.comissao_modo === "PERCENTUAL" ? "PERCENTUAL" : "TABELA",
      comissao_percentual: v(c.comissao_percentual),
      comissao_repasse_percentual: Math.min(100, v(c.comissao_repasse_percentual)),
      agio_tipo: c.agio_tipo === "PERCENTUAL" ? "PERCENTUAL" : "FIXO",
      agio_valor: v(c.agio_valor),
      agio_auto_tipo: c.agio_auto_tipo === "PERCENTUAL" ? "PERCENTUAL" : "FIXO",
      agio_auto_valor: v(c.agio_auto_valor),
      sinal_imovel: v(c.sinal_imovel),
      sinal_auto: v(c.sinal_auto),
      transferencia_imovel: v(c.transferencia_imovel),
      transferencia_auto: v(c.transferencia_auto),
      dia_vencimento: Math.min(31, Math.max(1, Math.round(Number(c.dia_vencimento) || 10))),
      unidade: c.unidade?.trim() || null,
    };
    const alvo = a.papel === "DONO" && alvoAuthId && alvoAuthId !== a.authUserId ? alvoAuthId : null;
    if (alvo) await repo.salvarConfigGerente(empresaId, alvo, limpo);
    else if (a.papel === "DONO") await repo.salvarConfig(empresaId, limpo);
    else await repo.salvarConfigGerente(empresaId, a.authUserId, limpo);
    // Ágio novo atualiza a entrada de todas as cotas disponíveis da unidade.
    const atualizadas = atualizarEntradas
      ? await repo.reaplicarAgio(empresaId, alvo ?? a.authUserId, !alvo && a.papel === "DONO", limpo)
      : 0;
    revalidatePath("/contempladas");
    revalidatePath("/contempladas/painel");
    return { atualizadas };
  });
}

/** Cadastro direto pela gerência. Só o dono cria outro gerente. */
export async function cadastrarUsuarioAction(p: { nome: string; email: string; telefone: string; senha: string; papel: "GERENTE" | "VENDEDOR" }) {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    const papel = p.papel === "GERENTE" && a.papel === "DONO" ? "GERENTE" : "VENDEDOR";
    validarCadastro(p);
    await acesso.criarUsuarioPortal({ empresaId, nome: p.nome, email: p.email, telefone: p.telefone.replace(/\D/g, "") || null, senha: p.senha, papel, criadoPor: a.authUserId });
    revalidatePath("/contempladas/painel");
    return {};
  });
}

export async function gerarConviteAction(papel: "GERENTE" | "VENDEDOR") {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    const token = await acesso.criarConvite(empresaId, a.authUserId, papel === "GERENTE" && a.papel === "DONO" ? "GERENTE" : "VENDEDOR");
    return { token };
  });
}

export async function atualizarUsuarioAction(id: string, campos: { ativo?: boolean; papel?: "GERENTE" | "VENDEDOR" }) {
  const { empresaId, a } = await exigirGerencia();
  if (campos.papel && a.papel !== "DONO") throw new Error("Só o dono muda o papel.");
  await acesso.atualizarUsuarioPortal(empresaId, id, campos);
  revalidatePath("/contempladas/painel");
}

/* ------------------------------- Vendedor ------------------------------- */

/** Perfil do gerente/vendedor: adicional fixo, telefone e logomarca da proposta. */
export async function salvarPerfilAction(fd: FormData) {
  return resultado(async () => {
    const { empresaId, a } = await exigirLogado();
    const adicional = acrescimoValido({ tipo: fd.get("adicional_tipo") === "PERCENTUAL" ? "PERCENTUAL" : "FIXO", valor: Number(fd.get("adicional_valor")) || 0 });
    const telefone = String(fd.get("telefone") ?? "").replace(/\D/g, "") || null;
    let logoUrl = fd.get("remover_logo") === "1" ? null : a.logoUrl;
    const logo = fd.get("logo");
    if (logo instanceof File && logo.size) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(logo.type)) throw new Error("Envie a logo em PNG, JPG ou WEBP.");
      if (logo.size > 2 * 1024 * 1024) throw new Error("Logo acima de 2 MB.");
      logoUrl = await uploadImagemPublica("parceiros", `contempladas/logos/${empresaId}/${a.authUserId}-${Date.now()}`, logo);
    }
    await acesso.salvarPerfil(empresaId, a, { adicional, telefone, logoUrl });
    revalidatePath("/contempladas");
    revalidatePath("/contempladas/painel");
    return {};
  });
}

function validarCadastro(p: { nome: string; email: string; senha: string }) {
  if ((p.nome ?? "").trim().length < 3) throw new Error("Informe o nome.");
  if (!/^\S+@\S+\.\S+$/.test(p.email ?? "")) throw new Error("E-mail inválido.");
  if ((p.senha ?? "").length < 8) throw new Error("A senha precisa ter ao menos 8 caracteres.");
}

/** Cadastro pelo link de convite. Cria só usuário do portal, sem acesso ao ERP. */
export async function cadastroConviteAction(token: string, p: { nome: string; email: string; telefone: string; senha: string }) {
  return resultado(async () => {
    const empresaId = await empresa();
    const convite = await acesso.lerConvite(empresaId, token);
    if (!convite) throw new Error("Link expirado ou inválido. Peça um novo ao administrador de cotas.");
    validarCadastro(p);
    await acesso.criarUsuarioPortal({ empresaId, nome: p.nome, email: p.email, telefone: p.telefone.replace(/\D/g, "") || null, senha: p.senha, papel: convite.papel, criadoPor: convite.criado_por });
    await acesso.usarConvite(token, convite.usos);
    return {};
  });
}

/** Dono marca quais usuários do ERP também gerenciam o portal. */
export async function permissaoEnvioAction(usuarioId: string, pode: boolean) {
  const { empresaId, a } = await exigirGerencia();
  if (a.papel !== "DONO") throw new Error("Somente o dono do portal.");
  const { data } = await createAdminClient({ noStore: true })
    .from("empresa_usuarios")
    .select("usuario_id")
    .eq("empresa_id", empresaId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (!data) throw new Error("Usuário não pertence a esta empresa.");
  await repo.definirPermissaoEnvio(usuarioId, pode);
  revalidatePath("/contempladas/painel");
}

const TIPOS_PIX = ["CELULAR", "EMAIL", "CPF", "CNPJ", "ALEATORIA"] as const;

/** Valida e normaliza a chave PIX conforme o tipo escolhido. */
function validarPix(tipo: string, chave: string | null) {
  const t = (TIPOS_PIX as readonly string[]).includes(tipo) ? (tipo as (typeof TIPOS_PIX)[number]) : "CELULAR";
  const v = (chave ?? "").trim();
  if (!v) return { chave_pix_tipo: t, chave_pix: null };
  const d = v.replace(/\D/g, "");
  const ok =
    t === "CELULAR" ? d.length === 11 :
    t === "CPF" ? d.length === 11 :
    t === "CNPJ" ? d.length === 14 :
    t === "EMAIL" ? /^\S+@\S+\.\S+$/.test(v) :
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  if (!ok) throw new Error("Chave PIX inválida para o tipo escolhido.");
  return { chave_pix_tipo: t, chave_pix: v };
}

/** Ágio padrão do gerente escolhido, para a tela de envio do dono do portal. */
export async function agioGerenteAction(gerenteId: string | null) {
  const { empresaId, a } = await exigirGerencia();
  const { cfg } = await donoDoEnvio(empresaId, a, gerenteId);
  return { imovel: { tipo: cfg.agio_tipo, valor: cfg.agio_valor } as Acrescimo, auto: { tipo: cfg.agio_auto_tipo, valor: cfg.agio_auto_valor } as Acrescimo };
}

/** Gerência marca vendida direto da lista (gerente só as da unidade dele). */
export async function marcarVendidaAction(cotaId: string) {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    const [c] = await repo.cotasPorIds(empresaId, [cotaId]);
    if (!c) throw new Error("Cota não encontrada.");
    if (a.papel !== "DONO" && c.dono_auth_id !== a.authUserId) throw new Error("Essa cota é de outra unidade.");
    await repo.mudarStatusCotas(empresaId, [cotaId], "VENDIDA", escopo(a), { authId: a.authUserId, nome: a.nome });
    revalidatePath("/contempladas");
    revalidatePath("/contempladas/painel");
    return {};
  });
}

/** Gerente pede para tirar uma cota da unidade dele; o dono do portal aprova ou recusa. */
export async function solicitarExclusaoAction(cotaId: string, motivo: string) {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    await repo.solicitarExclusao(empresaId, cotaId, a.authUserId, a.nome, String(motivo ?? "").slice(0, 300));
    revalidatePath("/contempladas/painel");
    return {};
  });
}

export async function decidirExclusaoAction(cotaId: string, aprovar: boolean) {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    if (a.papel !== "DONO") throw new Error("Somente o dono do portal.");
    if (aprovar) await repo.mudarStatusCotas(empresaId, [cotaId], "INATIVA");
    else await repo.recusarExclusao(empresaId, cotaId);
    revalidatePath("/contempladas");
    revalidatePath("/contempladas/painel");
    return {};
  });
}

/* ------------------------- Solicitação de acesso ------------------------- */

const TIPOS_CADASTRO = { ADMINISTRA: "GERENTE", ADMINISTRA_E_REVENDE: "GERENTE", REVENDE: "VENDEDOR" } as const;
const so = (v: unknown) => String(v ?? "").trim();
const digitos = (v: unknown) => so(v).replace(/\D/g, "");

/** Cadastro público pelo portal: fica pendente até o dono aprovar. */
export async function solicitarAcessoAction(p: {
  tipo: keyof typeof TIPOS_CADASTRO;
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  administradora: string;
  cidade: string;
  empresa: string;
  cnpj: string;
  cpf: string;
  pixTipo?: string;
  pixChave?: string;
  pixFavorecido?: string;
}) {
  return resultado(async () => {
    const empresaId = await empresa();
    const tipo = p.tipo in TIPOS_CADASTRO ? p.tipo : "REVENDE";
    const pix = so(p.pixChave) ? validarPix(p.pixTipo ?? "CELULAR", so(p.pixChave)) : null;
    validarCadastro(p);
    const cpf = digitos(p.cpf);
    const cnpj = digitos(p.cnpj);
    if (cpf.length !== 11) throw new Error("CPF inválido.");
    if (cnpj && cnpj.length !== 14) throw new Error("CNPJ inválido.");
    if (digitos(p.telefone).length < 10) throw new Error("Informe o WhatsApp com DDD.");
    const authId = await acesso.criarUsuarioPortal({
      empresaId,
      nome: p.nome,
      email: p.email,
      telefone: digitos(p.telefone),
      senha: p.senha,
      papel: TIPOS_CADASTRO[tipo],
      criadoPor: null,
      pendente: true,
      extras: { administradora: so(p.administradora) || null, cidade: so(p.cidade) || null, empresa: so(p.empresa) || null, cnpj: cnpj || null, cpf, tipo_cadastro: tipo },
    });
    if (pix) await acesso.salvarPixMembro(empresaId, authId, { tipo: pix.chave_pix_tipo, chave: pix.chave_pix, favorecido: so(p.pixFavorecido) || p.nome });
    return {};
  });
}

export async function decidirSolicitacaoAction(id: string, aprovar: boolean) {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    if (a.papel !== "DONO") throw new Error("Somente o dono do portal aprova cadastros.");
    await acesso.atualizarUsuarioPortal(empresaId, id, aprovar ? { status: "ATIVO", ativo: true } : { status: "RECUSADO", ativo: false });
    revalidatePath("/contempladas/painel");
    return {};
  });
}

/** Meu perfil: nome, e-mail, senha, contato e empresa. */
export async function salvarMeusDadosAction(d: {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  administradora: string;
  cidade: string;
  empresa: string;
  cnpj: string;
  cpf: string;
}) {
  return resultado(async () => {
    const { empresaId, a } = await exigirLogado();
    if (so(d.nome).length < 3) throw new Error("Informe o nome completo.");
    if (!/^\S+@\S+\.\S+$/.test(so(d.email))) throw new Error("E-mail inválido.");
    if (d.senha && d.senha.length < 8) throw new Error("A senha nova precisa ter ao menos 8 caracteres.");
    const cpf = digitos(d.cpf);
    const cnpj = digitos(d.cnpj);
    if (cpf && cpf.length !== 11) throw new Error("CPF inválido.");
    if (cnpj && cnpj.length !== 14) throw new Error("CNPJ inválido.");
    await acesso.atualizarMeusDados(empresaId, a, {
      nome: so(d.nome),
      email: so(d.email),
      telefone: digitos(d.telefone) || null,
      administradora: so(d.administradora) || null,
      cidade: so(d.cidade) || null,
      empresa: so(d.empresa) || null,
      cnpj: cnpj || null,
      cpf: cpf || null,
      senha: d.senha || null,
    });
    revalidatePath("/contempladas/painel");
    return {};
  });
}

export async function editarMembroAction(
  id: string,
  d: { nome: string; email: string; telefone: string; administradora: string; cidade: string; empresa: string; cnpj: string; cpf: string; papel: "GERENTE" | "VENDEDOR"; senha: string; pixTipo?: string; pixChave?: string; pixFavorecido?: string },
) {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    if (a.papel !== "DONO") throw new Error("Somente o dono do portal edita a equipe.");
    if (so(d.nome).length < 3) throw new Error("Informe o nome.");
    if (!/^\S+@\S+\.\S+$/.test(so(d.email))) throw new Error("E-mail inválido.");
    if (d.senha && d.senha.length < 8) throw new Error("A senha nova precisa ter ao menos 8 caracteres.");
    const cpf = digitos(d.cpf);
    const cnpj = digitos(d.cnpj);
    if (cpf && cpf.length !== 11) throw new Error("CPF inválido.");
    if (cnpj && cnpj.length !== 14) throw new Error("CNPJ inválido.");
    await acesso.editarMembro(empresaId, id, {
      nome: so(d.nome),
      email: so(d.email),
      telefone: digitos(d.telefone) || null,
      administradora: so(d.administradora) || null,
      cidade: so(d.cidade) || null,
      empresa: so(d.empresa) || null,
      cnpj: cnpj || null,
      cpf: cpf || null,
      papel: d.papel === "GERENTE" ? "GERENTE" : "VENDEDOR",
      senha: d.senha || null,
    });
    // PIX que aparece no Negociar das cotas deste administrador.
    if (d.pixChave !== undefined) {
      const auth = await acesso.authDoMembro(empresaId, id);
      const pix = validarPix(d.pixTipo ?? "CELULAR", d.pixChave ?? "");
      if (auth) await acesso.salvarPixMembro(empresaId, auth, { tipo: pix.chave_pix_tipo, chave: pix.chave_pix, favorecido: so(d.pixFavorecido) || null });
    }
    revalidatePath("/contempladas");
    revalidatePath("/contempladas/painel");
    return {};
  });
}

export async function listarLotesAction() {
  const { empresaId, a } = await exigirGerencia();
  return repo.listarLotes(empresaId, escopo(a));
}

export async function desfazerLoteAction(loteId: string) {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    const retiradas = await repo.desfazerLote(empresaId, loteId, escopo(a));
    revalidatePath("/contempladas");
    revalidatePath("/contempladas/painel");
    return { retiradas };
  });
}

/* ------------------------------- Comissões ------------------------------- */

export async function pagarComissaoAction(fd: FormData) {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    const comp = fd.get("comprovante");
    await repo.pagarComissao(empresaId, String(fd.get("id") ?? ""), a.authUserId, a.papel === "DONO", comp instanceof File ? comp : null);
    revalidatePath("/contempladas/painel");
    return {};
  });
}

export async function confirmarRecebimentoAction(id: string) {
  return resultado(async () => {
    const { empresaId, a } = await exigirLogado();
    await repo.confirmarRecebimento(empresaId, id, a.authUserId);
    revalidatePath("/contempladas/painel");
    return {};
  });
}
