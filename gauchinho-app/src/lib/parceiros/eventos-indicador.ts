import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { somarVagasUsadas, vagasRestantes } from "@/lib/comercial-eventos/vagas";

export async function fetchEventosDisponiveisParaIndicador() {
  const admin = createAdminClient({ noStore: true });
  const limite = new Date();
  limite.setHours(limite.getHours() - 24);
  const { data } = await admin
    .from("eventos")
    .select("id,nome,data_evento,local,cidade,limite_participantes,permitir_acompanhante")
    .eq("ativo", true)
    .eq("publicado", true)
    .gte("data_evento", limite.toISOString())
    .order("data_evento")
    .limit(1);
  return data ?? [];
}

export async function fetchEventoAtivoParaPainelIndicador() {
  const [evento] = await fetchEventosDisponiveisParaIndicador();
  if (!evento) return null;
  const admin = createAdminClient({ noStore: true });
  const { data: participantes } = await admin.from("eventos_participantes")
    .select("quantidade_vagas,status").eq("evento_id", evento.id)
    .in("status", ["confirmado", "presente"]);
  const usadas = somarVagasUsadas(participantes ?? []);
  return { ...evento, vagas_disponiveis: vagasRestantes(evento.limite_participantes, usadas) };
}
