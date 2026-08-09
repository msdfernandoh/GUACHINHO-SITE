import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchConcessoesComAdministradoraByEmpresa } from "@/lib/administradoras/repository";
import { filterAdministradorasAutorizadasForEmpresa } from "@/lib/administradoras/rules";
import type { PublicCartasFilters } from "@/app/admin/cartas-contempladas/actions";
import type { CartaContemplada } from "@/lib/cartas/types";

type ConcessoesRows = Awaited<ReturnType<typeof fetchConcessoesComAdministradoraByEmpresa>>;

export type CatalogoCartasDeps = {
  fetchConcessoes: (empresaId: string) => Promise<ConcessoesRows>;
  adminFrom: () => SupabaseClient;
};

const defaultDeps: CatalogoCartasDeps = {
  fetchConcessoes: fetchConcessoesComAdministradoraByEmpresa,
  adminFrom: createAdminClient,
};

export function cartaPertenceAoCatalogoAutorizado(
  carta: Pick<CartaContemplada, "administradora_id" | "administradora">,
  autorizadas: { adminIds: string[]; adminNamesLower: string[] },
): boolean {
  if (carta.administradora_id) {
    return autorizadas.adminIds.includes(carta.administradora_id);
  }
  const nome = carta.administradora?.trim().toLowerCase();
  return Boolean(nome && autorizadas.adminNamesLower.includes(nome));
}


/** IDs e nomes somente de concessões ATIVA ligadas a administradoras globais ATIVA. */
export async function fetchAuthorizedAdministradoraIdsForEmpresa(
  empresaId: string,
  deps: CatalogoCartasDeps = defaultDeps,
): Promise<{ adminIds: string[]; adminNamesLower: string[] }> {
  if (!empresaId) return { adminIds: [], adminNamesLower: [] };

  const rows = await deps.fetchConcessoes(empresaId);
  const autorizadas = filterAdministradorasAutorizadasForEmpresa(empresaId, rows);
  const names = autorizadas.flatMap((administradora) => [
    administradora.nome,
    administradora.nome_fantasia,
  ]);

  return {
    adminIds: autorizadas.map((administradora) => administradora.id),
    adminNamesLower: [
      ...new Set(
        names
          .filter((nome): nome is string => Boolean(nome?.trim()))
          .map((nome) => nome.trim().toLowerCase()),
      ),
    ],
  };
}

/** Catálogo público tenant-scoped, compatível antes e depois da coluna da Migration 050. */
export async function fetchPublicCartasAutorizadasForEmpresa(
  empresaId: string,
  filters: PublicCartasFilters = {},
  deps: CatalogoCartasDeps = defaultDeps,
): Promise<CartaContemplada[]> {
  const autorizadas = await fetchAuthorizedAdministradoraIdsForEmpresa(empresaId, deps);
  if (autorizadas.adminIds.length === 0) return [];

  let query = deps
    .adminFrom()
    .from("cartas_contempladas")
    .select("*")
    .eq("ativo", true)
    .in("status", ["disponivel", "consultar_disponibilidade"]);

  if (filters.tipo) query = query.eq("tipo_carta", filters.tipo);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.creditoMin != null) query = query.gte("credito", filters.creditoMin);
  if (filters.creditoMax != null) query = query.lte("credito", filters.creditoMax);
  if (filters.entradaMin != null) query = query.gte("entrada", filters.entradaMin);
  if (filters.entradaMax != null) query = query.lte("entrada", filters.entradaMax);
  if (filters.apenasDestaque) query = query.eq("destaque", true);

  const sort = filters.sort ?? "recentes";
  if (sort === "menor_entrada") {
    query = query.order("entrada", { ascending: true, nullsFirst: false });
  } else if (sort === "maior_credito") {
    query = query.order("credito", { ascending: false, nullsFirst: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as CartaContemplada[]).filter((carta) =>
    cartaPertenceAoCatalogoAutorizado(carta, autorizadas),
  );
}

/** Carta inexistente e carta não autorizada são indistinguíveis publicamente. */
export async function getCartaAutorizadaForEmpresa(
  empresaId: string,
  cartaId: string,
  deps: CatalogoCartasDeps = defaultDeps,
): Promise<CartaContemplada | null> {
  if (!cartaId || !empresaId) return null;

  const autorizadas = await fetchAuthorizedAdministradoraIdsForEmpresa(empresaId, deps);
  if (autorizadas.adminIds.length === 0) return null;

  const { data, error } = await deps
    .adminFrom()
    .from("cartas_contempladas")
    .select("*")
    .eq("id", cartaId)
    .eq("ativo", true)
    .in("status", ["disponivel", "consultar_disponibilidade"])
    .maybeSingle();

  if (error || !data) return null;
  const carta = data as CartaContemplada;
  return cartaPertenceAoCatalogoAutorizado(carta, autorizadas) ? carta : null;
}

export async function assertEmpresaPodeAcessarCarta(
  empresaId: string,
  cartaId: string,
  deps: CatalogoCartasDeps = defaultDeps,
): Promise<CartaContemplada> {
  const carta = await getCartaAutorizadaForEmpresa(empresaId, cartaId, deps);
  if (!carta) throw new Error("Carta contemplada não encontrada");
  return carta;
}
