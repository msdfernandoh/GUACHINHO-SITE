"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  confirmarVencedorSorteioAction,
  exportParticipantesCsvAction,
  saveSorteioConfigAction,
  updateParticipanteSorteioAction,
} from "@/app/admin/eventos/[id]/sorteio/actions";
import { SorteioQrPanel } from "@/components/admin/eventos/sorteio-qr-panel";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";
import { formatBRL } from "@/lib/formatters/money";
import {
  DEFAULTS_SORTEIO,
  TIPOS_SONHO_SORTEIO,
  type EventoSorteioRow,
  type SorteioParticipanteRow,
} from "@/lib/eventos-sorteio/types";
import { escolherParticipanteAleatorio, codigosParaAnimacao } from "@/lib/eventos-sorteio/sorteio";
import { formatWhatsappBrInput, digitsOnlyPhone } from "@/lib/utils/format";

function whatsappHref(telefone: string) {
  const n = digitsOnlyPhone(telefone);
  return n ? `https://wa.me/55${n.replace(/^55/, "")}` : "#";
}

type Props = {
  eventoId: string;
  eventoNome: string;
  eventoSlug: string;
  publicBaseUrl: string;
  sorteio: EventoSorteioRow | null;
  participantes: SorteioParticipanteRow[];
  migrationHint?: string | null;
};

export function SorteioAdminClient({
  eventoId,
  eventoNome,
  eventoSlug,
  publicBaseUrl,
  sorteio,
  participantes,
  migrationHint,
}: Props) {
  const publicUrl = `${publicBaseUrl.replace(/\/$/, "")}/eventos/${eventoSlug}/sorteio`;
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroGanhador, setFiltroGanhador] = useState<"" | "sim" | "nao">("");
  const [filtroStatus, setFiltroStatus] = useState<"" | "participando" | "cancelado">("");
  const [drawOpen, setDrawOpen] = useState(false);
  const [spinCode, setSpinCode] = useState("");
  const [winner, setWinner] = useState<SorteioParticipanteRow | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return participantes.filter((p) => {
      if (filtroTipo && p.tipo_sonho !== filtroTipo) return false;
      if (filtroGanhador === "sim" && !p.ganhador) return false;
      if (filtroGanhador === "nao" && p.ganhador) return false;
      if (filtroStatus && p.status !== filtroStatus) return false;
      return true;
    });
  }, [participantes, filtroTipo, filtroGanhador, filtroStatus]);

  const saveConfig = saveSorteioConfigAction.bind(null, eventoId);

  const runDraw = () => {
    const elegiveis = participantes.filter((p) => p.status === "participando" && !p.ganhador);
    const pick = escolherParticipanteAleatorio(elegiveis);
    if (!pick) return;
    const full = participantes.find((p) => p.id === pick.id) ?? null;
    if (!full) return;

    setWinner(null);
    setDrawOpen(true);
    setSpinning(true);
    const seq = codigosParaAnimacao(elegiveis, pick.codigo);
    let i = 0;
    const tickMs = 120;
    const interval = setInterval(() => {
      setSpinCode(seq[i] ?? pick.codigo);
      i += 1;
      if (i >= seq.length) {
        clearInterval(interval);
        setSpinning(false);
        setWinner(full);
        setSpinCode(pick.codigo);
      }
    }, tickMs);
  };

  const confirmWinner = () => {
    if (!winner || !sorteio?.id) return;
    startTransition(async () => {
      await confirmarVencedorSorteioAction(eventoId, sorteio.id, winner.id);
      setDrawOpen(false);
      setWinner(null);
    });
  };

  const exportCsv = () => {
    if (!sorteio?.id) return;
    startTransition(async () => {
      const csv = await exportParticipantesCsvAction(eventoId, sorteio.id);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `sorteio-${eventoSlug}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };

  return (
    <div className="space-y-8">
      {migrationHint ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">{migrationHint}</div>
      ) : null}

      <form action={saveConfig} className="max-w-2xl space-y-4 rounded-xl border p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Configuração do sorteio</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={sorteio?.ativo ?? false} />
          Ativar sorteio neste evento
        </label>
        <div>
          <Label>Título da campanha</Label>
          <Input name="titulo" defaultValue={sorteio?.titulo ?? DEFAULTS_SORTEIO.titulo} />
        </div>
        <div>
          <Label>Texto de chamada</Label>
          <Textarea name="descricao" rows={3} defaultValue={sorteio?.descricao ?? DEFAULTS_SORTEIO.descricao} />
        </div>
        <div>
          <Label>Texto de agradecimento</Label>
          <Textarea
            name="texto_agradecimento"
            rows={2}
            defaultValue={sorteio?.texto_agradecimento ?? DEFAULTS_SORTEIO.texto_agradecimento}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Quantidade de brindes</Label>
            <Input
              name="quantidade_brindes"
              type="number"
              min={1}
              defaultValue={sorteio?.quantidade_brindes ?? 1}
            />
          </div>
          <div>
            <Label>Status do sorteio</Label>
            <select
              name="status"
              defaultValue={sorteio?.status ?? "aberto"}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="aberto">Aberto</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="mostrar_home" defaultChecked={sorteio?.mostrar_home ?? false} />
          Mostrar na página principal
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="permitir_telefone_duplicado"
            defaultChecked={sorteio?.permitir_telefone_duplicado ?? false}
          />
          Permitir múltiplos cadastros com mesmo telefone
        </label>
        <AdminFormSubmitButton label="Salvar sorteio" pendingLabel="Salvando…" />
      </form>

      {sorteio?.ativo ? (
        <>
          <SorteioQrPanel url={publicUrl} eventoNome={eventoNome} />

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={runDraw} disabled={!sorteio || pending}>
              Realizar sorteio
            </Button>
            <Button type="button" variant="outline" onClick={exportCsv} disabled={!sorteio?.id || pending}>
              Exportar CSV
            </Button>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Participantes ({filtered.length})</h2>
            <p className="text-sm text-zinc-500">
              Inclui inscrições oficiais e cadastros pelo QR. Quem se inscreve no sorteio também é criado ou
              vinculado em{" "}
              <Link href={`/admin/eventos/${eventoId}/participantes`} className="text-amber-600 hover:underline">
                Participantes do evento
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="rounded-lg border px-2 py-1 dark:border-zinc-700"
              >
                <option value="">Tipo do sonho</option>
                {TIPOS_SONHO_SORTEIO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={filtroGanhador}
                onChange={(e) => setFiltroGanhador(e.target.value as "" | "sim" | "nao")}
                className="rounded-lg border px-2 py-1 dark:border-zinc-700"
              >
                <option value="">Ganhador</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as "" | "participando" | "cancelado")}
                className="rounded-lg border px-2 py-1 dark:border-zinc-700"
              >
                <option value="">Status</option>
                <option value="participando">Participando</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-zinc-50 text-xs uppercase dark:border-zinc-800 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Telefone</th>
                    <th className="px-3 py-2">Sonho</th>
                    <th className="px-3 py-2">Valor/mês</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Ganhador</th>
                    <th className="px-3 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b dark:border-zinc-800">
                      <td className="px-3 py-2 font-mono">{p.codigo}</td>
                      <td className="px-3 py-2">{p.nome}</td>
                      <td className="px-3 py-2">{p.telefone}</td>
                      <td className="px-3 py-2">{p.tipo_sonho}</td>
                      <td className="px-3 py-2">
                        {p.valor_mensal_disponivel != null ? formatBRL(Number(p.valor_mensal_disponivel)) : "—"}
                      </td>
                      <td className="px-3 py-2">{p.status}</td>
                      <td className="px-3 py-2">{p.ganhador ? "Sim" : "Não"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <a
                            href={whatsappHref(p.telefone)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-amber-600 hover:underline"
                          >
                            WhatsApp
                          </a>
                          <button
                            type="button"
                            className="text-xs text-zinc-600 hover:underline dark:text-zinc-300"
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                await updateParticipanteSorteioAction(eventoId, p.id, {
                                  ganhador: !p.ganhador,
                                });
                              })
                            }
                          >
                            {p.ganhador ? "Remover ganhador" : "Marcar ganhador"}
                          </button>
                          {p.status === "participando" ? (
                            <button
                              type="button"
                              className="text-xs text-red-600 hover:underline"
                              disabled={pending}
                              onClick={() =>
                                startTransition(async () => {
                                  await updateParticipanteSorteioAction(eventoId, p.id, { status: "cancelado" });
                                })
                              }
                            >
                              Cancelar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-zinc-500">
                        Nenhum participante ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-zinc-500">Ative o sorteio e salve para exibir QR Code e participantes.</p>
      )}

      {drawOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-zinc-950 p-6 text-center text-white shadow-2xl">
            <p className="text-sm text-zinc-400">{eventoNome}</p>
            <p
              className={`mt-6 font-mono text-4xl font-bold tracking-wider text-amber-400 transition ${spinning ? "scale-105" : "scale-100"}`}
            >
              {spinCode || "···"}
            </p>
            {winner && !spinning ? (
              <div className="mt-6 space-y-1">
                <p className="text-lg font-semibold">Vencedor do sorteio</p>
                <p className="text-xl">
                  {winner.codigo} — {winner.nome}
                </p>
                <p className="text-sm text-zinc-400">{formatWhatsappBrInput(winner.telefone)}</p>
              </div>
            ) : null}
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={confirmWinner} disabled={!winner || spinning || pending}>
                Confirmar vencedor
              </Button>
              <Button type="button" variant="outline" onClick={runDraw} disabled={spinning}>
                Sortear novamente
              </Button>
              <Button type="button" variant="outline" onClick={() => setDrawOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-zinc-500">
        Página pública:{" "}
        <Link href={`/eventos/${eventoSlug}/sorteio`} className="text-amber-600 hover:underline">
          /eventos/{eventoSlug}/sorteio
        </Link>
      </p>
    </div>
  );
}
