"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageLeads, isMaster } from "@/lib/auth/permissions";
import { countListaConvidadosItens, resolveConvidadoPor } from "@/lib/comercial-eventos/listas-convidados-stats";
import type {
  EventoListaConvidadosItemRow,
  EventoListaConvidadosRow,
  GuestDraft,
  ListaConvidadoResultado,
  ListaConvidadoStatus,
  ListaConvidadosResumo,
} from "@/lib/comercial-eventos/listas-convidados-types";
import { LISTA_CONVIDADO_RESULTADO, LISTA_CONVIDADO_STATUS } from "@/lib/comercial-eventos/listas-convidados-types";
import { fetchEventosOptionsForFilter } from "../actions";
import { slugify } from "@/lib/utils/slug";

const BASE = "/admin/eventos/listas-convidados";

function assertCanManageListas(perfil: string | undefined) {
  if (!canManageLeads(perfil as import("@/lib/auth/permissions").Perfil)) {
    throw new Error("Sem permissão");
  }
}

function isMissingListasTable(message: string) {
  return /eventos_listas_convidados/.test(message) && /does not exist|schema cache|Could not find/i.test(message);
}

export async function fetchEventosOptionsForListas() {
  return fetchEventosOptionsForFilter();
}

export async function fetchListasConvidadosResumo(filters?: {
  evento_id?: string;
  consultor?: string;
}): Promise<ListaConvidadosResumo[] | { migrationMissing: true }> {
  const u = await requireUsuario();
  assertCanManageListas(u.perfil);

  const supabase = await createClient();
  let q = supabase
    .from("eventos_listas_convidados")
    .select("*, eventos(nome), eventos_listas_convidados_itens(status_presenca)")
    .order("updated_at", { ascending: false });

  if (filters?.evento_id) q = q.eq("evento_id", filters.evento_id);
  if (filters?.consultor?.trim()) q = q.ilike("consultor_nome", `%${filters.consultor.trim()}%`);

  const { data, error } = await q;
  if (error) {
    if (isMissingListasTable(error.message)) return { migrationMissing: true };
    throw new Error(error.message);
  }

  type Row = EventoListaConvidadosRow & {
    eventos: { nome: string } | null;
    eventos_listas_convidados_itens: { status_presenca: ListaConvidadoStatus }[];
  };

  let rows = (data ?? []) as Row[];

  if (!isMaster(u.perfil)) {
    rows = rows.filter(
      (r) => r.criado_por_usuario_id === u.id || r.consultor_usuario_id === u.id,
    );
  }

  return rows.map((row) => {
    const counts = countListaConvidadosItens(row.eventos_listas_convidados_itens ?? []);
    const { eventos, eventos_listas_convidados_itens: _itens, ...lista } = row;
    return {
      ...lista,
      evento_nome: eventos?.nome ?? "—",
      ...counts,
    };
  });
}

export async function fetchListaConvidadosDetail(listaId: string): Promise<
  | {
      lista: EventoListaConvidadosRow & { evento_nome: string };
      itens: EventoListaConvidadosItemRow[];
    }
  | null
> {
  const u = await requireUsuario();
  assertCanManageListas(u.perfil);

  const supabase = await createClient();
  const { data: listaRaw, error } = await supabase
    .from("eventos_listas_convidados")
    .select("*, eventos(nome)")
    .eq("id", listaId)
    .maybeSingle();

  if (error) {
    if (isMissingListasTable(error.message)) return null;
    throw new Error(error.message);
  }
  if (!listaRaw) return null;

  type L = EventoListaConvidadosRow & { eventos: { nome: string } | null };
  const listaRow = listaRaw as L;

  if (
    !isMaster(u.perfil) &&
    listaRow.criado_por_usuario_id !== u.id &&
    listaRow.consultor_usuario_id !== u.id
  ) {
    throw new Error("Sem permissão para ver esta lista");
  }

  const { data: itens, error: itensErr } = await supabase
    .from("eventos_listas_convidados_itens")
    .select("*")
    .eq("lista_id", listaId)
    .order("ordem")
    .order("created_at");

  if (itensErr) throw new Error(itensErr.message);

  const { eventos, ...lista } = listaRow;
  const consultor = lista.consultor_nome;
  return {
    lista: { ...lista, evento_nome: eventos?.nome ?? "—" },
    itens: ((itens ?? []) as EventoListaConvidadosItemRow[]).map((item) => ({
      ...item,
      convidado_por: resolveConvidadoPor(item.convidado_por, consultor),
    })),
  };
}

export async function createListaConvidadosAction(input: {
  evento_id: string;
  consultor_nome: string;
  convidados: GuestDraft[];
}) {
  const u = await requireUsuario();
  assertCanManageListas(u.perfil);

  const evento_id = input.evento_id?.trim();
  const consultor_nome = input.consultor_nome?.trim();
  if (!evento_id) throw new Error("Selecione o evento");
  if (!consultor_nome) throw new Error("Informe o nome do consultor");

  const convidados = input.convidados
    .map((c) => ({
      nome: c.nome.trim(),
      empresa: c.empresa.trim() || null,
      telefone: c.telefone.trim() || null,
      convidado_por: resolveConvidadoPor(c.convidado_por, consultor_nome),
    }))
    .filter((c) => c.nome.length > 0);

  if (convidados.length === 0) throw new Error("Adicione pelo menos um convidado");

  const admin = createAdminClient();
  const { data: lista, error: listaErr } = await admin
    .from("eventos_listas_convidados")
    .insert({
      evento_id,
      consultor_nome,
      consultor_usuario_id: u.id,
      criado_por_usuario_id: u.id,
    })
    .select("id")
    .single();

  if (listaErr) {
    if (isMissingListasTable(listaErr.message)) {
      throw new Error("Execute a migration 020_eventos_listas_convidados.sql no Supabase.");
    }
    throw new Error(listaErr.message);
  }

  const rows = convidados.map((c, i) => ({
    lista_id: lista.id,
    ...c,
    ordem: i,
  }));

  const { error: itensErr } = await admin.from("eventos_listas_convidados_itens").insert(rows);
  if (itensErr) throw new Error(itensErr.message);

  revalidatePath(BASE);
  redirect(`${BASE}/${lista.id}`);
}

export async function updateListaMetaAction(listaId: string, input: { consultor_nome: string; evento_id: string }) {
  const u = await requireUsuario();
  assertCanManageListas(u.perfil);
  await assertListaAccess(listaId, u.id, u.perfil);

  const consultor_nome = input.consultor_nome.trim();
  const evento_id = input.evento_id.trim();
  if (!consultor_nome || !evento_id) throw new Error("Evento e consultor são obrigatórios");

  const supabase = await createClient();
  const { error } = await supabase
    .from("eventos_listas_convidados")
    .update({ consultor_nome, evento_id, updated_at: new Date().toISOString() })
    .eq("id", listaId);
  if (error) throw new Error(error.message);

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${listaId}`);
}

export async function updateListaPublicaAction(
  listaId: string,
  input: { publica: boolean; slug?: string },
) {
  const u = await requireUsuario();
  assertCanManageListas(u.perfil);
  await assertListaAccess(listaId, u.id, u.perfil);

  const supabase = await createClient();
  const { data: lista, error: loadErr } = await supabase
    .from("eventos_listas_convidados")
    .select("id, consultor_nome, slug, eventos(nome)")
    .eq("id", listaId)
    .single();

  if (loadErr) throw new Error(loadErr.message);

  type L = { consultor_nome: string; slug: string | null; eventos: { nome: string } | { nome: string }[] | null };
  const row = lista as unknown as L;
  const evRaw = row.eventos;
  const evNome = (Array.isArray(evRaw) ? evRaw[0]?.nome : evRaw?.nome) ?? "evento";

  let slug: string | null = row.slug;
  let publica = input.publica;

  if (publica) {
    const raw = input.slug?.trim() || slug || `${row.consultor_nome}-${evNome}`;
    let candidate = slugify(raw) || `lista-${listaId.slice(0, 8)}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const trySlug = attempt === 0 ? candidate : `${candidate}-${listaId.slice(0, 6)}`;
      const { data: clash } = await supabase
        .from("eventos_listas_convidados")
        .select("id")
        .eq("slug", trySlug)
        .eq("publica", true)
        .neq("id", listaId)
        .maybeSingle();
      if (!clash) {
        slug = trySlug;
        break;
      }
      candidate = `${candidate}-${attempt + 2}`;
    }
    if (!slug) throw new Error("Não foi possível gerar um link único. Ajuste o slug manualmente.");
  }

  const { error } = await supabase
    .from("eventos_listas_convidados")
    .update({
      publica,
      slug: publica ? slug : row.slug,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listaId);

  if (error) {
    if (/slug|publica|unique/.test(error.message)) {
      throw new Error("Este link (slug) já está em uso em outra lista pública.");
    }
    throw new Error(error.message);
  }

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${listaId}`);
  if (publica && slug) {
    revalidatePath(`/lista-convidados/${slug}`);
  }

  return { publica, slug: publica ? slug : row.slug };
}

export async function addConvidadoToListaAction(listaId: string, guest: GuestDraft) {
  const u = await requireUsuario();
  assertCanManageListas(u.perfil);
  await assertListaAccess(listaId, u.id, u.perfil);

  const nome = guest.nome.trim();
  if (!nome) throw new Error("Nome obrigatório");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("eventos_listas_convidados_itens")
    .select("ordem")
    .eq("lista_id", listaId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ordem = (last?.ordem ?? -1) + 1;

  const { data: listaMeta, error: listaMetaErr } = await supabase
    .from("eventos_listas_convidados")
    .select("consultor_nome")
    .eq("id", listaId)
    .single();
  if (listaMetaErr) throw new Error(listaMetaErr.message);

  const { error } = await supabase.from("eventos_listas_convidados_itens").insert({
    lista_id: listaId,
    nome,
    empresa: guest.empresa.trim() || null,
    telefone: guest.telefone.trim() || null,
    convidado_por: resolveConvidadoPor(guest.convidado_por, listaMeta.consultor_nome),
    ordem,
  });
  if (error) throw new Error(error.message);

  await touchLista(listaId);
  revalidatePath(`${BASE}/${listaId}`);
  revalidatePath(BASE);
}

export async function updateConvidadoItemAction(
  itemId: string,
  listaId: string,
  patch: {
    status_presenca?: ListaConvidadoStatus;
    resultado?: ListaConvidadoResultado | null;
    valor?: number | null;
    nome?: string;
    empresa?: string | null;
    telefone?: string | null;
    convidado_por?: string | null;
  },
) {
  const u = await requireUsuario();
  assertCanManageListas(u.perfil);
  await assertListaAccess(listaId, u.id, u.perfil);

  if (patch.status_presenca && !LISTA_CONVIDADO_STATUS.includes(patch.status_presenca)) {
    throw new Error("Status inválido");
  }
  if (patch.resultado !== undefined && patch.resultado !== null) {
    if (!LISTA_CONVIDADO_RESULTADO.includes(patch.resultado)) throw new Error("Resultado inválido");
  }

  const supabase = await createClient();

  const payload = { ...patch, updated_at: new Date().toISOString() };
  if (payload.convidado_por !== undefined) {
    const { data: listaMeta, error: listaMetaErr } = await supabase
      .from("eventos_listas_convidados")
      .select("consultor_nome")
      .eq("id", listaId)
      .single();
    if (listaMetaErr) throw new Error(listaMetaErr.message);
    payload.convidado_por = resolveConvidadoPor(payload.convidado_por, listaMeta.consultor_nome);
  }

  const { error } = await supabase
    .from("eventos_listas_convidados_itens")
    .update(payload)
    .eq("id", itemId)
    .eq("lista_id", listaId);
  if (error) throw new Error(error.message);

  await touchLista(listaId);
  revalidatePath(`${BASE}/${listaId}`);
  revalidatePath(BASE);
}

export async function deleteConvidadoItemAction(itemId: string, listaId: string) {
  const u = await requireUsuario();
  assertCanManageListas(u.perfil);
  await assertListaAccess(listaId, u.id, u.perfil);

  const supabase = await createClient();
  const { error } = await supabase.from("eventos_listas_convidados_itens").delete().eq("id", itemId).eq("lista_id", listaId);
  if (error) throw new Error(error.message);

  await touchLista(listaId);
  revalidatePath(`${BASE}/${listaId}`);
  revalidatePath(BASE);
}

async function assertListaAccess(listaId: string, usuarioId: string, perfil: import("@/lib/auth/permissions").Perfil) {
  if (isMaster(perfil)) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos_listas_convidados")
    .select("criado_por_usuario_id, consultor_usuario_id")
    .eq("id", listaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lista não encontrada");
  if (data.criado_por_usuario_id !== usuarioId && data.consultor_usuario_id !== usuarioId) {
    throw new Error("Sem permissão");
  }
}

async function touchLista(listaId: string) {
  const admin = createAdminClient();
  await admin.from("eventos_listas_convidados").update({ updated_at: new Date().toISOString() }).eq("id", listaId);
}
