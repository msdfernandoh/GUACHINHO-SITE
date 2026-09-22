import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function fetchEventosDisponiveisParaIndicador() {
  const admin = createAdminClient({ noStore: true });
  const limite = new Date();
  limite.setHours(limite.getHours() - 24);
  const { data } = await admin
    .from("eventos")
    .select("id,nome,data_evento,local,cidade")
    .eq("ativo", true)
    .eq("publicado", true)
    .gte("data_evento", limite.toISOString())
    .order("data_evento")
    .limit(1);
  return data ?? [];
}
