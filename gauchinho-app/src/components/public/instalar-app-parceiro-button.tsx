"use client";

import { Smartphone } from "lucide-react";
import Link from "next/link";

export function InstalarAppParceiroButton({
  dark = false,
  racon = false,
  modelo = "GERADOR_POSSIBILIDADES",
}: {
  dark?: boolean;
  racon?: boolean;
  modelo?: string;
}) {
  return <div className="inline-flex flex-col items-center gap-3">
    <Link
      href={`/parceiros/cadastro?modelo=${encodeURIComponent(modelo)}`}
      className={`inline-flex items-center gap-2 rounded-2xl px-6 py-4 font-black shadow-lg transition hover:scale-[1.02] ${racon ? "bg-white text-blue-700" : dark ? "bg-amber-500 text-zinc-950" : "bg-zinc-950 text-white"}`}
    >
      <Smartphone className="h-5 w-5" />Cadastre-se e baixe o app
    </Link>
    <Link href="/app-indicador/login" className={`inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4 ${dark ? "text-zinc-200" : "text-zinc-700"}`}><Smartphone className="h-4 w-4" />Já tenho acesso — abrir meu app</Link>
    <span className={`inline-flex items-center gap-1 text-xs ${dark ? "text-zinc-300" : "text-zinc-600"}`}><Smartphone className="h-3.5 w-3.5" />Após o cadastro, a instalação fica disponível dentro do seu painel.</span>
  </div>;
}
