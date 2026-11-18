"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerCotasTexto, type LinhaLida } from "@/lib/contempladas/parser";
import { buscarCombinacoes, type Acrescimo, type Preferencia } from "@/lib/contempladas/motor";
import * as repo from "@/lib/contempladas/repo";

async function empresa() {
  const t = await getResolvedTenant();
  if (!t) throw new Error("Site não configurado.");
  return t.empresaId;
}

async function exigirMaster() {
  const u = await getUsuarioNegocio();
  if (!u || u.perfil !== "master") throw new Error("Somente o dono do portal.");
  return u;
}

const acrescimoValido = (a: Acrescimo | null | undefined): Acrescimo => ({
  tipo: a?.tipo === "FIXO" ? "FIXO" : "PERCENTUAL",
  valor: Math.max(0, Number(a?.valor) || 0),
});

/* ------------------------------- Envio ------------------------------- */

export async function preverEnvioAction(texto: string, acrescimo: Acrescimo): Promise<LinhaLida[]> {
  return lerCotasTexto(String(texto ?? ""), acrescimoValido(acrescimo));
}

export async function enviarCotasAction(texto: string, acrescimo: Acrescimo, substituir: boolean) {
  try {
    const u = await getUsuarioNegocio();
    if (!u) return { ok: false as const, erro: "Faça login para enviar." };
    if (!(await repo.usuarioPodeEnviar(u.id, u.perfil)))
      return { ok: false as const, erro: "Seu usuário não tem autorização de envio no ERP." };
    const a = acrescimoValido(acrescimo);
    const cotas = lerCotasTexto(String(texto ?? ""), a).flatMap((l) => (l.cota ? [l.cota] : []));
    if (!cotas.length) return { ok: false as const, erro: "Nenhuma cota válida no texto." };
    const r = await repo.importarCotas({ empresaId: await empresa(), usuarioId: u.id, cotas, acrescimo: a, substituir, texto });
    revalidatePath("/contempladas");
    return { ok: true as const, ...r };
  } catch (e) {
    return { ok: false as const, erro: e instanceof Error ? e.message : "Erro ao enviar." };
  }
}

/* ------------------------------ Simulação ------------------------------ */

export async function simularAction(p: { credito: number; entradaMax: number | null; preferencia: Preferencia; maxCotas?: number }) {
  const empresaId = await empresa();
  const [todas, cfg, u] = await Promise.all([repo.listarCotas(empresaId), repo.getConfig(empresaId), getUsuarioNegocio()]);
  // Comissão só aparece para usuário logado.
  const cotas = todas
    .filter((c) => c.status === "DISPONIVEL")
    .map((c) => ({ ...c, comissao_parceiro: u ? repo.comissaoVisivel(c, cfg) : 0 }));
  const credito = Math.max(0, Number(p.credito) || 0);
  const entradaMax = p.entradaMax ? Math.max(0, Number(p.entradaMax)) : null;
  const preferencia: Preferencia = p.preferencia === "MENOR_PRAZO" ? "MENOR_PRAZO" : "MENOR_PARCELA";
  await repo.registrarSimulacao(empresaId, credito, entradaMax, preferencia);
  const r = buscarCombinacoes(cotas, { credito, entradaMax, preferencia, maxCotas: p.maxCotas ?? 3 });
  return { ...r, ids: r.proximas.map((c) => c.cotas.map((x) => x.id)) };
}

export async function gerarPropostaAction(p: {
  cotaIds: string[];
  modo: string;
  acrescimo: Acrescimo | null;
  clienteNome?: string;
  clienteTelefone?: string;
}) {
  try {
    const empresaId = await empresa();
    const u = await getUsuarioNegocio();
    const cotas = await repo.cotasPorIds(empresaId, p.cotaIds);
    if (!cotas.length) throw new Error("Selecione ao menos uma cota.");
    if (cotas.some((c) => c.status !== "DISPONIVEL")) throw new Error("Uma das cotas não está mais disponível.");
    const modos = ["COMPLETA", "MENSAL", "SEMESTRAL", "ANUAL", "RESUMO"];
    const numero = await repo.salvarProposta({
      empresaId,
      usuarioId: u?.id ?? null,
      cotas,
      // Acréscimo de comissão só vale para usuário logado.
      acrescimo: u ? acrescimoValido(p.acrescimo) : null,
      modo: modos.includes(p.modo) ? p.modo : "COMPLETA",
      clienteNome: p.clienteNome?.trim() || null,
      clienteTelefone: p.clienteTelefone?.replace(/\D/g, "") || null,
    });
    return { ok: true as const, numero };
  } catch (e) {
    return { ok: false as const, erro: e instanceof Error ? e.message : "Erro." };
  }
}

/* ------------------------------- Reservas ------------------------------- */

export async function reservarAction(fd: FormData) {
  try {
    const empresaId = await empresa();
    const u = await getUsuarioNegocio();
    const cfg = await repo.getConfig(empresaId);
    const tipo = fd.get("tipo") === "PIX" ? "PIX" : "PRE";
    const nome = String(fd.get("nome") ?? "").trim();
    const telefone = String(fd.get("telefone") ?? "").replace(/\D/g, "");
    if (nome.length < 3 || telefone.length < 10) throw new Error("Informe nome e WhatsApp.");
    const comprovante = fd.get("comprovante");
    if (tipo === "PIX" && !(comprovante instanceof File && comprovante.size)) throw new Error("Anexe o comprovante do PIX.");
    const r = await repo.criarReserva({
      empresaId,
      usuarioId: u?.id ?? null,
      propostaId: (fd.get("propostaId") as string) || null,
      cotaIds: String(fd.get("cotaIds") ?? "").split(",").filter(Boolean),
      tipo,
      nome,
      telefone,
      comprovante: comprovante instanceof File ? comprovante : null,
      minutos: cfg.pre_reserva_minutos,
    });
    revalidatePath("/contempladas");
    return { ok: true as const, ...r };
  } catch (e) {
    return { ok: false as const, erro: e instanceof Error ? e.message : "Erro." };
  }
}

/* -------------------------------- Painel -------------------------------- */

async function exigirLogado() {
  const u = await getUsuarioNegocio();
  if (!u) throw new Error("Faça login.");
  return u;
}

export async function decidirReservaAction(reservaId: string, acao: "VENDIDA" | "CANCELAR") {
  await exigirLogado();
  await repo.decidirReserva(await empresa(), reservaId, acao);
  revalidatePath("/contempladas/painel");
}

export async function statusCotaAction(cotaId: string, status: "DISPONIVEL" | "VENDIDA" | "INATIVA") {
  await exigirLogado();
  await repo.mudarStatusCotas(await empresa(), [cotaId], status);
  revalidatePath("/contempladas/painel");
}

export async function salvarConfigAction(c: repo.ConfigContempladas) {
  await exigirMaster();
  await repo.salvarConfig(await empresa(), {
    pre_reserva_minutos: Math.min(10080, Math.max(5, Math.round(Number(c.pre_reserva_minutos) || 120))),
    whatsapp: c.whatsapp?.replace(/\D/g, "") || null,
    chave_pix: c.chave_pix?.trim() || null,
    favorecido_pix: c.favorecido_pix?.trim() || null,
    comissao_modo: c.comissao_modo === "PERCENTUAL" ? "PERCENTUAL" : "TABELA",
    comissao_percentual: Math.max(0, Number(c.comissao_percentual) || 0),
    comissao_repasse_percentual: Math.min(100, Math.max(0, Number(c.comissao_repasse_percentual) || 0)),
  });
  revalidatePath("/contempladas/painel");
}

export async function permissaoEnvioAction(usuarioId: string, pode: boolean) {
  await exigirMaster();
  const empresaId = await empresa();
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
