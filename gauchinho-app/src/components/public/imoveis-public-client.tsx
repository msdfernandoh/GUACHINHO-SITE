"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ImobiliariaPublicCard } from "@/components/public/imobiliaria-public-card";
import type { ImobiliariaPublic } from "@/lib/imobiliarias/public-card-utils";
import type { ImovelPublic } from "@/lib/imoveis/types";
import { IMOVEL_STATUS, IMOVEL_TIPOS } from "@/lib/imoveis/types";
import { MessageCircle, Calculator, MapPin } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";

type Filters = {
  tipo?: string;
  cidade?: string;
  bairro?: string;
  imobiliaria_id?: string;
  status?: string;
  destaque?: string;
  valorPublico?: string;
  valorMin?: string;
  valorMax?: string;
  q?: string;
};

export function ImoveisPublicClient({
  imoveis,
  parceiras,
  whatsappFallback,
}: {
  imoveis: ImovelPublic[];
  parceiras: ImobiliariaPublic[];
  whatsappFallback?: string | null;
}) {
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<ImovelPublic | null>(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cidade, setCidade] = useState("");
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);

  const imoveisPorImob = useMemo(() => {
    const m = new Map<string, number>();
    imoveis.forEach((i) => m.set(i.imobiliaria_id, (m.get(i.imobiliaria_id) ?? 0) + 1));
    return m;
  }, [imoveis]);

  const cidades = useMemo(() => {
    const s = new Set<string>();
    imoveis.forEach((i) => {
      if (i.cidade) s.add(i.cidade);
    });
    return [...s].sort();
  }, [imoveis]);

  const filtered = useMemo(() => {
    let list = [...imoveis];
    if (filters.tipo) list = list.filter((i) => i.tipo_imovel === filters.tipo);
    if (filters.cidade) list = list.filter((i) => i.cidade === filters.cidade);
    if (filters.bairro) list = list.filter((i) => i.bairro?.toLowerCase().includes(filters.bairro!.toLowerCase()));
    if (filters.imobiliaria_id) list = list.filter((i) => i.imobiliaria_id === filters.imobiliaria_id);
    if (filters.status) list = list.filter((i) => i.status === filters.status);
    if (filters.destaque === "sim") list = list.filter((i) => i.destaque);
    if (filters.valorPublico === "sim") list = list.filter((i) => i.exibir_valor_publico);
    if (filters.valorPublico === "nao") list = list.filter((i) => !i.exibir_valor_publico);
    const vMin = parseNum(filters.valorMin);
    const vMax = parseNum(filters.valorMax);
    if (vMin != null) list = list.filter((i) => (i.valor ?? 0) >= vMin);
    if (vMax != null) list = list.filter((i) => (i.valor ?? Infinity) <= vMax);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(
        (i) =>
          i.titulo.toLowerCase().includes(q) ||
          i.cidade?.toLowerCase().includes(q) ||
          i.imobiliaria_nome.toLowerCase().includes(q),
      );
    }
    return list;
  }, [imoveis, filters]);

  async function submitInteresse() {
    if (!modal) return;
    setLoading(true);
    setMsg(null);
    setWaLink(null);
    try {
      const res = await fetch("/api/public/imoveis/interesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imovelId: modal.id,
          nome,
          whatsapp,
          cidade: cidade || undefined,
          email: email || undefined,
          mensagem: mensagem || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha");
      setMsg("Interesse registrado com sucesso.");
      if (data.whatsappLink) setWaLink(data.whatsappLink as string);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  function simularUrl(imovel: ImovelPublic) {
    const params = new URLSearchParams({
      origem: "oportunidade_imobiliaria",
      tipo: "imovel",
      imovel_id: imovel.id,
    });
    if (imovel.exibir_valor_publico && imovel.valor != null) {
      params.set("valor", String(imovel.valor));
    }
    return `/simulador?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-500">Gauchinho</p>
        <h1 className="mt-2 text-4xl font-bold text-white md:text-5xl">Oportunidades imobiliárias</h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Imóveis selecionados de parceiros. Demonstre interesse e fale direto com a imobiliária.
        </p>

        <div className="mt-8 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 md:grid-cols-3 lg:grid-cols-4">
          <FilterSelect
            label="Tipo"
            value={filters.tipo ?? ""}
            onChange={(v) => setFilters((f) => ({ ...f, tipo: v || undefined }))}
            options={[{ value: "", label: "Todos" }, ...IMOVEL_TIPOS.map((t) => ({ value: t.value, label: t.label }))]}
          />
          <FilterSelect
            label="Cidade"
            value={filters.cidade ?? ""}
            onChange={(v) => setFilters((f) => ({ ...f, cidade: v || undefined }))}
            options={[{ value: "", label: "Todas" }, ...cidades.map((c) => ({ value: c, label: c }))]}
          />
          <div>
            <Label className="text-zinc-400">Bairro</Label>
            <Input
              className="mt-1 border-zinc-700 bg-zinc-950"
              value={filters.bairro ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, bairro: e.target.value || undefined }))}
              placeholder="Bairro"
            />
          </div>
          <FilterSelect
            label="Imobiliária"
            value={filters.imobiliaria_id ?? ""}
            onChange={(v) => setFilters((f) => ({ ...f, imobiliaria_id: v || undefined }))}
            options={[
              { value: "", label: "Todas" },
              ...parceiras.map((p) => ({ value: p.id, label: p.nome })),
            ]}
          />
          <FilterSelect
            label="Valor"
            value={filters.valorPublico ?? ""}
            onChange={(v) => setFilters((f) => ({ ...f, valorPublico: v || undefined }))}
            options={[
              { value: "", label: "Todos" },
              { value: "sim", label: "Valor público" },
              { value: "nao", label: "Sob consulta" },
            ]}
          />
          <div>
            <Label className="text-zinc-400">Busca</Label>
            <Input
              className="mt-1 border-zinc-700 bg-zinc-950"
              placeholder="Título, cidade..."
              value={filters.q ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value || undefined }))}
            />
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((imovel) => (
            <ImovelCard
              key={imovel.id}
              imovel={imovel}
              onInteresse={() => {
                setModal(imovel);
                setMsg(null);
                setWaLink(null);
              }}
              simularHref={simularUrl(imovel)}
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="mt-12 text-center text-zinc-500">Nenhum imóvel encontrado com os filtros atuais.</p>
        )}

        <section className="mt-16 border-t border-zinc-800 pt-12">
          <h2 className="text-xl font-semibold text-amber-400">Imobiliárias parceiras</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Conheça quem comercializa os imóveis — fale direto ou veja o portfólio completo.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {parceiras.map((p) => (
              <ImobiliariaPublicCard
                key={p.id}
                imob={p}
                variant="grid"
                whatsappFallback={whatsappFallback}
                imoveisCount={imoveisPorImob.get(p.id) ?? 0}
              />
            ))}
          </div>
        </section>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-amber-400">Tenho interesse</h3>
            <p className="mt-1 text-sm text-zinc-400">{modal.titulo}</p>
            {!waLink ? (
              <div className="mt-4 space-y-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
                <div>
                  <Label>WhatsApp</Label>
                  <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required />
                </div>
                <div>
                  <Label>Cidade (opcional)</Label>
                  <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
                </div>
                <div>
                  <Label>E-mail (opcional)</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Mensagem (opcional)</Label>
                  <Input value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" onClick={() => setModal(null)} variant="outline">
                    Cancelar
                  </Button>
                  <Button type="button" disabled={loading} onClick={submitInteresse}>
                    {loading ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {msg && <p className="text-sm text-emerald-400">{msg}</p>}
                <a href={waLink} target="_blank" rel="noreferrer">
                  <Button type="button" className="w-full gap-2">
                    <MessageCircle className="h-4 w-4" /> Chamar no WhatsApp
                  </Button>
                </a>
                <Button type="button" variant="outline" className="w-full" onClick={() => setModal(null)}>
                  Fechar
                </Button>
              </div>
            )}
            {msg && !waLink && <p className="mt-2 text-sm text-red-400">{msg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function ImovelCard({
  imovel,
  onInteresse,
  simularHref,
}: {
  imovel: ImovelPublic;
  onInteresse: () => void;
  simularHref: string;
}) {
  const tipo = IMOVEL_TIPOS.find((t) => t.value === imovel.tipo_imovel)?.label ?? imovel.tipo_imovel;
  const status = IMOVEL_STATUS.find((s) => s.value === imovel.status)?.label ?? imovel.status;
  const valorLabel =
    imovel.exibir_valor_publico && imovel.valor != null
      ? formatCurrency(Number(imovel.valor))
      : "Valor sob consulta";

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="relative aspect-[4/3] bg-zinc-800">
        {imovel.foto_principal_url ? (
          <Image src={imovel.foto_principal_url} alt="" fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600">
            <MapPin className="h-12 w-12" />
          </div>
        )}
        {imovel.destaque && (
          <span className="absolute left-2 top-2 rounded bg-amber-500 px-2 py-0.5 text-xs font-semibold text-zinc-950">
            Destaque
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs text-amber-500/90">{imovel.imobiliaria_nome}</p>
        <h3 className="mt-1 font-semibold leading-snug">
          <Link href={`/oportunidades-imobiliarias/imovel/${imovel.slug}`} className="hover:text-amber-400">
            {imovel.titulo}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          {tipo} · {imovel.cidade}
          {imovel.bairro ? ` · ${imovel.bairro}` : ""}
        </p>
        <p className="mt-2 text-lg font-bold text-amber-400">{valorLabel}</p>
        <p className="text-xs text-zinc-500">{status}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onInteresse}>
            Tenho interesse
          </Button>
          {imovel.exibir_valor_publico && imovel.valor != null && (
            <Link href={simularHref}>
              <Button type="button" size="sm" variant="outline" className="gap-1">
                <Calculator className="h-3 w-3" /> Simular compra
              </Button>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <Label className="text-zinc-400">{label}</Label>
      <Select className="mt-1 border-zinc-700 bg-zinc-950" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function parseNum(s?: string) {
  if (!s?.trim()) return null;
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
