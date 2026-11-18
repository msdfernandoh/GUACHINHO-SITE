import "server-only";

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CotaLida } from "./parser";
import type { Acrescimo, CotaMotor } from "./motor";

const db = () => createAdminClient({ noStore: true });

export const BUCKET_COMPROVANTES = "contempladas-comprovantes";

export type CotaPortal = CotaMotor & {
  status: "DISPONIVEL" | "RESERVADA" | "VENDIDA" | "INATIVA";
  entrada_original: number;
  entrada_acrescimo: number;
  preReservas: number;
  /** Fim da pré-reserva mais recente (relógio de escassez). */
  preReservaAte: string | null;
};

export type ConfigContempladas = {
  pre_reserva_minutos: number;
  whatsapp: string | null;
  chave_pix: string | null;
  chave_pix_tipo: "CELULAR" | "EMAIL" | "CPF" | "CNPJ" | "ALEATORIA";
  favorecido_pix: string | null;
  comissao_modo: "TABELA" | "PERCENTUAL";
  comissao_percentual: number;
  comissao_repasse_percentual: number;
  /** Ágio somado à entrada de toda cota que sobe para o portal. */
  agio_tipo: "PERCENTUAL" | "FIXO";
  agio_valor: number;
};

export const CONFIG_PADRAO: ConfigContempladas = {
  pre_reserva_minutos: 120,
  whatsapp: null,
  chave_pix: null,
  chave_pix_tipo: "CELULAR",
  favorecido_pix: null,
  comissao_modo: "TABELA",
  comissao_percentual: 0,
  comissao_repasse_percentual: 100,
  agio_tipo: "FIXO",
  agio_valor: 0,
};

const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function getConfig(empresaId: string): Promise<ConfigContempladas> {
  const { data } = await db().from("contempladas_config").select("*").eq("empresa_id", empresaId).maybeSingle();
  if (!data) return CONFIG_PADRAO;
  return {
    pre_reserva_minutos: data.pre_reserva_minutos,
    whatsapp: data.whatsapp,
    chave_pix: data.chave_pix,
    chave_pix_tipo: data.chave_pix_tipo ?? "CELULAR",
    favorecido_pix: data.favorecido_pix,
    comissao_modo: data.comissao_modo,
    comissao_percentual: num(data.comissao_percentual),
    comissao_repasse_percentual: num(data.comissao_repasse_percentual),
    agio_tipo: data.agio_tipo === "PERCENTUAL" ? "PERCENTUAL" : "FIXO",
    agio_valor: num(data.agio_valor),
  };
}

export async function salvarConfig(empresaId: string, c: ConfigContempladas) {
  const { error } = await db()
    .from("contempladas_config")
    .upsert({ empresa_id: empresaId, ...c, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Não foi possível salvar: ${error.message}`);
}

/** Comissão que o usuário logado enxerga, conforme a regra do dono do portal. */
export function comissaoVisivel(c: { credito: number; comissao_parceiro: number }, cfg: ConfigContempladas) {
  const base = cfg.comissao_modo === "PERCENTUAL" ? (c.credito * cfg.comissao_percentual) / 100 : c.comissao_parceiro;
  return Math.round(base * cfg.comissao_repasse_percentual) / 100;
}

/** Expira pré-reservas vencidas (não bloqueiam cota, só somem do contador). */
async function expirarPreReservas(empresaId: string) {
  await db()
    .from("contempladas_reservas")
    .update({ status: "EXPIRADA" })
    .eq("empresa_id", empresaId)
    .eq("tipo", "PRE")
    .eq("status", "ATIVA")
    .lt("expira_em", new Date().toISOString());
}

export async function listarCotas(empresaId: string, opts: { incluirVendidas?: boolean } = {}): Promise<CotaPortal[]> {
  await expirarPreReservas(empresaId);
  let q = db()
    .from("contempladas_cotas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("credito", { ascending: true });
  q = opts.incluirVendidas ? q.neq("status", "INATIVA") : q.in("status", ["DISPONIVEL", "RESERVADA"]);
  const [{ data: cotas }, { data: pres }] = await Promise.all([
    q,
    db().from("contempladas_reservas").select("cota_ids,expira_em").eq("empresa_id", empresaId).eq("tipo", "PRE").eq("status", "ATIVA"),
  ]);
  const contagem = new Map<string, number>();
  const ate = new Map<string, string>();
  for (const r of pres ?? [])
    for (const id of r.cota_ids as string[]) {
      contagem.set(id, (contagem.get(id) ?? 0) + 1);
      if (r.expira_em && (!ate.get(id) || r.expira_em > ate.get(id)!)) ate.set(id, r.expira_em);
    }
  return (cotas ?? []).map((c) => ({
    id: c.id,
    codigo: c.codigo,
    administradora: c.administradora,
    tipo: c.tipo,
    credito: num(c.credito),
    entrada: num(c.entrada),
    entrada_original: num(c.entrada_original),
    entrada_acrescimo: num(c.entrada_acrescimo),
    prazo: c.prazo,
    parcela: num(c.parcela),
    saldo_devedor: num(c.saldo_devedor),
    vencimento_mes: c.vencimento_mes,
    comissao_parceiro: num(c.comissao_parceiro),
    status: c.status,
    preReservas: contagem.get(c.id) ?? 0,
    preReservaAte: ate.get(c.id) ?? null,
  }));
}

export async function estatisticas(empresaId: string) {
  const agora = new Date().toISOString();
  const [sim, pre, pix, vend] = await Promise.all([
    db().from("contempladas_simulacoes").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId),
    db().from("contempladas_reservas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("tipo", "PRE").eq("status", "ATIVA").gt("expira_em", agora),
    db().from("contempladas_reservas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("tipo", "PIX").eq("status", "ATIVA"),
    db().from("contempladas_cotas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("status", "VENDIDA"),
  ]);
  return { simulacoes: sim.count ?? 0, preReservas: pre.count ?? 0, reservasPix: pix.count ?? 0, vendidas: vend.count ?? 0 };
}

function codigoCota() {
  return `CT-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function importarCotas(params: {
  empresaId: string;
  usuarioId: string;
  cotas: CotaLida[];
  acrescimo: Acrescimo;
  substituir: boolean;
  texto: string;
}) {
  const { data: lote, error: loteErr } = await db()
    .from("contempladas_lotes")
    .insert({
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      acrescimo_tipo: params.acrescimo.tipo,
      acrescimo_valor: params.acrescimo.valor,
      substituiu: params.substituir,
      quantidade: params.cotas.length,
      texto_original: params.texto.slice(0, 50000),
    })
    .select("id")
    .single();
  if (loteErr) throw new Error(`Não foi possível registrar o envio: ${loteErr.message}`);

  let anteriores: string[] = [];
  if (params.substituir) {
    const { data } = await db().from("contempladas_cotas").select("id").eq("empresa_id", params.empresaId).eq("status", "DISPONIVEL");
    anteriores = (data ?? []).map((c) => c.id);
  }

  const linhas = params.cotas.map((c) => ({ ...c, empresa_id: params.empresaId, lote_id: lote.id, codigo: codigoCota(), status: "DISPONIVEL" }));
  const { data: ins, error } = await db().from("contempladas_cotas").insert(linhas).select("id");
  if (error) throw new Error(`Não foi possível gravar as cotas: ${error.message}`);

  // Só inativa as disponíveis antigas depois que as novas entraram. Reservadas e vendidas ficam.
  if (anteriores.length) {
    await db().from("contempladas_cotas").update({ status: "INATIVA", updated_at: new Date().toISOString() }).in("id", anteriores);
  }
  return { incluidas: ins?.length ?? 0, inativadas: anteriores.length };
}

export async function registrarSimulacao(empresaId: string, credito: number, entradaMax: number | null, preferencia: string) {
  await db().from("contempladas_simulacoes").insert({ empresa_id: empresaId, credito, entrada_max: entradaMax, preferencia });
}

export async function cotasPorIds(empresaId: string, ids: string[]) {
  const todas = await listarCotas(empresaId, { incluirVendidas: true });
  return todas.filter((c) => ids.includes(c.id));
}

export async function salvarProposta(p: {
  empresaId: string;
  usuarioId: string | null;
  vendedorAuthId: string | null;
  vendedorNome: string | null;
  vendedorTelefone: string | null;
  vendedorLogo: string | null;
  adicional: number;
  desconto: number;
  comissao: number;
  cotas: CotaPortal[];
  acrescimo: Acrescimo | null;
  modo: string;
  clienteNome: string | null;
  clienteTelefone: string | null;
}) {
  const soma = (k: "credito" | "entrada" | "saldo_devedor") => p.cotas.reduce((s, c) => s + c[k], 0);
  const { data, error } = await db()
    .from("contempladas_propostas")
    .insert({
      empresa_id: p.empresaId,
      usuario_id: p.usuarioId,
      cliente_nome: p.clienteNome,
      cliente_telefone: p.clienteTelefone,
      cota_ids: p.cotas.map((c) => c.id),
      cotas_snapshot: p.cotas,
      acrescimo_tipo: p.acrescimo?.valor ? p.acrescimo.tipo : null,
      acrescimo_valor: p.acrescimo?.valor ?? 0,
      modo_simulacao: p.modo,
      vendedor_auth_id: p.vendedorAuthId,
      vendedor_nome: p.vendedorNome,
      vendedor_telefone: p.vendedorTelefone,
      vendedor_logo_url: p.vendedorLogo,
      adicional_valor: p.adicional,
      desconto_valor: p.desconto,
      comissao_valor: p.comissao,
      credito_total: soma("credito"),
      entrada_total: soma("entrada") + p.adicional - p.desconto,
      saldo_total: soma("saldo_devedor"),
    })
    .select("numero")
    .single();
  if (error) throw new Error(`Não foi possível gerar a proposta: ${error.message}`);
  return Number(data.numero);
}

export async function obterProposta(empresaId: string, numero: number) {
  const { data } = await db()
    .from("contempladas_propostas")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("numero", numero)
    .maybeSingle();
  if (!data) return null;
  const { data: atuais } = await db().from("contempladas_cotas").select("id,status").in("id", data.cota_ids as string[]);
  const status = new Map((atuais ?? []).map((c) => [c.id, c.status as string]));
  return {
    numero: Number(data.numero),
    id: data.id as string,
    criadaEm: data.created_at as string,
    clienteNome: data.cliente_nome as string | null,
    clienteTelefone: data.cliente_telefone as string | null,
    modo: data.modo_simulacao as string,
    usuarioId: data.usuario_id as string | null,
    adicional: num(data.adicional_valor) || (data.acrescimo_tipo ? num(data.acrescimo_valor) : 0),
    desconto: num(data.desconto_valor),
    vendedorAuthId: data.vendedor_auth_id as string | null,
    vendedorNome: data.vendedor_nome as string | null,
    vendedorTelefone: data.vendedor_telefone as string | null,
    vendedorLogo: data.vendedor_logo_url as string | null,
    cotas: (data.cotas_snapshot as CotaPortal[]).map((c) => ({ ...c, status: (status.get(c.id) ?? "INATIVA") as CotaPortal["status"] })),
  };
}

export async function criarReserva(r: {
  empresaId: string;
  usuarioId: string | null;
  propostaId: string | null;
  cotaIds: string[];
  tipo: "PRE" | "PIX";
  nome: string;
  telefone: string;
  comprovante?: File | null;
  minutos: number;
}) {
  if (r.tipo === "PIX") {
    // Bloqueia só se todas ainda estiverem disponíveis.
    const { data: livres } = await db()
      .from("contempladas_cotas")
      .select("id")
      .eq("empresa_id", r.empresaId)
      .in("id", r.cotaIds)
      .eq("status", "DISPONIVEL");
    if ((livres ?? []).length !== r.cotaIds.length) throw new Error("Alguma cota já foi reservada ou vendida. Refaça a simulação.");
  }
  let path: string | null = null;
  if (r.comprovante && r.comprovante.size) {
    if (r.comprovante.size > 8 * 1024 * 1024) throw new Error("Comprovante acima de 8 MB.");
    const ext = (r.comprovante.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    path = `${r.empresaId}/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
    const { error } = await db().storage.from(BUCKET_COMPROVANTES).upload(path, r.comprovante, { contentType: r.comprovante.type });
    if (error) throw new Error(`Falha ao enviar comprovante: ${error.message}`);
  }
  const expira = r.tipo === "PRE" ? new Date(Date.now() + r.minutos * 60000).toISOString() : null;
  const { error } = await db().from("contempladas_reservas").insert({
    empresa_id: r.empresaId,
    usuario_id: r.usuarioId,
    proposta_id: r.propostaId,
    cota_ids: r.cotaIds,
    tipo: r.tipo,
    nome: r.nome,
    telefone: r.telefone,
    comprovante_path: path,
    expira_em: expira,
  });
  if (error) throw new Error(`Não foi possível reservar: ${error.message}`);
  if (r.tipo === "PIX") {
    await db()
      .from("contempladas_cotas")
      .update({ status: "RESERVADA", updated_at: new Date().toISOString() })
      .eq("empresa_id", r.empresaId)
      .in("id", r.cotaIds)
      .eq("status", "DISPONIVEL");
  }
  return { expira };
}

export async function listarReservas(empresaId: string) {
  await expirarPreReservas(empresaId);
  const { data } = await db()
    .from("contempladas_reservas")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("status", "ATIVA")
    .order("created_at", { ascending: false })
    .limit(200);
  const linhas = data ?? [];
  return Promise.all(
    linhas.map(async (r) => {
      let comprovanteUrl: string | null = null;
      if (r.comprovante_path) {
        const { data: s } = await db().storage.from(BUCKET_COMPROVANTES).createSignedUrl(r.comprovante_path, 3600);
        comprovanteUrl = s?.signedUrl ?? null;
      }
      return {
        id: r.id as string,
        tipo: r.tipo as "PRE" | "PIX",
        nome: r.nome as string,
        telefone: r.telefone as string,
        cotaIds: r.cota_ids as string[],
        expiraEm: r.expira_em as string | null,
        criadaEm: r.created_at as string,
        comprovanteUrl,
      };
    }),
  );
}

export async function decidirReserva(empresaId: string, reservaId: string, acao: "VENDIDA" | "CANCELAR") {
  const { data: r } = await db().from("contempladas_reservas").select("*").eq("empresa_id", empresaId).eq("id", reservaId).maybeSingle();
  if (!r) throw new Error("Reserva não encontrada.");
  await db().from("contempladas_reservas").update({ status: acao === "VENDIDA" ? "CONFIRMADA" : "CANCELADA" }).eq("id", reservaId);
  if (acao === "VENDIDA") await mudarStatusCotas(empresaId, r.cota_ids, "VENDIDA");
  else if (r.tipo === "PIX") await mudarStatusCotas(empresaId, r.cota_ids, "DISPONIVEL");
}

export async function mudarStatusCotas(empresaId: string, ids: string[], status: CotaPortal["status"]) {
  const { error } = await db()
    .from("contempladas_cotas")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("empresa_id", empresaId)
    .in("id", ids);
  if (error) throw new Error(error.message);
}

export async function listarUsuariosEnvio(empresaId: string) {
  const { data: vinc } = await db().from("empresa_usuarios").select("usuario_id").eq("empresa_id", empresaId);
  const ids = (vinc ?? []).map((v) => v.usuario_id as string);
  if (!ids.length) return [];
  const { data } = await db()
    .from("usuarios")
    .select("id,nome,email,perfil,contempladas_pode_enviar")
    .in("id", ids)
    .eq("ativo", true)
    .order("nome");
  return (data ?? []) as { id: string; nome: string; email: string; perfil: string; contempladas_pode_enviar: boolean }[];
}

export async function definirPermissaoEnvio(usuarioId: string, pode: boolean) {
  const { error } = await db().from("usuarios").update({ contempladas_pode_enviar: pode }).eq("id", usuarioId);
  if (error) throw new Error(error.message);
}

export async function usuarioPodeEnviar(usuarioId: string, perfil: string) {
  if (perfil === "master") return true;
  const { data } = await db().from("usuarios").select("contempladas_pode_enviar").eq("id", usuarioId).maybeSingle();
  return Boolean(data?.contempladas_pode_enviar);
}

/** Propostas de um vendedor (ou todas, para gerência) com rentabilidade e status das cotas. */
export async function listarPropostasVendedor(empresaId: string, vendedorAuthId: string | null) {
  let q = db()
    .from("contempladas_propostas")
    .select("id,numero,cliente_nome,vendedor_nome,cota_ids,credito_total,entrada_total,adicional_valor,desconto_valor,comissao_valor,created_at")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (vendedorAuthId) q = q.eq("vendedor_auth_id", vendedorAuthId);
  const { data } = await q;
  const linhas = data ?? [];
  const ids = [...new Set(linhas.flatMap((l) => l.cota_ids as string[]))];
  const { data: st } = ids.length ? await db().from("contempladas_cotas").select("id,status").in("id", ids) : { data: [] };
  const status = new Map((st ?? []).map((c) => [c.id, c.status as string]));
  return linhas.map((l) => {
    const sts = (l.cota_ids as string[]).map((id) => status.get(id) ?? "INATIVA");
    const rent = num(l.comissao_valor) + num(l.adicional_valor) - num(l.desconto_valor);
    return {
      numero: Number(l.numero),
      cliente: l.cliente_nome as string | null,
      vendedor: l.vendedor_nome as string | null,
      credito: num(l.credito_total),
      entrada: num(l.entrada_total),
      desconto: num(l.desconto_valor),
      rentabilidade: Math.round(rent * 100) / 100,
      vendida: sts.length > 0 && sts.every((s) => s === "VENDIDA"),
      criadaEm: l.created_at as string,
    };
  });
}
