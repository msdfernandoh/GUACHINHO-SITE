import { createClient } from "@/lib/supabase/server";
import { ErpModulosListingClient } from "./client";

export default async function PlatformErpModulosPage() {
  const db = await createClient();

  const { data: modulos } = await db
    .from("erp_modulos_catalogo")
    .select("id,codigo,nome,descricao,status,estado_produto,ordem_padrao,dependencias,categoria,updated_at")
    .order("ordem_padrao", { ascending: true });

  return <ErpModulosListingClient modulos={modulos ?? []} />;
}
