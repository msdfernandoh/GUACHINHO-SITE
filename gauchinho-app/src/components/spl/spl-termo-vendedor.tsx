"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ModeloVendedor } from "@/lib/spl/types";
import { SplTermoCaixa } from "./spl-termo";
import { Aviso, BotaoGrande, Cartao } from "./spl-ui";

export function SplTermoVendedor({ codigo, acesso, modelo, termo }: {
  codigo: string;
  acesso: string;
  modelo: ModeloVendedor;
  termo: { texto: string; versao: string };
}) {
  const router = useRouter();
  const [aceito, setAceito] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function registrar() {
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/public/spl/vendedor/termo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, acesso, modelo, aceito, versao: termo.versao }),
      });
      const resposta = await res.json();
      if (!res.ok) throw new Error(resposta.error ?? "Não foi possível registrar o aceite.");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar o aceite.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao className="space-y-4 border-2 border-amber-300">
      <h2 className="text-xl font-black text-[#0A1931]">Termo de parceria do vendedor</h2>
      <SplTermoCaixa texto={termo.texto} versao={termo.versao} aceito={aceito} onAceito={setAceito} preenchido={false} />
      {erro && <Aviso>{erro}</Aviso>}
      <BotaoGrande tipo="ouro" disabled={!aceito || salvando} onClick={registrar}>
        {salvando ? "Registrando…" : "Registrar meu aceite"}
      </BotaoGrande>
    </Cartao>
  );
}
