"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  confirmarGanhadorTelaoAction,
  type TelaoData,
} from "@/app/(public)/eventos/[slug]/telao/telao-actions";
import {
  codigosParaAnimacao,
  escolherParticipanteAleatorio,
  type ParticipanteElegivel,
} from "@/lib/eventos-sorteio/sorteio";
import { useTenantBrand } from "@/components/tenant/tenant-brand-context";
import { formatWhatsappBrInput } from "@/lib/utils/format";

type Props = {
  data: TelaoData;
};

export function SorteioTelaoClient({ data }: Props) {
  const tenantBrand = useTenantBrand();
  const [participantes, setParticipantes] = useState(data.participantesElegiveis);
  const [premios, setPremios] = useState(data.premios);
  const [ganhadores, setGanhadores] = useState(data.ganhadores);
  const [premioSelecionadoId, setPremioSelecionadoId] = useState<string>(
    data.premios.find((p) => p.status === "pendente")?.id ?? "",
  );

  const [spinCode, setSpinCode] = useState<string>("···");
  const [spinning, setSpinning] = useState(false);
  const [vencedorSorteado, setVencedorSorteado] = useState<{
    id: string;
    codigo: string;
    nome: string;
    telefone: string;
  } | null>(null);

  const [fullscreen, setFullscreen] = useState(false);
  const [pending, startTransition] = useTransition();

  const logo = data.logoPersonalizadoUrl || tenantBrand.logoUrl;
  const primaryColor = data.corPrimaria || tenantBrand.corPrimaria || "#0066cc";
  const brandNome = tenantBrand.nome || "Consórcios";

  const premioAtual = premios.find((p) => p.id === premioSelecionadoId) ?? null;

  // Alterna tela cheia do navegador
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Roda a roleta do sorteio
  const handleSortear = () => {
    if (participantes.length === 0 || spinning || pending) return;

    const elegiveis: ParticipanteElegivel[] = participantes.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      telefone: p.telefone,
      status: "participando" as const,
      ganhador: false,
    }));

    const vencedor = escolherParticipanteAleatorio(elegiveis);
    if (!vencedor) return;

    setVencedorSorteado(null);
    setSpinning(true);

    const seq = codigosParaAnimacao(elegiveis, vencedor.codigo, 32);
    let i = 0;
    const tickMs = 110;

    const interval = setInterval(() => {
      setSpinCode(seq[i] ?? vencedor.codigo);
      i += 1;
      if (i >= seq.length) {
        clearInterval(interval);
        setSpinning(false);
        setSpinCode(vencedor.codigo);
        setVencedorSorteado(vencedor);
      }
    }, tickMs);
  };

  // Confirma o ganhador no banco e vincula ao prêmio
  const handleConfirmarVencedor = () => {
    if (!vencedorSorteado || !data.sorteioId) return;

    startTransition(async () => {
      const res = await confirmarGanhadorTelaoAction({
        eventoId: data.eventoId,
        sorteioId: data.sorteioId!,
        participanteId: vencedorSorteado.id,
        premioId: premioSelecionadoId || null,
      });

      if (res.ok) {
        // Remove todos os cupons do mesmo telefone dos elegíveis (ganha só 1 vez)
        const telNorm = vencedorSorteado.telefone.replace(/\D/g, "");
        setParticipantes((prev) =>
          prev.filter((p) => p.telefone.replace(/\D/g, "") !== telNorm),
        );

        // Atualiza status do prêmio
        if (premioSelecionadoId) {
          setPremios((prev) =>
            prev.map((p) =>
              p.id === premioSelecionadoId
                ? { ...p, status: "sorteado" as const, ganhador_nome: vencedorSorteado.nome, ganhador_codigo: vencedorSorteado.codigo }
                : p,
            ),
          );
          // Avança para o próximo prêmio pendente
          const proximoPendente = premios.find(
            (p) => p.id !== premioSelecionadoId && p.status === "pendente",
          );
          if (proximoPendente) setPremioSelecionadoId(proximoPendente.id);
          else setPremioSelecionadoId("");
        }

        // Registra nos ganhadores
        setGanhadores((prev) => [
          ...prev,
          {
            id: vencedorSorteado.id,
            codigo: vencedorSorteado.codigo,
            nome: vencedorSorteado.nome,
            ordem: res.ordem ?? prev.length + 1,
            premioTitulo: premioAtual?.titulo,
          },
        ]);

        setVencedorSorteado(null);
        setSpinCode("···");
      } else {
        alert(res.error || "Não foi possível confirmar o ganhador.");
      }
    });
  };

  return (
    <div
      className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-gradient-to-b from-zinc-950 via-slate-950 to-zinc-950 text-white p-6 sm:p-12 select-none"
      style={{ "--theme-primary": primaryColor } as React.CSSProperties}
    >
      {/* Luz ambiente de fundo com cor da marca */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full opacity-20 blur-[140px]"
        style={{ backgroundColor: primaryColor }}
      />

      {/* Cabeçalho do Telão de Palco */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          {logo ? (
            <div className="flex h-16 w-auto items-center justify-center">
              <Image
                src={logo}
                alt={brandNome}
                width={180}
                height={64}
                className="max-h-14 w-auto object-contain"
                priority
              />
            </div>
          ) : (
            <span className="text-xl font-black uppercase tracking-wider text-white">
              {brandNome}
            </span>
          )}
          <div className="hidden sm:block border-l border-white/15 pl-4">
            <h1 className="text-lg font-bold tracking-tight text-white">{data.eventoNome}</h1>
            <p className="text-xs text-zinc-400 uppercase tracking-widest">Sorteio Oficial ao Vivo</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-right">
            <p className="text-xs uppercase tracking-widest text-zinc-400">Participantes Aptos</p>
            <p className="font-mono text-xl font-extrabold text-[var(--theme-primary)]">
              {participantes.length}
            </p>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 transition"
          >
            {fullscreen ? "Sair da Tela Cheia" : "Tela Cheia ⛶"}
          </button>
        </div>
      </header>

      {/* Palco Central: Prêmio e Roleta */}
      <main className="relative z-10 my-auto flex flex-col items-center justify-center text-center py-8">
        {/* Banner do Prêmio Atual */}
        {premios.length > 0 ? (
          <div className="mb-6 flex flex-col items-center space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--theme-primary)]/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)] border border-[var(--theme-primary)]/40">
                🎁 Disputando Agora
              </span>
              {premios.length > 1 ? (
                <select
                  value={premioSelecionadoId}
                  onChange={(e) => setPremioSelecionadoId(e.target.value)}
                  disabled={spinning || Boolean(vencedorSorteado)}
                  className="rounded-lg border border-white/20 bg-zinc-900 px-3 py-1 text-xs font-medium text-white outline-none focus:border-[var(--theme-primary)]"
                >
                  <option value="">Sem prêmio específico</option>
                  {premios.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.ordem} — {p.titulo} {p.status === "sorteado" ? "(Sorteado)" : ""}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {premioAtual ? (
              <div className="animate-fade-in">
                <h2 className="text-3xl font-black text-white sm:text-4xl tracking-tight">
                  {premioAtual.titulo}
                </h2>
                {premioAtual.descricao ? (
                  <p className="text-sm text-zinc-400 max-w-md mt-1">{premioAtual.descricao}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Visor Gigante da Roleta de Números */}
        <div className="relative my-4 flex items-center justify-center">
          <div
            className={`relative flex min-h-[180px] min-w-[300px] sm:min-w-[420px] items-center justify-center rounded-3xl border-4 p-8 shadow-2xl transition-all duration-300 ${
              spinning
                ? "border-[var(--theme-primary)] bg-[var(--theme-primary)]/15 scale-105 shadow-[var(--theme-primary)]/30"
                : vencedorSorteado
                  ? "border-emerald-500 bg-emerald-500/15 scale-110 shadow-emerald-500/30"
                  : "border-white/20 bg-white/5"
            }`}
          >
            <p
              className={`font-mono font-black tracking-widest transition-transform ${
                spinning
                  ? "text-6xl sm:text-8xl text-amber-300 animate-pulse"
                  : vencedorSorteado
                    ? "text-6xl sm:text-8xl text-emerald-400"
                    : "text-6xl sm:text-7xl text-zinc-400"
              }`}
            >
              {spinCode}
            </p>
          </div>
        </div>

        {/* Revelação do Vencedor */}
        {vencedorSorteado && !spinning ? (
          <div className="mt-6 space-y-2 animate-bounce-short">
            <span className="inline-block text-4xl">🎉</span>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-400">
              Número Contemplado!
            </p>
            <h3 className="text-3xl font-black text-white sm:text-5xl">
              {vencedorSorteado.nome}
            </h3>
            <p className="text-sm text-zinc-400 font-mono">
              {formatWhatsappBrInput(vencedorSorteado.telefone)}
            </p>
          </div>
        ) : null}

        {/* Botões de Ação do Apresentador */}
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          {!vencedorSorteado ? (
            <button
              type="button"
              onClick={handleSortear}
              disabled={participantes.length === 0 || spinning}
              className="flex min-h-16 min-w-[240px] items-center justify-center rounded-2xl bg-[var(--theme-primary)] px-8 text-xl font-extrabold text-white shadow-xl transition hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              {spinning ? "Girando Roleta…" : "⚡ Sortear Agora"}
            </button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConfirmarVencedor}
                disabled={pending}
                className="flex min-h-14 items-center justify-center rounded-2xl bg-emerald-600 px-6 text-lg font-bold text-white shadow-lg transition hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
              >
                {pending ? "Confirmando…" : "✓ Confirmar e Salvar Vencedor"}
              </button>
              <button
                type="button"
                onClick={handleSortear}
                disabled={pending}
                className="flex min-h-14 items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-6 text-lg font-bold text-white transition hover:bg-white/20 active:scale-95"
              >
                Sortear Novamente
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Barra Inferior: Histórico dos Vencedores da Noite */}
      <footer className="relative z-10 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Ganhadores ({ganhadores.length})
          </p>
          <Link
            href={`/admin/eventos/${data.eventoId}/sorteio`}
            className="text-xs text-zinc-400 hover:text-white transition"
          >
            ← Painel Admin do Sorteio
          </Link>
        </div>

        {ganhadores.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2 overflow-x-auto pb-1">
            {ganhadores.map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200"
              >
                <span className="font-mono font-bold text-emerald-400">{g.codigo}</span>
                <span className="font-medium text-white">{g.nome}</span>
                {g.premioTitulo ? (
                  <span className="text-zinc-400 text-[10px]">({g.premioTitulo})</span>
                ) : null}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">Nenhum prêmio sorteado ainda esta noite.</p>
        )}
      </footer>
    </div>
  );
}
