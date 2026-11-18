"use server";

import { revalidatePath } from "next/cache";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerCotasTexto, type LinhaLida } from "@/lib/contempladas/parser";
import { buscarCombinacoes, valorAcrescimo, type Acrescimo, type Preferencia } from "@/lib/contempladas/motor";
import * as repo from "@/lib/contempladas/repo";
import * as acesso from "@/lib/contempladas/acesso";

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

/** Ágio do envio: o padrão configurado ou, se a gerência desmarcar, o informado na tela. */
async function agioDoEnvio(empresaId: string, personalizado: Acrescimo | null | undefined): Promise<Acrescimo> {
  if (personalizado) return acrescimoValido(personalizado);
  const cfg = await repo.getConfig(empresaId);
  return { tipo: cfg.agio_tipo, valor: cfg.agio_valor };
}

export async function preverEnvioAction(texto: string, personalizado: Acrescimo | null = null): Promise<LinhaLida[]> {
  const { empresaId } = await exigirGerencia();
  return lerCotasTexto(String(texto ?? ""), await agioDoEnvio(empresaId, personalizado));
}

/** Sobe as cotas já com o ágio configurado na entrada. */
export async function enviarCotasAction(texto: string, substituir: boolean, personalizado: Acrescimo | null = null) {
  return resultado(async () => {
    const { empresaId, a } = await exigirGerencia();
    const agio = await agioDoEnvio(empresaId, personalizado);
    const cotas = lerCotasTexto(String(texto ?? ""), agio).flatMap((l) => (l.cota ? [l.cota] : []));
    if (!cotas.length) throw new Error("Nenhuma cota válida no texto.");
    const { data: erp } = await createAdminClient({ noStore: true }).from("usuarios").select("id").eq("auth_user_id", a.authUserId).maybeSingle();
    const r = await repo.importarCotas({ empresaId, usuarioId: erp?.id ?? null, cotas, acrescimo: agio, substituir, texto });
    revalidatePath("/contempladas");
    return r;
  });
}

/* ------------------------------ Simulação ------------------------------ */

export async function simularAction(p: { credito: number; entradaMax: number | null; preferencia: Preferencia; maxCotas?: number }) {
  const empresaId = await empresa();
  const [todas, cfg, a] = await Promise.all([repo.listarCotas(empresaId), repo.getConfig(empresaId), acesso.getAcesso(empresaId)]);
  // Comissão só vai para quem está logado.
  const cotas = todas
    .filter((c) => c.status === "DISPONIVEL")
    .map((c) => ({ ...c, comissao_parceiro: a ? repo.comissaoVisivel(c, cfg) : 0 }));
  const credito = Math.max(0, Number(p.credito) || 0);
  const entradaMax = p.entradaMax ? Math.max(0, Number(p.entradaMax)) : null;
  const preferencia: Preferencia = p.preferencia === "MENOR_PRAZO" ? "MENOR_PRAZO" : "MENOR_PARCELA";
  await repo.registrarSimulacao(empresaId, credito, entradaMax, preferencia);
  return buscarCombinacoes(cotas, { credito, entradaMax, preferencia, maxCotas: p.maxCotas ?? 3 });
}

export async function gerarPropostaAction(p: { cotaIds: string[]; modo: string; desconto?: number; clienteNome?: string; clienteTelefone?: string }) {
  return resultado(async () => {
    const empresaId = await empresa();
    const [a, cfg] = await Promise.all([acesso.getAcesso(empresaId), repo.getConfig(empresaId)]);
    const cotas = await repo.cotasPorIds(empresaId, p.cotaIds);
    if (!cotas.length) throw new Error("Selecione ao menos uma cota.");
    if (cotas.some((c) => c.status !== "DISPONIVEL")) throw new Error("Uma das cotas não está mais disponível.");
    const credito = cotas.reduce((s, c) => s + c.credito, 0);
    const entradaBase = cotas.reduce((s, c) => s + c.entrada, 0);
    // Adicional fixo do vendedor entra sozinho; desconto só para quem está logado.
    const adicional = a ? valorAcrescimo(credito, a.adicional) : 0;
    const desconto = a ? Math.min(Math.max(0, Number(p.desconto) || 0), entradaBase + adicional) : 0;
    const comissao = a ? cotas.reduce((s, c) => s + repo.comissaoVisivel(c, cfg), 0) : 0;
    const modos = ["COMPLETA", "MENSAL", "SEMESTRAL", "ANUAL", "RESUMO"];
    const numero = await repo.salvarProposta({
      empresaId,
      usuarioId: null,
      vendedorAuthId: a?.authUserId ?? null,
      vendedorNome: a?.nome ?? null,
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
    const cfg = await repo.getConfig(empresaId);
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
      cotaIds: String(fd.get("cotaIds") ?? "").split(",").filter(Boolean),
      tipo,
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
  const { empresaId } = await exigirGerencia();
  await repo.decidirReserva(empresaId, reservaId, acao);
  revalidatePath("/contempladas/painel");
}

export async function statusCotaAction(cotaId: string, status: "DISPONIVEL" | "VENDIDA" | "INATIVA") {
  const { empresaId } = await exigirGerencia();
  await repo.mudarStatusCotas(empresaId, [cotaId], status);
  revalidatePath("/contempladas/painel");
}

export async function salvarConfigAction(c: repo.ConfigContempladas) {
  return resultado(async () => {
  const { empresaId } = await exigirGerencia();
  await repo.salvarConfig(empresaId, {
    pre_reserva_minutos: Math.min(10080, Math.max(5, Math.round(Number(c.pre_reserva_minutos) || 120))),
    whatsapp: c.whatsapp?.replace(/\D/g, "") || null,
    ...validarPix(c.chave_pix_tipo, c.chave_pix),
    favorecido_pix: c.favorecido_pix?.trim() || null,
    comissao_modo: c.comissao_modo === "PERCENTUAL" ? "PERCENTUAL" : "TABELA",
    comissao_percentual: Math.max(0, Number(c.comissao_percentual) || 0),
    comissao_repasse_percentual: Math.min(100, Math.max(0, Number(c.comissao_repasse_percentual) || 0)),
    agio_tipo: c.agio_tipo === "PERCENTUAL" ? "PERCENTUAL" : "FIXO",
    agio_valor: Math.max(0, Number(c.agio_valor) || 0),
  });
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

export async function salvarAdicionalAction(adicional: Acrescimo) {
  const { empresaId, a } = await exigirLogado();
  await acesso.salvarAdicional(empresaId, a, acrescimoValido(adicional));
  revalidatePath("/contempladas");
  revalidatePath("/contempladas/painel");
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
