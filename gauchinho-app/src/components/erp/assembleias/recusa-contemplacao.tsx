"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2, XCircle } from "lucide-react";
import { desfazerRecusaContemplacaoAction, registrarRecusaContemplacaoAction } from "@/app/erp/assembleias/actions";

export function RecusaContemplacao({ grupoId, cota, data, modalidade, recusaId }: { grupoId: string; cota: string; data: string; modalidade: string | null; recusaId: string | null }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  function recusar() {
    if (!confirm(`Registrar que o cliente da cota ${cota} não pagou o lance? A cota volta a concorrer normalmente nas próximas assembleias.`)) return;
    iniciar(async () => {
      const r = await registrarRecusaContemplacaoAction(grupoId, cota, data.slice(0, 10), modalidade);
      setMsg({ ok: r.ok, t: r.mensagem }); if (r.ok) router.refresh();
    });
  }
  function desfazer() {
    iniciar(async () => {
      const r = await desfazerRecusaContemplacaoAction(recusaId!);
      setMsg({ ok: r.ok, t: r.mensagem }); if (r.ok) router.refresh();
    });
  }
  return (
    <div className="flex flex-col items-start gap-1">
      {recusaId ? (
        <button disabled={pendente} onClick={desfazer} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Undo2 size={14} />Desfazer recusa</button>
      ) : (
        <button disabled={pendente} onClick={recusar} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"><XCircle size={14} />Cliente recusou</button>
      )}
      {msg && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.t}</span>}
    </div>
  );
}
