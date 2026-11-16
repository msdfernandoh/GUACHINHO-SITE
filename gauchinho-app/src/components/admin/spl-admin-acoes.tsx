"use client";

import { useState } from "react";
import { excluirImobiliariaAction } from "@/app/admin/spl/actions";

/** Copia um texto (link) e mostra "Copiado" por 2 segundos. */
export function CopiarTexto({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard?.writeText(texto).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        })
      }
      className="block text-left text-xs font-semibold text-blue-700 underline"
    >
      {ok ? "Copiado" : rotulo}
    </button>
  );
}

export function ExcluirImobiliaria({ id, nome }: { id: string; nome: string }) {
  return (
    <form
      action={excluirImobiliariaAction}
      onSubmit={(e) => {
        if (!window.confirm(`Excluir "${nome}"? Vendedores e clientes da carteira SPL dela também serão apagados. Os leads do CRM ficam.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-xs font-semibold text-red-600 underline">Excluir imobiliária</button>
    </form>
  );
}
