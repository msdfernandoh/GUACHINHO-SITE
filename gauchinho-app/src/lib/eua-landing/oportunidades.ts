import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { fetchPublicCartasAutorizadasForEmpresa } from "@/lib/cartas/catalogo-autorizado-cartas";
import type { EuaOportunidade } from "./types";

const LIMITE = 6;

type ImovelVitrine = {
  id: string;
  titulo: string;
  cidade: string | null;
  bairro: string | null;
  valor: number | null;
  exibir_valor_publico: boolean;
  foto_principal_url: string | null;
  tipo_imovel: string | null;
  imobiliaria_id: string;
};

/**
 * Imóveis publicados do tenant cuja imobiliária está ativa. Usa duas consultas
 * simples em vez do embed imoveis→imobiliarias, que é ambíguo no schema atual.
 */
async function imoveisDoTenant(empresaId: string): Promise<EuaOportunidade[]> {
  const admin = createAdminClient();
  const { data: imoveis, error } = await admin
    .from("imoveis")
    .select("id, titulo, cidade, bairro, valor, exibir_valor_publico, foto_principal_url, tipo_imovel, imobiliaria_id")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .in("status", ["ativo", "reservado"])
    .order("destaque", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(LIMITE * 2);
  if (error || !imoveis?.length) return [];

  const ids = [...new Set((imoveis as ImovelVitrine[]).map((i) => i.imobiliaria_id))];
  const { data: ativas } = await admin
    .from("imobiliarias")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .in("id", ids);
  const ativasIds = new Set((ativas ?? []).map((a: { id: string }) => a.id));

  return (imoveis as ImovelVitrine[])
    .filter((i) => ativasIds.has(i.imobiliaria_id))
    .slice(0, LIMITE)
    .map((i) => ({
      id: i.id,
      tipo: "imovel",
      titulo: i.titulo,
      cidade: [i.cidade, i.bairro].filter(Boolean).join(" · ") || null,
      valor: i.exibir_valor_publico ? i.valor : null,
      entrada: null,
      fotoUrl: i.foto_principal_url,
      tipoBem: i.tipo_imovel,
    }));
}

export async function carregarOportunidadesEua(): Promise<EuaOportunidade[]> {
  const tenant = await getResolvedTenant();
  if (!tenant?.allowsLegacyOperationalData) return [];
  const [imoveis, cartas] = await Promise.all([
    imoveisDoTenant(tenant.empresaId).catch(() => []),
    fetchPublicCartasAutorizadasForEmpresa(tenant.empresaId).catch(() => []),
  ]);
  const deCartas: EuaOportunidade[] = cartas
    .filter((c) => c.ativo !== false && c.credito)
    .slice(0, LIMITE)
    .map((c) => ({
      id: c.id,
      tipo: "carta",
      titulo: c.administradora ?? "Racon",
      cidade: null,
      valor: c.credito,
      entrada: c.entrada,
      fotoUrl: null,
      tipoBem: c.tipo_carta,
    }));
  return [...imoveis, ...deCartas];
}
