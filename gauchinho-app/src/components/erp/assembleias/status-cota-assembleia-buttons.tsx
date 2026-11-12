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
    let valorCredito: number | undefined;
    if (status === "contemplada") {
      const valor = window.prompt(`Informe o valor atualizado do crédito da cota ${numero} (ex.: 100.000,00).`);
      if (valor === null) return;
      const texto = valor.trim();
      const formatoValido = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(texto);
      valorCredito = formatoValido ? Number(texto.replace(/\./g, "").replace(",", ".")) : NaN;
      if (!Number.isFinite(valorCredito) || valorCredito <= 0) {
        setErro("Informe um valor de crédito válido, como 100.000,00.");
        return;
      }
      const valorFormatado = valorCredito.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      if (!window.confirm(`Registrar contemplação por sorteio da cota ${numero} com crédito de ${valorFormatado}, na data da assembleia?`)) return;
    } else if (!window.confirm(`Marcar a cota ${numero} como cancelada e retirar da lista da assembleia?`)) {
      return;
    }
    setErro(null);
    iniciar(async () => {
      try {
        const resultado = await marcarStatusCotaAssembleiaAction(assembleiaId, cotaId, status, valorCredito);
        if (!resultado.ok) setErro(resultado.mensagem ?? "Não foi possível atualizar a cota.");
      } catch {
        setErro("Não foi possível atualizar a cota. Recarregue a página e confira a situação antes de tentar novamente.");
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
