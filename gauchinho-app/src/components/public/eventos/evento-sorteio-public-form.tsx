"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { publicCadastroSorteioAction } from "@/app/(public)/eventos/[slug]/sorteio/public-actions";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { formatBRL, maskBRLMoneyInput, parseBRLMoney } from "@/lib/formatters/money";
import { formatWhatsappBrInput } from "@/lib/utils/format";
import { TIPOS_SONHO_SORTEIO, type PublicSorteioView } from "@/lib/eventos-sorteio/types";

export function EventoSorteioPublicForm({ sorteio }: { sorteio: PublicSorteioView }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [valorDisplay, setValorDisplay] = useState("");
  const [valor, setValor] = useState(0);
  const [tipoSonho, setTipoSonho] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<{ codigo: string; texto: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const encerrado = sorteio.status === "encerrado";

  const submit = () => {
    setErro(null);
    startTransition(async () => {
      const res = await publicCadastroSorteioAction(sorteio.eventoSlug, {
        nome,
        telefone,
        valorMensalDisponivel: valor,
        tipoSonho,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setSucesso({ codigo: res.codigo, texto: res.textoAgradecimento });
    });
  };

  if (sucesso) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-6 text-center text-white shadow-xl sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">Cadastro confirmado!</p>
        <p className="mt-4 text-sm text-slate-300">Seu código de participação é:</p>
        <p className="mt-2 font-mono text-4xl font-bold tracking-widest text-amber-300">{sucesso.codigo}</p>
        <p className="mt-4 text-sm text-slate-400">
          Guarde este código. Ele será usado no sorteio dos brindes.
        </p>
        <p className="mt-2 text-sm text-slate-500">{sucesso.texto}</p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/simulador"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Falar com especialista
          </Link>
          <Link
            href={`/eventos/${sorteio.eventoSlug}`}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Voltar para o evento
          </Link>
        </div>
      </div>
    );
  }

  const dataFmt = sorteio.eventoData
    ? new Date(sorteio.eventoData).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-slate-900/85 p-5 shadow-xl sm:p-7">
      <div className="flex justify-center">
        <Image src="/media/gauchinho-sem-fundo.svg" alt="Gauchinho" width={120} height={80} className="h-14 w-auto" />
      </div>
      <p className="mt-4 text-center text-xs uppercase tracking-wide text-amber-400/90">{sorteio.eventoNome}</p>
      {dataFmt ? <p className="text-center text-xs text-slate-500">{dataFmt}</p> : null}
      <h1 className="mt-4 text-center text-xl font-bold text-white">{sorteio.titulo}</h1>
      <p className="mt-2 text-center text-sm text-slate-400">{sorteio.descricao}</p>
      <p className="mt-4 text-center text-sm font-medium text-slate-200">
        Preencha seus dados para receber seu código e concorrer aos brindes do evento.
      </p>

      {encerrado ? (
        <p className="mt-6 rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
          Sorteio encerrado. Obrigado pela participação.
        </p>
      ) : (
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
            <Label className="text-slate-200">
              Qual valor mensal você tem disponível hoje para realizar seus sonhos? *
            </Label>
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
            {pending ? "Enviando…" : "Participar do sorteio"}
          </Button>
          <p className="text-center text-xs text-slate-500">Sorteio de brindes — dados usados apenas para contato comercial.</p>
        </div>
      )}
    </div>
  );
}
