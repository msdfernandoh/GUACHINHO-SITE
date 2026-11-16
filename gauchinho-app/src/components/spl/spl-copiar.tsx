"use client";

import { useState } from "react";

export function BotaoCopiar({ texto, rotulo = "Copiar link" }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(texto).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        });
      }}
      className="rounded-xl border-2 border-[#153E90] bg-white px-4 py-3 text-base font-bold text-[#153E90]"
    >
      {ok ? "Copiado" : rotulo}
    </button>
  );
}
