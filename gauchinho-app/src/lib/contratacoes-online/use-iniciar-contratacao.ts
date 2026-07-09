"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContratacaoModo, ContratacaoOrigem } from "@/lib/contratacoes-online/types";
import { ensureAbsolutePropostaUrl } from "@/lib/url/public-url";

export type IniciarContratacaoResult = {
  public_token: string;
  protocolo: string;
  url: string;
  path: string;
};

export function useIniciarContratacao() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const iniciar = useCallback(
    async (opts: {
      modo: ContratacaoModo;
      origem: ContratacaoOrigem;
      dados_simulacao: Record<string, unknown>;
      cliente_pre_nome?: string;
      cliente_pre_telefone?: string;
      cliente_pre_email?: string;
      redirectCliente?: boolean;
    }): Promise<IniciarContratacaoResult | null> => {
      setLoading(true);
      try {
        const res = await fetch("/api/public/contratacoes/iniciar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modo: opts.modo,
            origem: opts.origem,
            dados_simulacao: opts.dados_simulacao,
            cliente_pre_nome: opts.cliente_pre_nome,
            cliente_pre_telefone: opts.cliente_pre_telefone,
            cliente_pre_email: opts.cliente_pre_email,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha ao criar proposta");
        const raw = data as IniciarContratacaoResult & { ok: boolean };
        const result: IniciarContratacaoResult = {
          public_token: raw.public_token,
          protocolo: raw.protocolo,
          path: raw.path || `/proposta/${raw.public_token}`,
          url: ensureAbsolutePropostaUrl(raw.url || raw.path, raw.public_token),
        };
        if (opts.redirectCliente !== false && opts.modo === "cliente_site") {
          router.push(result.path);
        }
        return result;
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  return { iniciar, loading };
}
