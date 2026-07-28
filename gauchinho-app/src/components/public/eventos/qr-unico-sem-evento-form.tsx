"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { publicCadastroQrSemEventoAction } from "@/app/(public)/qr/[slug]/actions";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { formatBRL, maskBRLMoneyInput, parseBRLMoney } from "@/lib/formatters/money";
import { formatWhatsappBrInput } from "@/lib/utils/format";
import { TIPOS_SONHO_SORTEIO } from "@/lib/eventos-sorteio/types";

type Props = {
  qrNome: string;
  qrSlug: string;
  qrCodeUnicoId: string;
  motivo: "inativo" | "sem_vinculo" | "fora_periodo" | "sorteio_indisponivel";
  eventoNome?: string | null;
};

const MOTIVO_MSG: Record<Props["motivo"], string> = {
  inativo: "Este QR Code está temporariamente indisponível para campanhas.",
  sem_vinculo: "Não há evento ativo vinculado a este QR no momento.",
  fora_periodo: "O período deste QR no evento atual já encerrou ou ainda não começou.",
  sorteio_indisponivel:
    "O sorteio com NPS deste evento ainda não está ativo. Peça ao organizador para ativar o sorteio no admin do evento.",
};

/** Formulário legado só quando não há evento vinculado — evita cadastro sem NPS. */
function permiteCadastroSimples(motivo: Props["motivo"]): boolean {
  return motivo === "sem_vinculo" || motivo === "fora_periodo";
}

export function QrUnicoSemEventoForm({ qrNome, qrSlug, qrCodeUnicoId, motivo, eventoNome }: Props) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [valorDisplay, setValorDisplay] = useState("");
  const [valor, setValor] = useState(0);
  const [tipoSonho, setTipoSonho] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [pending, startTransition] = useTransition();

  const podeCadastrar = permiteCadastroSimples(motivo);

  const submit = () => {
    setErro(null);
    startTransition(async () => {
      const res = await publicCadastroQrSemEventoAction({
        nome,
        telefone,
        valorMensalDisponivel: valor,
        tipoSonho,
        qrCodeUnicoId,
        qrSlug,
        qrNome,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setSucesso(true);
    });
  };

  if (sucesso) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-6 text-center text-white shadow-xl sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">Cadastro recebido!</p>
        <p className="mt-4 text-sm text-slate-300">
          Obrigado. Seus dados foram registrados. Quando houver um evento ativo neste QR, você poderá
          concorrer aos brindes.
        </p>
        <Link
          href="/simulador"
          className="mt-8 inline-flex items-center justify-center rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Falar com especialista
        </Link>
      </div>
    );
  }

  if (!podeCadastrar) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-slate-900/85 p-5 text-center shadow-xl sm:p-7">
        <div className="flex justify-center">
          <Image src="/media/gauchinho-sem-fundo.svg" alt="Gauchinho" width={120} height={80} className="h-14 w-auto" />
        </div>
        <p className="mt-4 text-xs uppercase tracking-wide text-amber-400/90">{qrNome}</p>
        {eventoNome ? (
          <p className="mt-2 text-sm font-medium text-white">Evento: {eventoNome}</p>
        ) : null}
        <p className="mt-4 text-sm text-slate-300">{MOTIVO_MSG[motivo]}</p>
        <Link
          href="/simulador"
          className="mt-8 inline-flex items-center justify-center rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Falar com especialista
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-slate-900/85 p-5 shadow-xl sm:p-7">
      <div className="flex justify-center">
        <Image src="/media/gauchinho-sem-fundo.svg" alt="Gauchinho" width={120} height={80} className="h-14 w-auto" />
      </div>
      <p className="mt-4 text-center text-xs uppercase tracking-wide text-amber-400/90">{qrNome}</p>
      {eventoNome ? (
        <p className="mt-1 text-center text-xs text-slate-500">Último vínculo: {eventoNome}</p>
      ) : null}
      <h1 className="mt-4 text-center text-xl font-bold text-white">Deixe seus dados</h1>
      <p className="mt-2 text-center text-sm text-slate-400">{MOTIVO_MSG[motivo]}</p>
      <p className="mt-2 text-center text-xs text-slate-500">
        Cadastro rápido fora do formulário completo do evento (sem NPS). Com o QR vinculado e o sorteio
        ativo no período, você verá o formulário completo automaticamente.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <Label className="text-slate-200">Nome *</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 border-slate-600 bg-slate-950 text-white"
            placeholder="Seu nome"
          />
        </div>
        <div>
          <Label className="text-slate-200">Telefone / WhatsApp *</Label>
          <Input
            value={telefone}
            onChange={(e) => setTelefone(formatWhatsappBrInput(e.target.value))}
            className="mt-1 border-slate-600 bg-slate-950 text-white"
            inputMode="tel"
          />
        </div>
        <div>
          <Label className="text-slate-200">Valor mensal disponível *</Label>
          <Input
            value={valorDisplay}
            onChange={(e) => {
              const masked = maskBRLMoneyInput(e.target.value);
              setValorDisplay(masked);
              setValor(parseBRLMoney(masked) ?? 0);
            }}
            onBlur={() => {
              if (valor > 0) setValorDisplay(formatBRL(valor));
            }}
            className="mt-1 border-slate-600 bg-slate-950 text-white"
            inputMode="numeric"
            placeholder="R$ 0,00"
          />
        </div>
        <div>
          <Label className="text-slate-200">Tipo do sonho *</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TIPOS_SONHO_SORTEIO.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipoSonho(t)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  tipoSonho === t
                    ? "border-amber-400 bg-amber-500/20 text-amber-100"
                    : "border-slate-600 bg-slate-950 text-slate-200 hover:border-amber-500/40"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {erro ? <p className="text-sm text-red-400">{erro}</p> : null}
        <Button type="button" className="w-full" disabled={pending} onClick={submit}>
          {pending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
