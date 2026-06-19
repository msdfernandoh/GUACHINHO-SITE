"use client";

import { registrarEventoClient } from "@/lib/eventos/registrar-client";

function waUrl(numero: string, msg: string) {
  const n = numero.replace(/\D/g, "");
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}

type Props = {
  nome: string;
  whatsapp: string | null | undefined;
  produto?: string | null;
  leadId?: string;
  compact?: boolean;
};

export function LeadWhatsappButton({ nome, whatsapp, produto, leadId, compact }: Props) {
  if (!whatsapp?.trim()) return null;
  const produtoTxt = produto?.trim() || "seu interesse";
  const msg = `Olá, ${nome.split(" ")[0] || nome}. Aqui é do Gauchinho Escritório de Soluções Financeiras. Vi sua simulação/interesse em ${produtoTxt} e posso te ajudar com uma análise personalizada.`;
  const href = waUrl(whatsapp, msg);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={
        compact
          ? "text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          : "inline-flex rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
      }
      onClick={() => {
        void registrarEventoClient({
          tipo_evento: "crm_whatsapp_aberto",
          origem: "admin_crm",
          lead_id: leadId,
        });
      }}
    >
      WhatsApp
    </a>
  );
}
