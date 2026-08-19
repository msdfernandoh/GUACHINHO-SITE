import { createClient } from "@/lib/supabase/server";
import { DominiosListingClient } from "./client";

export default async function PlatformDominiosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; empresa_id?: string }>;
}) {
  const filters = await searchParams;
  const db = await createClient();

  const [dominiosRes, empresasRes] = await Promise.all([
    db
      .from("empresa_dominios")
      .select("id,empresa_id,valor,tipo,principal,ativo,verificado,created_at,updated_at,empresa:empresas(id,nome_fantasia,slug)")
      .order("principal", { ascending: false })
      .order("valor"),
    db
      .from("empresas")
      .select("id,nome_fantasia,slug,status")
      .order("nome_fantasia"),
  ]);

  let dominios = dominiosRes.data ?? [];
  if (filters.busca) {
    const term = filters.busca.toLowerCase();
    dominios = dominios.filter(
      (d) =>
        d.valor.toLowerCase().includes(term) ||
        (d.empresa as { nome_fantasia?: string } | null)?.nome_fantasia?.toLowerCase().includes(term),
    );
  }
  if (filters.empresa_id) {
    dominios = dominios.filter((d) => d.empresa_id === filters.empresa_id);
  }

  return (
    <DominiosListingClient
      dominios={dominios as never[]}
      empresas={empresasRes.data ?? []}
    />
  );
}
