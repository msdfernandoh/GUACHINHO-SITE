"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import type { InstanciaView, MensagemView } from "@/lib/whatsapp/cloud-api/types";
import { WhatsappConversations } from "./whatsapp-conversations";

export function WhatsappFloatingDock({ instancia, mensagens }: { instancia: InstanciaView; mensagens: MensagemView[] }) {
  const [open, setOpen] = useState(false);
  return <div className="fixed bottom-4 right-4 z-50 w-[min(760px,calc(100vw-2rem))]" data-whatsapp-dock>
    {open ? <div className="h-[min(760px,calc(100dvh-6rem))]"><div className="mb-2 flex justify-end"><button type="button" onClick={() => setOpen(false)} aria-label="Fechar conversas WhatsApp" className="rounded-full bg-slate-900 p-2 text-white shadow-lg"><X size={18} /></button></div><WhatsappConversations instancia={instancia} mensagens={mensagens} compact /></div> : <button type="button" onClick={() => setOpen(true)} aria-label="Abrir conversas WhatsApp" className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl ring-4 ring-white/80"><MessageCircle size={26} /></button>}
  </div>;
}

