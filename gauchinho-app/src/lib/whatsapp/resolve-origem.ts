import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CONTATO, getConfigJsonPublic } from "@/server/config";
import {
  buildCartaInteresseMensagem,
  type WhatsappOrigemRow,
} from "@/lib/whatsapp/carta-messages";

export type { WhatsappOrigemRow };
export { buildCartaInteresseMensagem };
export async function resolveWhatsappOrigem(
  origemKey: string,
): Promise<WhatsappOrigemRow | null> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("whatsapp_origens")
    .select("*")
    .eq("origem", origemKey)
    .eq("ativo", true)
    .maybeSingle();

  if (!row) return null;

  let destino = row.whatsapp_destino as string | null;
  if (!destino?.trim() && row.usar_whatsapp_principal_fallback) {
    const contato = await getConfigJsonPublic("contato", DEFAULT_CONTATO);
    destino = contato.whatsappPrincipal?.trim() || null;
  }

  if (!destino?.trim()) return null;

  return {
    origem: String(row.origem),
    ativo: !!row.ativo,
    exibir_botao_apos_lead: row.exibir_botao_apos_lead !== false,
    nome_atendimento: (row.nome_atendimento as string) ?? null,
    whatsapp_destino: destino,
    mensagem_padrao: (row.mensagem_padrao as string) ?? null,
    usar_whatsapp_principal_fallback: row.usar_whatsapp_principal_fallback !== false,
  };
}

