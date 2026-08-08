import { createAdminClient } from "@/lib/supabase/admin";
import { listAdministradoraIdsAutorizadasForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
import { PublicCartasFilters } from "@/app/admin/cartas-contempladas/actions";
import type { CartaContemplada } from "@/lib/cartas/types";

/**
 * Retorna as IDs e nomes de administradoras ativas concedidas para a empresa.
 */
export async function fetchAuthorizedAdministradoraIdsForEmpresa(empresaId: string): Promise<{
  adminIds: string[];
  adminNamesLower: string[];
}> {
  const adminIds = await listAdministradoraIdsAutorizadasForEmpresa(empresaId);

  // Também buscar nomes das administradoras para suporte a fallback de snapshot textual 'Racon'
  const supabase = createAdminClient();
  const adminNamesLower: string[] = [];

  if (adminIds.length > 0) {
    const { data: adms } = await supabase.from("administradoras").select("nome, razao_social").in("id", adminIds);
    if (adms) {
      for (const a of adms) {
        if (a.nome) adminNamesLower.push(a.nome.trim().toLowerCase());
        if (a.razao_social) adminNamesLower.push(a.razao_social.trim().toLowerCase());
      }
    }
  }

  return {
    adminIds,
    adminNamesLower: [...new Set(adminNamesLower)],
  };
}

/**
 * Busca cartas contempladas autorizadas para a empresa informada por tenant/host.
 */
export async function fetchPublicCartasAutorizadasForEmpresa(
  empresaId: string,
  filters: PublicCartasFilters = {}
): Promise<CartaContemplada[]> {
  const { adminIds, adminNamesLower } = await fetchAuthorizedAdministradoraIdsForEmpresa(empresaId);

  // Se a empresa não tiver concessões ativas com NENHUMA administradora (ex: Empresa B),
  // retorna lista vazia imediatamente sem vazamento.
  if (adminIds.length === 0 && adminNamesLower.length === 0) {
    return [];
  }

  const supabase = createAdminClient();
  let q = supabase
    .from("cartas_contempladas")
    .select("*")
    .eq("ativo", true)
    .in("status", ["disponivel", "consultar_disponibilidade"]);

  if (filters.tipo) q = q.eq("tipo_carta", filters.tipo);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.creditoMin != null) q = q.gte("credito", filters.creditoMin);
  if (filters.creditoMax != null) q = q.lte("credito", filters.creditoMax);
  if (filters.entradaMin != null) q = q.gte("entrada", filters.entradaMin);
  if (filters.entradaMax != null) q = q.lte("entrada", filters.entradaMax);
  if (filters.apenasDestaque) q = q.eq("destaque", true);

  const sort = filters.sort ?? "recentes";
  if (sort === "menor_entrada") {
    q = q.order("entrada", { ascending: true, nullsFirst: false });
  } else if (sort === "maior_credito") {
    q = q.order("credito", { ascending: false, nullsFirst: false });
  } else {
    q = q.order("created_at", { ascending: false });
  }

  const { data, error } = await q;
  if (error || !data) return [];

  // Filtragem tenant-scoped hermética:
  // Carta autorizada se administradora_id for da concessão OU se texto da administradora bater
  const cartasAutorizadas = data.filter((carta) => {
    if (carta.administradora_id && adminIds.includes(carta.administradora_id)) {
      return true;
    }
    if (carta.administradora) {
      const nameLower = carta.administradora.trim().toLowerCase();
      if (adminNamesLower.includes(nameLower)) {
        return true;
      }
    }
    return false;
  });

  return cartasAutorizadas as CartaContemplada[];
}

/**
 * Busca uma carta contemplada específica autorizada para a empresa por UUID.
 * Retorna null se inexistente ou se pertencente a administradora não concedida (404 uniforme).
 */
export async function getCartaAutorizadaForEmpresa(
  empresaId: string,
  cartaId: string
): Promise<CartaContemplada | null> {
  if (!cartaId || !empresaId) return null;

  const { adminIds, adminNamesLower } = await fetchAuthorizedAdministradoraIdsForEmpresa(empresaId);
  if (adminIds.length === 0 && adminNamesLower.length === 0) return null;

  const supabase = createAdminClient();
  const { data: carta, error } = await supabase
    .from("cartas_contempladas")
    .select("*")
    .eq("id", cartaId)
    .eq("ativo", true)
    .single();

  if (error || !carta) return null;

  const isAuthorized =
    (carta.administradora_id && adminIds.includes(carta.administradora_id)) ||
    (carta.administradora && adminNamesLower.includes(carta.administradora.trim().toLowerCase()));

  if (!isAuthorized) return null;

  return carta as CartaContemplada;
}

/**
 * Assegura permissão de acesso da empresa a uma carta. Lança erro uniforme de NOT_FOUND.
 */
export async function assertEmpresaPodeAcessarCarta(empresaId: string, cartaId: string): Promise<CartaContemplada> {
  const carta = await getCartaAutorizadaForEmpresa(empresaId, cartaId);
  if (!carta) {
    throw new Error("Carta contemplada não encontrada");
  }
  return carta;
}
