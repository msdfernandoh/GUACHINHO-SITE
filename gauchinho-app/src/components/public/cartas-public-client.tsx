"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, MessageCircle } from "lucide-react";
import type { CartaContemplada } from "@/lib/cartas/types";
import { CARTA_STATUS_LABELS, CARTA_TIPOS } from "@/lib/cartas/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button, Input, Label, Select, surfaceInputDark } from "@/components/ui/form-primitives";
import {
  buildCartaInteresseMensagem,
  type WhatsappOrigemRow,
} from "@/lib/whatsapp/carta-messages";
import { MascoteGauchinho } from "@/components/public/mascote-gauchinho";

type Filters = {
  tipo?: string;
  administradora?: string;
  creditoMin?: string;
  creditoMax?: string;
  entradaMin?: string;
  entradaMax?: string;
  status?: string;
  sort?: string;
};

export function CartasPublicClient({ cartas }: { cartas: CartaContemplada[] }) {
  const [filters, setFilters] = useState<Filters>({ sort: "recentes" });
  const [modalCarta, setModalCarta] = useState<CartaContemplada | null>(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cidade, setCidade] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);

  const administradoras = useMemo(() => {
    const set = new Set<string>();
    cartas.forEach((c) => {
      if (c.administradora) set.add(c.administradora);
    });
    return Array.from(set).sort();
  }, [cartas]);

  const filtered = useMemo(() => {
    let list = [...cartas];
    if (filters.tipo) list = list.filter((c) => c.tipo_carta === filters.tipo);
    if (filters.administradora) {
      list = list.filter((c) => c.administradora === filters.administradora);
    }
    if (filters.status) list = list.filter((c) => c.status === filters.status);
    const cMin = parseNum(filters.creditoMin);
    const cMax = parseNum(filters.creditoMax);
    const eMin = parseNum(filters.entradaMin);
    const eMax = parseNum(filters.entradaMax);
    if (cMin != null) list = list.filter((c) => (c.credito ?? 0) >= cMin);
    if (cMax != null) list = list.filter((c) => (c.credito ?? 0) <= cMax);
    if (eMin != null) list = list.filter((c) => (c.entrada ?? 0) >= eMin);
    if (eMax != null) list = list.filter((c) => (c.entrada ?? 0) <= eMax);

    const sort = filters.sort ?? "recentes";
    if (sort === "menor_entrada") {
      list.sort((a, b) => (a.entrada ?? Infinity) - (b.entrada ?? Infinity));
    } else if (sort === "maior_credito") {
      list.sort((a, b) => (b.credito ?? 0) - (a.credito ?? 0));
    } else {
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return list;
  }, [cartas, filters]);

  async function submitInteresse() {
    if (!modalCarta) return;
    setLoading(true);
    setMsg(null);
    setWaLink(null);
    try {
      const res = await fetch("/api/public/cartas/interesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartaId: modalCarta.id,
          nome,
          whatsapp,
          cidade: cidade || undefined,
          email: email || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha");
      setMsg("Interesse registrado. Em breve entraremos em contato.");
      const wa = data.whatsappOrigem as WhatsappOrigemRow | null;
      if (wa?.exibir_botao_apos_lead && wa.whatsapp_destino) {
        const tipoLabel = modalCarta.tipo_carta === "automovel" ? "Automóvel" : "Imóvel";
        const text = buildCartaInteresseMensagem({
          tipoLabel,
          credito: modalCarta.credito,
          nome,
          mensagemPadrao: wa.mensagem_padrao,
        });
        setWaLink(`https://wa.me/${wa.whatsapp_destino.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed bottom-24 right-4 z-30 hidden opacity-80 sm:block">
        <MascoteGauchinho variant="floating" />
      </div>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-500">
            <Sparkles className="mr-1 inline h-4 w-4" />
            Gauchinho
          </p>
          <h1 className="mt-2 text-4xl font-bold text-white">Cartas Contempladas</h1>
          <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
            Oportunidades de crédito já contemplado. Confira os valores e manifeste seu interesse — sempre
            consulte a disponibilidade atualizada com nossa equipe.
          </p>
        </div>

        <div className="mb-8 grid gap-3 rounded-2xl border border-amber-500/20 bg-zinc-900/80 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-zinc-400">Tipo</Label>
            <Select
              value={filters.tipo ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, tipo: e.target.value || undefined }))}
            >
              <option value="">Todos</option>
              {CARTA_TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-zinc-400">Administradora</Label>
            <Select
              value={filters.administradora ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, administradora: e.target.value || undefined }))}
            >
              <option value="">Todas</option>
              {administradoras.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-zinc-400">Status</Label>
            <Select
              value={filters.status ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}
            >
              <option value="">Todos</option>
              <option value="disponivel">{CARTA_STATUS_LABELS.disponivel}</option>
              <option value="consultar_disponibilidade">{CARTA_STATUS_LABELS.consultar_disponibilidade}</option>
            </Select>
          </div>
          <div>
            <Label className="text-zinc-400">Ordenar</Label>
            <Select
              value={filters.sort ?? "recentes"}
              onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
            >
              <option value="recentes">Mais recentes</option>
              <option value="menor_entrada">Menor entrada</option>
              <option value="maior_credito">Maior crédito</option>
            </Select>
          </div>
          <div>
            <Label className="text-zinc-400">Crédito mín.</Label>
            <Input
              placeholder="0"
              value={filters.creditoMin ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, creditoMin: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-zinc-400">Crédito máx.</Label>
            <Input
              value={filters.creditoMax ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, creditoMax: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-zinc-400">Entrada mín.</Label>
            <Input
              value={filters.entradaMin ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, entradaMin: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-zinc-400">Entrada máx.</Label>
            <Input
              value={filters.entradaMax ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, entradaMax: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <article
              key={c.id}
              className={cn(
                "flex flex-col rounded-2xl border border-amber-500/25 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-lg shadow-black/40",
                c.destaque && "ring-2 ring-amber-400/60",
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                    {c.tipo_carta === "automovel" ? "Automóvel" : "Imóvel"}
                  </p>
                  <h2 className="text-lg font-bold text-white">{c.administradora ?? "Administradora"}</h2>
                </div>
                {c.destaque ? (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Destaque</span>
                ) : null}
              </div>
              <dl className="flex-1 space-y-2 text-sm">
                <div className="flex justify-between border-b border-zinc-800 py-1">
                  <dt className="text-zinc-500">Crédito</dt>
                  <dd className="font-semibold text-amber-400">{formatCurrency(c.credito)}</dd>
                </div>
                <div className="flex justify-between border-b border-zinc-800 py-1">
                  <dt className="text-zinc-500">Entrada</dt>
                  <dd className="font-semibold text-white">{formatCurrency(c.entrada)}</dd>
                </div>
                <div className="flex justify-between border-b border-zinc-800 py-1">
                  <dt className="text-zinc-500">Prazo</dt>
                  <dd>{c.prazo_quantidade ? `${c.prazo_quantidade}x` : "—"}</dd>
                </div>
                <div className="flex justify-between border-b border-zinc-800 py-1">
                  <dt className="text-zinc-500">Parcela</dt>
                  <dd>{formatCurrency(c.valor_parcela)}</dd>
                </div>
                <div className="flex justify-between border-b border-zinc-800 py-1">
                  <dt className="text-zinc-500">Saldo devedor</dt>
                  <dd>{formatCurrency(c.saldo_devedor)}</dd>
                </div>
                <div className="flex justify-between border-b border-zinc-800 py-1">
                  <dt className="text-zinc-500">Próxima parcela</dt>
                  <dd>{formatDate(c.proxima_parcela_data)}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-zinc-500">Taxa transferência</dt>
                  <dd>{formatCurrency(c.taxa_transferencia)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-zinc-500">
                Status: {CARTA_STATUS_LABELS[c.status]}
              </p>
              <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-200">
                Consulte disponibilidade
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button variant="gold" className="w-full" onClick={() => setModalCarta(c)}>
                  Tenho interesse
                </Button>
                <Link
                  href="/simulador"
                  className="text-center text-xs text-zinc-500 underline hover:text-amber-400"
                >
                  Simular estratégia
                </Link>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-12 text-center text-zinc-500">Nenhuma carta disponível com os filtros atuais.</p>
        ) : null}
      </div>

      {modalCarta ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-zinc-900 p-6">
            <h3 className="text-lg font-bold text-white">Tenho interesse</h3>
            <p className="mt-1 text-sm text-zinc-400">
              {modalCarta.administradora} — {formatCurrency(modalCarta.credito)}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} required className={surfaceInputDark} />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required className={surfaceInputDark} />
              </div>
              <div>
                <Label>Cidade (opcional)</Label>
                <Input value={cidade} onChange={(e) => setCidade(e.target.value)} className={surfaceInputDark} />
              </div>
              <div>
                <Label>E-mail (opcional)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={surfaceInputDark} />
              </div>
            </div>
            {msg ? <p className="mt-3 text-sm text-amber-200">{msg}</p> : null}
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white"
              >
                <MessageCircle className="h-4 w-4" />
                Chamar no WhatsApp
              </a>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Button variant="gold" disabled={loading || !nome.trim() || !whatsapp.trim()} onClick={submitInteresse}>
                {loading ? "Enviando…" : "Confirmar"}
              </Button>
              <Button variant="outline" onClick={() => setModalCarta(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseNum(raw?: string): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
