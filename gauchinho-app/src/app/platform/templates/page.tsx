import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TemplatesListingClient } from "./client";

export default async function PlatformTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const db = await createClient();

  let query = db
    .from("site_modelos")
    .select("id,codigo,nome,descricao,status,versao,identidade_visual,catalogo_menus,secoes_home,permite_logo_propria,updated_at")
    .order("versao", { ascending: false })
    .order("nome");

  if (filters.busca) {
    query = query.or(`nome.ilike.%${filters.busca}%,codigo.ilike.%${filters.busca}%`);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data: modelos } = await query;
  const rows = modelos ?? [];

  return (
    <div className="space-y-6">
      <TemplatesListingClient modelos={rows as never[]} />
    </div>
  );
}
