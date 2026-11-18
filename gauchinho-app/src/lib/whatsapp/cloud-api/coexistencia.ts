import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
/** Números vindos da Meta já trazem o DDI: só limpar e validar. */
function numeroDaMeta(v: string | null | undefined) {
  const d = String(v ?? "").replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(d) ? d : null;
}

/** Webhook `history`: conversas antigas do WhatsApp Business do celular, em blocos. */
export type HistoricoBloco = {
  metadata?: { phase?: number; chunk_order?: number; progress?: number };
  threads?: {
    id?: string;
    messages?: { id?: string; from?: string; to?: string; timestamp?: string; type?: string; text?: { body?: string }; history_context?: { status?: string; from_me?: boolean } }[];
  }[];
};

/** Webhook `smb_app_state_sync`: contatos salvos no WhatsApp Business do celular. */
export type ContatoSync = { type?: string; action?: string; contact?: { full_name?: string; first_name?: string; phone_number?: string } };

type Dono = { id: string; empresa_id: string };

const STATUS: Record<string, string> = { read: "read", played: "read", delivered: "delivered", sent: "sent", pending: "sent", error: "failed" };

export function linhasDoHistorico(i: Dono, blocos: HistoricoBloco[]) {
  return blocos.flatMap((b) =>
    (b.threads ?? []).flatMap((t) => {
      const contato = numeroDaMeta(t.id);
      if (!contato) return [];
      return (t.messages ?? []).flatMap((m) => {
        if (!m.id) return [];
        // Na conversa, o que não veio do contato foi enviado pela empresa no celular.
        const recebida = m.history_context?.from_me === true ? false : numeroDaMeta(m.from) === contato;
        const quando = Number(m.timestamp) > 0 ? new Date(Number(m.timestamp) * 1000).toISOString() : undefined;
        return [{
          empresa_id: i.empresa_id, instancia_id: i.id, direcao: recebida ? "recebida" : "enviada", wa_message_id: m.id, contato_numero: contato,
          tipo: m.type || "text", conteudo: m.text?.body?.slice(0, 4096) || null,
          status: recebida ? "received" : (STATUS[String(m.history_context?.status ?? "").toLowerCase()] ?? "sent"),
          ...(quando ? { criada_em: quando } : {}),
        }];
      });
    }),
  );
}

export async function gravarHistorico(i: Dono, blocos: HistoricoBloco[]) {
  const linhas = linhasDoHistorico(i, blocos);
  const db = createAdminClient();
  for (let n = 0; n < linhas.length; n += 500) {
    const { error } = await db.from("whatsapp_mensagens").upsert(linhas.slice(n, n + 500), { onConflict: "wa_message_id", ignoreDuplicates: true });
    if (error) throw new Error("historico");
  }
}

export function linhasDeContatos(i: Dono, itens: ContatoSync[]) {
  const porNumero = new Map<string, { empresa_id: string; instancia_id: string; numero: string; nome: string | null; ativo: boolean; updated_at: string }>();
  for (const s of itens) {
    const numero = s.type === "contact" ? numeroDaMeta(s.contact?.phone_number) : null;
    if (!numero) continue;
    porNumero.set(numero, {
      empresa_id: i.empresa_id, instancia_id: i.id, numero, nome: (s.contact?.full_name || s.contact?.first_name || "").trim().slice(0, 200) || null,
      ativo: s.action !== "remove", updated_at: new Date().toISOString(),
    });
  }
  return [...porNumero.values()];
}

export async function gravarContatosDoApp(i: Dono, itens: ContatoSync[]) {
  const linhas = linhasDeContatos(i, itens);
  const db = createAdminClient();
  for (let n = 0; n < linhas.length; n += 500) {
    const { error } = await db.from("whatsapp_contatos").upsert(linhas.slice(n, n + 500), { onConflict: "instancia_id,numero" });
    if (error) throw new Error("contatos");
  }
}
