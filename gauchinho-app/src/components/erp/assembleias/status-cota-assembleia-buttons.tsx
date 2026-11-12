"use client";

import { useState, useTransition } from "react";
import { marcarStatusCotaAssembleiaAction } from "@/app/erp/assembleias/actions";

export function StatusCotaAssembleiaButtons({ assembleiaId, cotaId, numero }: {
  assembleiaId: string;
  cotaId: string;
  numero: number;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function marcar(status: "cancelada" | "contemplada") {
    if (!window.confirm(`Marcar a cota ${numero} como ${status} e retirar da lista da assembleia?`)) return;
    setErro(null);
    iniciar(async () => {
      try {
        await marcarStatusCotaAssembleiaAction(assembleiaId, cotaId, status);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Não foi possível atualizar a cota.");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pendente} onClick={() => marcar("cancelada")} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50">
        Cancelada
      </button>
      <button type="button" disabled={pendente} onClick={() => marcar("contemplada")} className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
        Contemplada
      </button>
      {erro && <p role="alert" className="w-full text-xs text-red-800">{erro}</p>}
    </div>
  );
}
