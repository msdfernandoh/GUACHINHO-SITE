"use client";

import { useState, useTransition } from "react";
import { converterLeadParaErpAction } from "@/app/admin/leads/actions";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/form-primitives";

export function CrmSendToErpButton({
  leadId,
  leadNome,
}: {
  leadId: string;
  leadNome: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSend() {
    if (!confirm(`Deseja enviar o lead “${leadNome}” para formalização no ERP?`)) return;

    setError(null);
    setFeedback(null);

    startTransition(async () => {
      try {
        const res = await converterLeadParaErpAction(leadId);
        setFeedback("Lead enviado! Redirecionando para a proposta no ERP...");
        if (res.redirectUrl) {
          window.location.href = res.redirectUrl;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao enviar para o ERP");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={handleSend}
        disabled={isPending}
        className="flex items-center gap-1.5 bg-emerald-600 text-xs font-semibold text-white shadow hover:bg-emerald-500"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        {isPending ? "Processando..." : "Enviar para ERP"}
      </Button>
      {feedback && <p className="text-[10px] text-emerald-400">{feedback}</p>}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
