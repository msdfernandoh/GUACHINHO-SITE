import "server-only";
import { colaboracaoDoVendedor } from "@/lib/contempladas/acesso";

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
  comissao_fixada: boolean;
  /** Taxa de transferência da própria cota (lida no envio); null = padrão da unidade. */
  transferencia: number | null;
  /** Gerente que subiu a cota (null = dono do portal). */
  dono_auth_id: string | null;
  dono_nome: string | null;
  vendida_em: string | null;
  /** Última vez que a cota entrou ou foi confirmada numa tabela enviada. */
  atualizada_em: string | null;
  vendedor_nome: string | null;
  vendida_por_nome: string | null;
  exclusao_solicitada_em: string | null;
  exclusao_solicitada_por: string | null;
  exclusao_motivo: string | null;
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
  /** Ágio somado à entrada de toda cota de imóvel que sobe. */
  agio_tipo: "PERCENTUAL" | "FIXO";
  agio_valor: number;
  /** Ágio das cotas de veículo. */
  agio_auto_tipo: "PERCENTUAL" | "FIXO";
  agio_auto_valor: number;
  /** Sinal (PIX) que bloqueia a negociação; 0 = entrada inteira. */
  sinal_imovel: number;
  sinal_auto: number;
  /** Taxa de transferência padrão por cota (quando a cota não traz a dela). */
  transferencia_imovel: number;
  transferencia_auto: number;
  /** Dia de vencimento usado nas mensagens (ex.: 10/12). */
  dia_vencimento: number;
  /** Nome da unidade do gerente (vazio no padrão da empresa). */
  unidade?: string | null;
};

export const CONFIG_PADRAO: ConfigContempladas = {
  pre_reserva_minutos: 30,
  whatsapp: null,
  chave_pix: null,
  chave_pix_tipo: "CELULAR",
  favorecido_pix: null,
  comissao_modo: "TABELA",
  comissao_percentual: 0,
  comissao_repasse_percentual: 100,
  agio_tipo: "FIXO",
  agio_valor: 0,
  agio_auto_tipo: "FIXO",
  agio_auto_valor: 0,
  sinal_imovel: 0,
  sinal_auto: 0,
  transferencia_imovel: 0,
  transferencia_auto: 0,
  dia_vencimento: 10,
};

const num = (v: unknown) => (v == null ? 0 : Number(v));

type Linha = Record<string, unknown>;
function lerConfig(data: Linha, minutos: number): ConfigContempladas {
  return {
    pre_reserva_minutos: minutos,
    whatsapp: (data.whatsapp as string) ?? null,
    chave_pix: (data.chave_pix as string) ?? null,
    chave_pix_tipo: ((data.chave_pix_tipo as string) ?? "CELULAR") as ConfigContempladas["chave_pix_tipo"],
    favorecido_pix: (data.favorecido_pix as string) ?? null,
    comissao_modo: data.comissao_modo === "PERCENTUAL" ? "PERCENTUAL" : "TABELA",
    comissao_percentual: num(data.comissao_percentual),
    comissao_repasse_percentual: data.comissao_repasse_percentual == null ? 100 : num(data.comissao_repasse_percentual),
    agio_tipo: data.agio_tipo === "PERCENTUAL" ? "PERCENTUAL" : "FIXO",
    agio_valor: num(data.agio_valor),
    agio_auto_tipo: data.agio_auto_tipo === "PERCENTUAL" ? "PERCENTUAL" : "FIXO",
    agio_auto_valor: num(data.agio_auto_valor),
    sinal_imovel: num(data.sinal_imovel),
    sinal_auto: num(data.sinal_auto),
    transferencia_imovel: num(data.transferencia_imovel),
    transferencia_auto: num(data.transferencia_auto),
    dia_vencimento: Number(data.dia_vencimento) || 10,
    unidade: (data.unidade as string) ?? null,
  };
}

/** Padrão da empresa (dono do portal e cotas sem gerente). */
export async function getConfig(empresaId: string): Promise<ConfigContempladas> {
  const { data } = await db().from("contempladas_config").select("*").eq("empresa_id", empresaId).maybeSingle();
  if (!data) return CONFIG_PADRAO;
  return lerConfig(data, data.pre_reserva_minutos);
}

export async function salvarConfig(empresaId: string, c: ConfigContempladas) {
  const { unidade: _u, ...resto } = c;
  void _u;
  const { error } = await db()
    .from("contempladas_config")
    .upsert({ empresa_id: empresaId, ...resto, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Não foi possível salvar: ${error.message}`);
}

/** Configuração da unidade de um gerente; sem cadastro próprio, usa o padrão da empresa. */
export async function getConfigGerente(empresaId: string, authUserId: string | null): Promise<ConfigContempladas> {
  const padrao = await getConfig(empresaId);
  if (!authUserId) return padrao;
  const { data } = await db().from("contempladas_gerente_config").select("*").eq("empresa_id", empresaId).eq("auth_user_id", authUserId).maybeSingle();
  // Sem configuração própria: usa contatos/PIX do padrão, mas sem ágio (ágio é opcional e de cada administrador).
  return data
    ? lerConfig(data, padrao.pre_reserva_minutos)
    : { ...padrao, unidade: null, agio_tipo: "FIXO", agio_valor: 0, agio_auto_tipo: "FIXO", agio_auto_valor: 0 };
}

export async function salvarConfigGerente(empresaId: string, authUserId: string, c: ConfigContempladas) {
  const { pre_reserva_minutos: _m, ...resto } = c;
  void _m;
  const { error } = await db()
    .from("contempladas_gerente_config")
    .upsert({ empresa_id: empresaId, auth_user_id: authUserId, ...resto, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Não foi possível salvar: ${error.message}`);
}

/** Todas as configurações por dono da cota ("" = padrão da empresa). */
export async function configsPorDono(empresaId: string) {
  const padrao = await getConfig(empresaId);
  const { data } = await db().from("contempladas_gerente_config").select("*").eq("empresa_id", empresaId);
  const mapa = new Map<string, ConfigContempladas>([["", padrao]]);
  for (const l of data ?? []) {
    const c = lerConfig(l, padrao.pre_reserva_minutos);
    // Unidade sem WhatsApp/PIX próprio usa os do padrão da empresa.
    if (!c.whatsapp) c.whatsapp = padrao.whatsapp;
    if (!c.chave_pix) Object.assign(c, { chave_pix: padrao.chave_pix, chave_pix_tipo: padrao.chave_pix_tipo, favorecido_pix: padrao.favorecido_pix });
    mapa.set(l.auth_user_id as string, c);
  }
  return { padrao, de: (dono: string | null) => (dono && mapa.get(dono)) || padrao };
}

/** Comissão que o usuário logado enxerga, conforme a regra do dono do portal. */
export function comissaoVisivel(c: { credito: number; comissao_parceiro: number; comissao_fixada?: boolean }, cfg: ConfigContempladas) {
  // Comissão definida no envio do lote vale como está para a revenda.
  if (c.comissao_fixada) return c.comissao_parceiro;
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

/** Escopo de gerência: undefined = todas (dono do portal); string = só as cotas desse gerente. */
export type Escopo = string | undefined;

export async function listarCotas(empresaId: string, opts: { incluirVendidas?: boolean; dono?: Escopo; vendidasRecentesDias?: number } = {}): Promise<CotaPortal[]> {
  await expirarPreReservas(empresaId);
  let q = db()
    .from("contempladas_cotas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("credito", { ascending: true });
  if (opts.vendidasRecentesDias) {
    // Portal público: disponíveis, em análise e vendidas dos últimos dias.
    const desde = new Date(Date.now() - opts.vendidasRecentesDias * 86400000).toISOString();
    q = q.or(`status.in.(DISPONIVEL,RESERVADA),and(status.eq.VENDIDA,vendida_em.gte.${desde})`);
  } else q = opts.incluirVendidas ? q.neq("status", "INATIVA") : q.in("status", ["DISPONIVEL", "RESERVADA"]);
  if (opts.dono) q = q.eq("dono_auth_id", opts.dono);
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
    comissao_fixada: Boolean(c.comissao_fixada),
    transferencia: c.transferencia == null ? null : num(c.transferencia),
    status: c.status,
    preReservas: contagem.get(c.id) ?? 0,
    preReservaAte: ate.get(c.id) ?? null,
    dono_auth_id: c.dono_auth_id ?? null,
    dono_nome: c.dono_nome ?? null,
    vendida_em: c.vendida_em ?? null,
    atualizada_em: c.updated_at ?? c.created_at ?? null,
    vendedor_nome: c.vendedor_nome ?? null,
    vendida_por_nome: c.vendida_por_nome ?? null,
    exclusao_solicitada_em: c.exclusao_solicitada_em ?? null,
    exclusao_solicitada_por: c.exclusao_solicitada_por ?? null,
    exclusao_motivo: c.exclusao_motivo ?? null,
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
  donoAuthId: string;
  donoNome: string;
  /** Dono do portal também substitui as cotas antigas sem gerente. */
  incluirSemDono: boolean;
  /** Comissão da revenda definida neste envio (sobrepõe a da tabela). */
  comissaoLote?: Acrescimo | null;
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
      dono_auth_id: params.donoAuthId,
      dono_nome: params.donoNome,
    })
    .select("id")
    .single();
  if (loteErr) throw new Error(`Não foi possível registrar o envio: ${loteErr.message}`);

  let anteriores: string[] = [];
  if (params.substituir) {
    // Substitui só as cotas do próprio gerente.
    const { data } = await db()
      .from("contempladas_cotas")
      .select("id")
      .eq("empresa_id", params.empresaId)
      .eq("status", "DISPONIVEL")
      .or(`dono_auth_id.eq.${params.donoAuthId}${params.incluirSemDono ? ",dono_auth_id.is.null" : ""}`);
    anteriores = (data ?? []).map((c) => c.id);
  }

  const linhas = params.cotas.map((c) => ({
    ...c,
    empresa_id: params.empresaId,
    lote_id: lote.id,
    codigo: codigoCota(),
    status: "DISPONIVEL",
    dono_auth_id: params.donoAuthId,
    dono_nome: params.donoNome,
    ...(params.comissaoLote
      ? {
          comissao_parceiro:
            Math.round((params.comissaoLote.tipo === "PERCENTUAL" ? (c.credito * params.comissaoLote.valor) / 100 : params.comissaoLote.valor) * 100) / 100,
          comissao_fixada: true,
        }
      : {}),
  }));
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
  valorPix?: number | null;
  nome: string;
  telefone: string;
  comprovante?: File | null;
  minutos: number;
}) {
  const { data: donos } = await db().from("contempladas_cotas").select("dono_auth_id").eq("empresa_id", r.empresaId).in("id", r.cotaIds);
  const setDonos = new Set((donos ?? []).map((d) => d.dono_auth_id ?? ""));
  if (setDonos.size > 1) throw new Error("Essas cotas são de unidades diferentes. Negocie cada unidade separadamente.");
  const donoAuthId = [...setDonos][0] || null;
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
    dono_auth_id: donoAuthId,
    valor_pix: r.tipo === "PIX" ? (r.valorPix ?? null) : null,
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

export async function listarReservas(empresaId: string, dono?: Escopo) {
  await expirarPreReservas(empresaId);
  let q = db()
    .from("contempladas_reservas")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("status", "ATIVA")
    .order("created_at", { ascending: false })
    .limit(200);
  if (dono) q = q.eq("dono_auth_id", dono);
  const { data } = await q;
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
        valorPix: r.valor_pix == null ? null : num(r.valor_pix),
        comprovanteUrl,
      };
    }),
  );
}

export async function decidirReserva(empresaId: string, reservaId: string, acao: "VENDIDA" | "CANCELAR", dono?: Escopo, por?: { authId: string; nome: string }) {
  const { data: r } = await db().from("contempladas_reservas").select("*").eq("empresa_id", empresaId).eq("id", reservaId).maybeSingle();
  if (!r) throw new Error("Reserva não encontrada.");
  if (dono && r.dono_auth_id !== dono) throw new Error("Essa reserva é de outra unidade.");
  await db().from("contempladas_reservas").update({ status: acao === "VENDIDA" ? "CONFIRMADA" : "CANCELADA" }).eq("id", reservaId);
  if (acao === "VENDIDA") {
    // Vendedor: o da proposta que originou a reserva, quando houver.
    let vendedor: string | null = null;
    if (r.proposta_id) {
      const { data: prop } = await db().from("contempladas_propostas").select("vendedor_nome").eq("id", r.proposta_id).maybeSingle();
      vendedor = (prop?.vendedor_nome as string) ?? null;
    }
    await mudarStatusCotas(empresaId, r.cota_ids, "VENDIDA", undefined, por ? { ...por, vendedor } : undefined);
  }
  else if (r.tipo === "PIX") await mudarStatusCotas(empresaId, r.cota_ids, "DISPONIVEL");
}

export async function mudarStatusCotas(
  empresaId: string,
  ids: string[],
  status: CotaPortal["status"],
  dono?: Escopo,
  por?: { authId: string; nome: string; vendedor?: string | null },
) {
  const agora = new Date().toISOString();
  if (status !== "VENDIDA") {
    let q = db()
      .from("contempladas_cotas")
      .update({ status, updated_at: agora, exclusao_solicitada_em: null, exclusao_solicitada_por: null, exclusao_motivo: null })
      .eq("empresa_id", empresaId)
      .in("id", ids);
    if (dono) q = q.eq("dono_auth_id", dono);
    const { error } = await q;
    if (error) throw new Error(error.message);
    // Venda desfeita: comissão ainda não paga é cancelada.
    await db().from("contempladas_comissoes").update({ status: "CANCELADO" }).eq("empresa_id", empresaId).in("cota_id", ids).eq("status", "PENDENTE");
    return;
  }
  // Venda: grava vendedor (da proposta mais recente com a cota) e quem marcou.
  // O banco registra a linha em contempladas_vendas (trigger).
  const cfgs = await configsPorDono(empresaId);
  for (const id of ids) {
    const { data: prop } = await db()
      .from("contempladas_propostas")
      .select("id,numero,vendedor_nome,vendedor_auth_id,adicional_valor,desconto_valor,credito_total")
      .eq("empresa_id", empresaId)
      .contains("cota_ids", [id])
      .not("vendedor_nome", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const vendedor = por?.vendedor ?? (prop?.vendedor_nome as string) ?? por?.nome ?? null;
    let q = db()
      .from("contempladas_cotas")
      .update({ status, updated_at: agora, vendida_por: por?.authId ?? null, vendida_por_nome: por?.nome ?? null, vendedor_nome: vendedor })
      .eq("empresa_id", empresaId)
      .eq("id", id);
    if (dono) q = q.eq("dono_auth_id", dono);
    const { error } = await q;
    if (error) throw new Error(error.message);
    if (prop?.vendedor_auth_id) await gerarComissao(empresaId, id, prop, cfgs.de);
  }
}

/**
 * Comissão da revenda na venda: o que o administrador paga pela cota (configuração dele ou
 * a da lista) + o adicional que a revenda pôs na entrada − o desconto que ela deu
 * (adicional e desconto rateados pelo crédito quando a proposta junta várias cotas).
 */
async function gerarComissao(
  empresaId: string,
  cotaId: string,
  prop: Record<string, unknown>,
  cfgDe: (dono: string | null) => ConfigContempladas,
) {
  const { data: c } = await db()
    .from("contempladas_cotas")
    .select("id,codigo,credito,comissao_parceiro,comissao_fixada,dono_auth_id,dono_nome")
    .eq("id", cotaId)
    .maybeSingle();
  if (!c || c.dono_auth_id === prop.vendedor_auth_id) return; // venda do próprio administrador
  const credito = num(c.credito);
  const parte = num(prop.credito_total) ? credito / num(prop.credito_total) : 1;
  const base = comissaoVisivel({ credito, comissao_parceiro: num(c.comissao_parceiro), comissao_fixada: Boolean(c.comissao_fixada) }, cfgDe(c.dono_auth_id));
  const adicional = Math.round(num(prop.adicional_valor) * parte * 100) / 100;
  const desconto = Math.round(num(prop.desconto_valor) * parte * 100) / 100;
  const comum = { empresa_id: empresaId, cota_id: cotaId, codigo: c.codigo, credito, proposta_id: prop.id, proposta_numero: prop.numero };
  const colab = await colaboracaoDoVendedor(empresaId, prop.vendedor_auth_id as string | null);
  if (!colab) {
    await db().from("contempladas_comissoes").insert({
      ...comum,
      revenda_auth_id: prop.vendedor_auth_id,
      revenda_nome: prop.vendedor_nome,
      dono_auth_id: c.dono_auth_id,
      dono_nome: c.dono_nome,
      valor_comissao: base,
      valor_adicional: adicional,
      valor_desconto: desconto,
      valor: Math.max(0, Math.round((base + adicional - desconto) * 100) / 100),
    });
    return;
  }
  // Venda de colaborador: o dono da cota paga o responsável (como uma venda dele)
  // e o responsável paga ao colaborador o percentual combinado + o ágio.
  const parteColab = Math.round(base * (colab.percentual / 100) * 100) / 100;
  if (colab.responsavelAuthId !== c.dono_auth_id) {
    await db().from("contempladas_comissoes").insert({
      ...comum,
      tipo: "REVENDA",
      revenda_auth_id: colab.responsavelAuthId,
      revenda_nome: colab.responsavelNome,
      colaborador_auth_id: prop.vendedor_auth_id,
      colaborador_nome: prop.vendedor_nome,
      dono_auth_id: c.dono_auth_id,
      dono_nome: c.dono_nome,
      valor_comissao: base,
      valor_adicional: adicional,
      valor_desconto: desconto,
      valor: Math.max(0, Math.round((base + adicional - desconto) * 100) / 100),
    });
  }
  await db().from("contempladas_comissoes").insert({
    ...comum,
    tipo: "COLABORADOR",
    revenda_auth_id: prop.vendedor_auth_id,
    revenda_nome: prop.vendedor_nome,
    colaborador_auth_id: prop.vendedor_auth_id,
    colaborador_nome: prop.vendedor_nome,
    dono_auth_id: colab.responsavelAuthId,
    dono_nome: colab.responsavelNome,
    valor_comissao: parteColab,
    valor_adicional: adicional,
    valor_desconto: desconto,
    valor: Math.max(0, Math.round((parteColab + adicional - desconto) * 100) / 100),
  });
}

export type Comissao = {
  id: string;
  codigo: string;
  credito: number;
  propostaNumero: number | null;
  revenda: string | null;
  revendaAuthId: string | null;
  tipo: "REVENDA" | "COLABORADOR";
  colaborador: string | null;
  dono: string | null;
  donoAuthId: string | null;
  valorComissao: number;
  valorAdicional: number;
  valorDesconto: number;
  valor: number;
  status: "PENDENTE" | "PAGO" | "RECEBIDO";
  comprovanteUrl: string | null;
  pagoEm: string | null;
  recebidoEm: string | null;
  criadaEm: string;
};

/** Comissões a pagar (administrador; dono do portal vê todas) e a receber (revenda). */
export async function listarComissoes(empresaId: string, authId: string, verTodas: boolean) {
  let q = db().from("contempladas_comissoes").select("*").eq("empresa_id", empresaId).neq("status", "CANCELADO").order("created_at", { ascending: false }).limit(300);
  if (!verTodas) q = q.or(`dono_auth_id.eq.${authId},revenda_auth_id.eq.${authId}`);
  const { data } = await q;
  return Promise.all(
    (data ?? []).map(async (r): Promise<Comissao> => {
      let comprovanteUrl: string | null = null;
      if (r.comprovante_path) {
        const { data: s } = await db().storage.from(BUCKET_COMPROVANTES).createSignedUrl(r.comprovante_path, 3600);
        comprovanteUrl = s?.signedUrl ?? null;
      }
      return {
        id: r.id,
        codigo: r.codigo,
        credito: num(r.credito),
        propostaNumero: r.proposta_numero ? Number(r.proposta_numero) : null,
        revenda: r.revenda_nome,
        revendaAuthId: r.revenda_auth_id,
        tipo: r.tipo === "COLABORADOR" ? "COLABORADOR" : "REVENDA",
        colaborador: r.colaborador_nome ?? null,
        dono: r.dono_nome,
        donoAuthId: r.dono_auth_id,
        valorComissao: num(r.valor_comissao),
        valorAdicional: num(r.valor_adicional),
        valorDesconto: num(r.valor_desconto),
        valor: num(r.valor),
        status: r.status,
        comprovanteUrl,
        pagoEm: r.pago_em,
        recebidoEm: r.recebido_em,
        criadaEm: r.created_at,
      };
    }),
  );
}

export async function pagarComissao(empresaId: string, id: string, authId: string, verTodas: boolean, comprovante: File | null) {
  const { data: r } = await db().from("contempladas_comissoes").select("dono_auth_id,status").eq("empresa_id", empresaId).eq("id", id).maybeSingle();
  if (!r) throw new Error("Comissão não encontrada.");
  if (!verTodas && r.dono_auth_id !== authId) throw new Error("Essa comissão é de outro administrador.");
  if (r.status !== "PENDENTE") throw new Error("Essa comissão já foi paga.");
  let path: string | null = null;
  if (comprovante && comprovante.size) {
    if (comprovante.size > 8 * 1024 * 1024) throw new Error("Comprovante acima de 8 MB.");
    const ext = (comprovante.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    path = `${empresaId}/comissoes/${id}-${Date.now()}.${ext}`;
    const { error } = await db().storage.from(BUCKET_COMPROVANTES).upload(path, comprovante, { contentType: comprovante.type });
    if (error) throw new Error(`Falha ao enviar comprovante: ${error.message}`);
  }
  await db().from("contempladas_comissoes").update({ status: "PAGO", pago_em: new Date().toISOString(), comprovante_path: path }).eq("id", id);
}

export async function confirmarRecebimento(empresaId: string, id: string, authId: string) {
  const { data: r } = await db().from("contempladas_comissoes").select("revenda_auth_id,status").eq("empresa_id", empresaId).eq("id", id).maybeSingle();
  if (!r || r.revenda_auth_id !== authId) throw new Error("Comissão não encontrada.");
  if (r.status !== "PAGO") throw new Error("O administrador ainda não marcou como pago.");
  await db().from("contempladas_comissoes").update({ status: "RECEBIDO", recebido_em: new Date().toISOString() }).eq("id", id);
}

export async function solicitarExclusao(empresaId: string, cotaId: string, dono: string, nome: string, motivo: string) {
  const { error } = await db()
    .from("contempladas_cotas")
    .update({ exclusao_solicitada_em: new Date().toISOString(), exclusao_solicitada_por: nome, exclusao_motivo: motivo || null })
    .eq("empresa_id", empresaId)
    .eq("id", cotaId)
    .eq("dono_auth_id", dono);
  if (error) throw new Error(error.message);
}

export async function recusarExclusao(empresaId: string, cotaId: string) {
  await db().from("contempladas_cotas").update({ exclusao_solicitada_em: null, exclusao_solicitada_por: null, exclusao_motivo: null }).eq("empresa_id", empresaId).eq("id", cotaId);
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

/** Cartas vendidas registradas (base da taxa por carta). */
export async function resumoVendas(empresaId: string, dono?: Escopo) {
  let q = db().from("contempladas_vendas").select("credito,created_at").eq("empresa_id", empresaId).is("estornada_em", null);
  if (dono) q = q.eq("dono_auth_id", dono);
  const { data } = await q;
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const linhas = data ?? [];
  return {
    total: linhas.length,
    noMes: linhas.filter((l) => new Date(l.created_at as string) >= inicioMes).length,
    creditoTotal: linhas.reduce((s, l) => s + num(l.credito), 0),
  };
}

/** Reaplica o ágio configurado na entrada das cotas disponíveis da unidade (entrada = administradora + ágio). */
export async function reaplicarAgio(empresaId: string, dono: string | null, incluirSemDono: boolean, cfg: ConfigContempladas) {
  let q = db().from("contempladas_cotas").select("id,tipo,credito,entrada_original").eq("empresa_id", empresaId).in("status", ["DISPONIVEL", "RESERVADA"]);
  q = dono ? q.or(`dono_auth_id.eq.${dono}${incluirSemDono ? ",dono_auth_id.is.null" : ""}`) : q.is("dono_auth_id", null);
  const { data } = await q;
  let n = 0;
  for (const c of data ?? []) {
    const a = c.tipo === "automovel" ? { tipo: cfg.agio_auto_tipo, valor: cfg.agio_auto_valor } : { tipo: cfg.agio_tipo, valor: cfg.agio_valor };
    const extra = Math.round((a.tipo === "PERCENTUAL" ? (num(c.credito) * a.valor) / 100 : a.valor) * 100) / 100;
    const { error } = await db()
      .from("contempladas_cotas")
      .update({ entrada_acrescimo: extra, entrada: Math.round((num(c.entrada_original) + extra) * 100) / 100, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    if (!error) n++;
  }
  return n;
}

/** Cotas já no portal com as mesmas características (administradora, crédito, prazo e entrada da administradora). */
export async function acharDuplicadas(empresaId: string, cotas: { administradora: string; credito: number; prazo: number; entrada_original: number }[]) {
  const { data } = await db()
    .from("contempladas_cotas")
    .select("codigo,status,administradora,credito,prazo,entrada_original,dono_nome")
    .eq("empresa_id", empresaId)
    .neq("status", "INATIVA");
  const chave = (c: { administradora: string; credito: number; prazo: number; entrada_original: number }) =>
    `${String(c.administradora).toLowerCase()}|${Math.round(num(c.credito) * 100)}|${c.prazo}|${Math.round(num(c.entrada_original) * 100)}`;
  const mapa = new Map<string, { codigo: string; status: string; dono: string | null }>();
  for (const c of data ?? []) mapa.set(chave(c as never), { codigo: c.codigo, status: c.status, dono: c.dono_nome });
  return cotas.map((c) => mapa.get(chave(c)) ?? null);
}

/** Últimos envios (para desfazer). Gerente vê só os da unidade dele. */
export async function listarLotes(empresaId: string, dono?: Escopo) {
  let q = db()
    .from("contempladas_lotes")
    .select("id,created_at,quantidade,dono_nome,desfeito_em")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (dono) q = q.eq("dono_auth_id", dono);
  const { data } = await q;
  const lotes = data ?? [];
  const ids = lotes.map((l) => l.id as string);
  const { data: cs } = ids.length ? await db().from("contempladas_cotas").select("lote_id,status,tipo").in("lote_id", ids) : { data: [] };
  return lotes.map((l) => {
    const minhas = (cs ?? []).filter((c) => c.lote_id === l.id);
    return {
      id: l.id as string,
      criadoEm: l.created_at as string,
      quantidade: Number(l.quantidade),
      dono: (l.dono_nome as string) ?? null,
      desfeitoEm: (l.desfeito_em as string) ?? null,
      disponiveis: minhas.filter((c) => c.status === "DISPONIVEL").length,
      travadas: minhas.filter((c) => c.status === "RESERVADA" || c.status === "VENDIDA").length,
      tipos: [...new Set(minhas.map((c) => (c.tipo === "automovel" ? "veículos" : "imóveis")))].join(" e "),
    };
  });
}

/** Desfaz um envio: tira do ar as cotas dele que ainda estão disponíveis (reservadas e vendidas ficam). */
export async function desfazerLote(empresaId: string, loteId: string, dono?: Escopo) {
  let q = db().from("contempladas_lotes").select("id,dono_auth_id,desfeito_em").eq("empresa_id", empresaId).eq("id", loteId);
  if (dono) q = q.eq("dono_auth_id", dono);
  const { data: lote } = await q.maybeSingle();
  if (!lote) throw new Error("Envio não encontrado.");
  if (lote.desfeito_em) throw new Error("Esse envio já foi desfeito.");
  const { data: tiradas, error } = await db()
    .from("contempladas_cotas")
    .update({ status: "INATIVA", updated_at: new Date().toISOString() })
    .eq("empresa_id", empresaId)
    .eq("lote_id", loteId)
    .eq("status", "DISPONIVEL")
    .select("id");
  if (error) throw new Error(error.message);
  await db().from("contempladas_lotes").update({ desfeito_em: new Date().toISOString() }).eq("id", loteId);
  return tiradas?.length ?? 0;
}

/* ------------------------------ Leads do Negociar ------------------------------ */

export type LeadPortal = {
  id: string;
  nome: string;
  telefone: string;
  codigos: string[];
  credito: number;
  entrada: number;
  donos: string[];
  status: "NOVO" | "EM_CONTATO" | "FECHADO" | "PERDIDO";
  criadoEm: string;
};

export async function registrarLeadPortal(empresaId: string, l: { leadId: string | null; nome: string; telefone: string; cotas: CotaPortal[] }) {
  const donos = [...new Set(l.cotas.map((c) => c.dono_auth_id).filter(Boolean))] as string[];
  await db().from("contempladas_leads").insert({
    empresa_id: empresaId,
    lead_id: l.leadId,
    nome: l.nome,
    telefone: l.telefone.replace(/\D/g, ""),
    cota_ids: l.cotas.map((c) => c.id),
    codigos: l.cotas.map((c) => c.codigo),
    credito: l.cotas.reduce((s, c) => s + c.credito, 0),
    entrada: l.cotas.reduce((s, c) => s + c.entrada, 0),
    dono_auth_ids: donos,
    dono_nomes: [...new Set(l.cotas.map((c) => c.dono_nome).filter(Boolean))],
  });
}

/** Dono vê todos; administradora vê só os leads das cotas dela. */
export async function listarLeadsPortal(empresaId: string, donoAuthId?: string): Promise<LeadPortal[]> {
  let q = db().from("contempladas_leads").select("*").eq("empresa_id", empresaId).order("created_at", { ascending: false }).limit(300);
  if (donoAuthId) q = q.contains("dono_auth_ids", [donoAuthId]);
  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: r.id, nome: r.nome, telefone: r.telefone, codigos: r.codigos ?? [], credito: num(r.credito), entrada: num(r.entrada),
    donos: r.dono_nomes ?? [], status: r.status, criadoEm: r.created_at,
  }));
}

export async function statusLeadPortal(empresaId: string, id: string, status: LeadPortal["status"], donoAuthId?: string) {
  let q = db().from("contempladas_leads").update({ status }).eq("empresa_id", empresaId).eq("id", id);
  if (donoAuthId) q = q.contains("dono_auth_ids", [donoAuthId]);
  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Lead não encontrado.");
}

/** Marca a data de atualização das cotas do administrador que vieram na lista e, se pedido, vende as que ficaram de fora. */
export async function venderForaDaLista(
  empresaId: string,
  donoAuthId: string | null,
  incluirSemDono: boolean,
  lista: { administradora: string; credito: number; prazo: number; entrada_original: number }[],
  por: { authId: string; nome: string; vendedor?: string | null },
  soConfirmar = false,
) {
  const chave = (c: { administradora: string; credito: number; prazo: number; entrada_original: number }) =>
    `${String(c.administradora).toLowerCase()}|${Math.round(num(c.credito) * 100)}|${c.prazo}|${Math.round(num(c.entrada_original) * 100)}`;
  const naLista = new Set(lista.map(chave));
  let q = db().from("contempladas_cotas").select("id,administradora,credito,prazo,entrada_original,dono_auth_id").eq("empresa_id", empresaId).eq("status", "DISPONIVEL");
  q = donoAuthId ? (incluirSemDono ? q.or(`dono_auth_id.eq.${donoAuthId},dono_auth_id.is.null`) : q.eq("dono_auth_id", donoAuthId)) : q.is("dono_auth_id", null);
  const { data } = await q;
  const confirmadas = (data ?? []).filter((c) => naLista.has(chave(c as never))).map((c) => c.id as string);
  if (confirmadas.length) await db().from("contempladas_cotas").update({ updated_at: new Date().toISOString() }).in("id", confirmadas);
  if (soConfirmar) return 0;
  const ids = (data ?? []).filter((c) => !naLista.has(chave(c as never))).map((c) => c.id as string);
  if (!ids.length) return 0;
  await mudarStatusCotas(empresaId, ids, "VENDIDA", undefined, { authId: por.authId, nome: por.nome, vendedor: por.vendedor || por.nome });
  return ids.length;
}
