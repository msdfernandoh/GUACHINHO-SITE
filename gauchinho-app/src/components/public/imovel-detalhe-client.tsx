"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MessageCircle, Calculator } from "lucide-react";
import type { ImovelPublic } from "@/lib/imoveis/types";
import { IMOVEL_TIPOS, IMOVEL_STATUS } from "@/lib/imoveis/types";
import type { ImobiliariaPublic } from "@/lib/imobiliarias/public-card-utils";
import { ImobiliariaInfoPanel } from "@/components/public/imobiliaria-public-card";
import { formatCurrency } from "@/lib/utils/format";
import { Button, Input, Label } from "@/components/ui/form-primitives";

export function ImovelDetalheClient({
  imovel,
  imobiliaria,
  whatsappFallback,
}: {
  imovel: ImovelPublic;
  imobiliaria: ImobiliariaPublic | null;
  whatsappFallback?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const tipo = IMOVEL_TIPOS.find((t) => t.value === imovel.tipo_imovel)?.label ?? imovel.tipo_imovel;
  const status = IMOVEL_STATUS.find((s) => s.value === imovel.status)?.label ?? imovel.status;
  const valorLabel =
    imovel.exibir_valor_publico && imovel.valor != null
      ? formatCurrency(Number(imovel.valor))
      : "Valor sob consulta";

  const simularHref = (() => {
    const params = new URLSearchParams({
      origem: "oportunidade_imobiliaria",
      tipo: "imovel",
      imovel_id: imovel.id,
    });
    if (imovel.exibir_valor_publico && imovel.valor != null) {
      params.set("valor", String(imovel.valor));
    }
    return `/simulador?${params.toString()}`;
  })();

  async function submit() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/public/imoveis/interesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imovelId: imovel.id, nome, whatsapp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha");
      setMsg("Interesse registrado.");
      if (data.whatsappLink) setWaLink(data.whatsappLink);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link href="/oportunidades-imobiliarias" className="text-sm text-zinc-500 hover:text-amber-400">
          ← Oportunidades
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-3 lg:items-start">
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-zinc-800">
              <div className="relative aspect-[16/10] bg-zinc-800">
                {imovel.foto_principal_url ? (
                  <Image src={imovel.foto_principal_url} alt="" fill className="object-cover" priority />
                ) : null}
              </div>
              <div className="p-6 md:p-8">
                <p className="text-sm text-amber-500">{imovel.imobiliaria_nome}</p>
                <h1 className="mt-1 text-3xl font-bold">{imovel.titulo}</h1>
                <p className="mt-2 text-zinc-400">
                  {tipo} · {imovel.cidade}
                  {imovel.bairro ? ` · ${imovel.bairro}` : ""} · {status}
                </p>
                <p className="mt-4 text-2xl font-bold text-amber-400">{valorLabel}</p>
                {imovel.descricao_curta && <p className="mt-4 text-zinc-300">{imovel.descricao_curta}</p>}
                {imovel.descricao_completa && (
                  <div className="prose prose-invert mt-6 max-w-none text-sm">{imovel.descricao_completa}</div>
                )}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button type="button" variant="gold" onClick={() => setOpen(true)}>
                    Tenho interesse
                  </Button>
                  {imovel.exibir_valor_publico && imovel.valor != null && (
                    <Link href={simularHref}>
                      <Button type="button" variant="outline" className="gap-2 border-zinc-600 bg-zinc-900 text-zinc-100">
                        <Calculator className="h-4 w-4" /> Simular compra
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>

          {imobiliaria ? (
            <div className="lg:sticky lg:top-24">
              <ImobiliariaInfoPanel imob={imobiliaria} whatsappFallback={whatsappFallback} />
            </div>
          ) : null}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6">
            {!waLink ? (
              <>
                <Label>Nome</Label>
                <Input className="mb-3 border-zinc-700 bg-zinc-950" value={nome} onChange={(e) => setNome(e.target.value)} />
                <Label>WhatsApp</Label>
                <Input className="mb-3 border-zinc-700 bg-zinc-950" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="outline" className="border-zinc-600 bg-zinc-900 text-zinc-100" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button variant="gold" disabled={loading} onClick={submit}>
                    Enviar
                  </Button>
                </div>
                {msg && <p className="mt-2 text-sm text-red-400">{msg}</p>}
              </>
            ) : (
              <>
                <p className="text-emerald-400">{msg}</p>
                <a href={waLink} target="_blank" rel="noreferrer" className="mt-4 block">
                  <Button variant="gold" className="w-full gap-2">
                    <MessageCircle className="h-4 w-4" /> Chamar no WhatsApp
                  </Button>
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
