import { createAdminClient } from "@/lib/supabase/admin";
import type { DadosLeadExtraidos } from "@/lib/ia/types";
import type { IaChatMessage } from "@/lib/ia/types";

export async function getOrCreateConversa(
  sessionId: string,
  paginaOrigem: string,
  urlOrigem: string,
) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("ia_conversas")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await admin
    .from("ia_conversas")
    .insert({
      session_id: sessionId,
      pagina_origem: paginaOrigem,
      url_origem: urlOrigem,
      status: "ativa",
    })
    .select("*")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Conversa IA falhou");
  return created;
}

export async function loadMensagens(conversaId: string): Promise<IaChatMessage[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ia_mensagens")
    .select("role, content")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: true })
    .limit(40);
  return (data ?? []) as IaChatMessage[];
}

export async function saveMensagem(
  conversaId: string,
  role: IaChatMessage["role"],
  content: string,
) {
  const admin = createAdminClient();
  await admin.from("ia_mensagens").insert({ conversa_id: conversaId, role, content });
}

export async function updateConversaLead(
  conversaId: string,
  leadId: string,
  dados: DadosLeadExtraidos,
) {
  const admin = createAdminClient();
  await admin
    .from("ia_conversas")
    .update({
      lead_id: leadId,
      nome_visitante: dados.nome ?? null,
      whatsapp_visitante: dados.whatsapp ?? null,
      interesse_identificado: dados.tipoInteresse ?? null,
      resumo: dados.resumo ?? null,
      status: "lead_criado",
    })
    .eq("id", conversaId);
}
