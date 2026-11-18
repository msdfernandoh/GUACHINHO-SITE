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
  if (!g) throw new Error("Gerente não encontrado.");
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

export async function preverEnvioAction(texto: string, personalizado: Acrescimo | null = null, gerenteId: string | null = null): Promise<LinhaLida[]> {
  const { empresaId, a } = await exigirGerencia();
  return lerCotasTexto(String(texto ?? ""), await agioDoEnvio(empresaId, a, personalizado, gerenteId));
}

/** Sobe as cotas com o ágio do gerente na entrada; as cotas ficam no nome dele. */
export async function enviarCotasAction(texto: string, substituir: boolean, personalizado: Acrescimo | null = null, gerenteId: string | null = null) {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    const dono = await donoDoEnvio(empresaId, a, gerenteId);
    const agio = await agioDoEnvio(empresaId, a, personalizado, gerenteId);
    const cotas = lerCotasTexto(String(texto ?? ""), agio).flatMap((l) => (l.cota ? [l.cota] : []));
    if (!cotas.length) throw new Error("Nenhuma cota válida no texto.");
    const { data: erp } = await createAdminClient({ noStore: true }).from("usuarios").select("id").eq("auth_user_id", a.authUserId).maybeSingle();
    const r = await repo.importarCotas({
      empresaId,
      usuarioId: erp?.id ?? null,
      cotas,
      acrescimo: agio("imovel"),
      substituir,
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
  await repo.decidirReserva(empresaId, reservaId, acao, escopo(a));
  revalidatePath("/contempladas/painel");
}

export async function statusCotaAction(cotaId: string, status: "DISPONIVEL" | "VENDIDA" | "INATIVA") {
  const { empresaId, a } = await exigirGerencia();
  await repo.mudarStatusCotas(empresaId, [cotaId], status, escopo(a));
  revalidatePath("/contempladas/painel");
}

export async function salvarConfigAction(c: repo.ConfigContempladas) {
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
      unidade: c.unidade?.trim() || null,
    };
    if (a.papel === "DONO") await repo.salvarConfig(empresaId, limpo);
    else await repo.salvarConfigGerente(empresaId, a.authUserId, limpo);
    revalidatePath("/contempladas");
    revalidatePath("/contempladas/painel");
    return {};
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
    if (!convite) throw new Error("Link expirado ou inválido. Peça um novo ao gerente.");
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
