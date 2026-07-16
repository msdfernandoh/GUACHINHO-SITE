"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  publicCadastroSorteioAction,
  publicConcluirIndicacoesAction,
  publicIndicacaoSorteioAction,
  publicNpsSorteioAction,
} from "@/app/(public)/eventos/[slug]/sorteio/public-actions";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";
import { formatBRL, maskBRLMoneyInput, parseBRLMoney } from "@/lib/formatters/money";
import { formatWhatsappBrInput } from "@/lib/utils/format";
import { TIPOS_SONHO_SORTEIO, type PublicSorteioView } from "@/lib/eventos-sorteio/types";
import type { NpsPerguntaPublica } from "@/lib/eventos-sorteio/nps";

type Props = {
  sorteio: PublicSorteioView;
  qrCodeUnicoId?: string | null;
};

type Fase = 1 | 2 | 3 | "done";

export function EventoSorteioPublicForm({ sorteio, qrCodeUnicoId }: Props) {
  const [fase, setFase] = useState<Fase>(1);
  const [participanteId, setParticipanteId] = useState<string | null>(null);
  const [codigos, setCodigos] = useState<string[]>([]);
  const [textoFinal, setTextoFinal] = useState(sorteio.textoAgradecimento);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Fase 1
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [valorDisplay, setValorDisplay] = useState("");
  const [valor, setValor] = useState(0);
  const [tipoSonho, setTipoSonho] = useState("");

  // Fase 2
  const [npsRespostas, setNpsRespostas] = useState<Record<string, unknown>>({});

  // Fase 3
  const [indNome, setIndNome] = useState("");
  const [indTipo, setIndTipo] = useState<"amigo" | "familiar" | "">("");
  const [indTelefone, setIndTelefone] = useState("");

  const encerrado = sorteio.status === "encerrado";
  const npsPerguntas = sorteio.npsPerguntas ?? [];

  const dataFmt = useMemo(
    () =>
      sorteio.eventoData
        ? new Date(sorteio.eventoData).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : null,
    [sorteio.eventoData],
  );

  const submitFase1 = () => {
    setErro(null);
    startTransition(async () => {
      const res = await publicCadastroSorteioAction(sorteio.eventoSlug, {
        nome,
        telefone,
        valorMensalDisponivel: valor,
        tipoSonho,
        qrCodeUnicoId,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setParticipanteId(res.participanteId);
      setCodigos([res.codigo]);
      setTextoFinal(res.textoAgradecimento);
      setFase(2);
    });
  };

  const submitFase2 = () => {
    if (!participanteId) return;
    setErro(null);
    startTransition(async () => {
      const res = await publicNpsSorteioAction(participanteId, npsRespostas);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setFase(3);
    });
  };

  const submitIndicacao = () => {
    if (!participanteId) return;
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const res = await publicIndicacaoSorteioAction(participanteId, {
        nome: indNome,
        tipo: indTipo,
        telefone: indTelefone,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setCodigos(res.codigos);
      if (res.aviso) setAviso(res.aviso);
      else if (res.codigoExtra) setAviso(`Cupom extra gerado: ${res.codigoExtra}`);
      setIndNome("");
      setIndTipo("");
      setIndTelefone("");
    });
  };

  const concluir = () => {
    if (!participanteId) return;
    setErro(null);
    startTransition(async () => {
      const res = await publicConcluirIndicacoesAction(participanteId);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setCodigos(res.codigos);
      setTextoFinal(res.textoAgradecimento);
      setFase("done");
    });
  };

  if (fase === "done") {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-6 text-center text-white shadow-xl sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">Cadastro confirmado!</p>
        <p className="mt-4 text-sm text-slate-300">
          {codigos.length > 1 ? "Seus códigos de participação:" : "Seu código de participação é:"}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {codigos.map((c) => (
            <p key={c} className="font-mono text-3xl font-bold tracking-widest text-amber-300 sm:text-4xl">
              {c}
            </p>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Guarde {codigos.length > 1 ? "estes códigos" : "este código"}.{" "}
          {codigos.length > 1
            ? "Quanto mais cupons, mais chances no sorteio."
            : "Ele será usado no sorteio dos brindes."}
        </p>
        <p className="mt-2 text-sm text-slate-500">{textoFinal}</p>
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

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-slate-900/85 p-5 shadow-xl sm:p-7">
      <div className="flex justify-center">
        <Image src="/media/gauchinho-sem-fundo.svg" alt="Gauchinho" width={120} height={80} className="h-14 w-auto" />
      </div>
      <p className="mt-4 text-center text-xs uppercase tracking-wide text-amber-400/90">{sorteio.eventoNome}</p>
      {dataFmt ? <p className="text-center text-xs text-slate-500">{dataFmt}</p> : null}
      <h1 className="mt-4 text-center text-xl font-bold text-white">{sorteio.titulo}</h1>
      <p className="mt-2 text-center text-sm text-slate-400">{sorteio.descricao}</p>

      <div className="mt-5 flex justify-center gap-2 text-xs">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`rounded-full px-3 py-1 ${
              fase === n
                ? "bg-amber-500/25 text-amber-200"
                : typeof fase === "number" && fase > n
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-slate-800 text-slate-500"
            }`}
          >
            Fase {n}
          </span>
        ))}
      </div>

      {codigos.length > 0 && fase !== 1 ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-slate-950/80 px-3 py-2 text-center">
          <p className="text-xs text-slate-400">Seus cupons</p>
          <p className="font-mono text-sm font-semibold text-amber-300">{codigos.join(" · ")}</p>
        </div>
      ) : null}

      {encerrado ? (
        <p className="mt-6 rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
          Sorteio encerrado. Obrigado pela participação.
        </p>
      ) : null}

      {!encerrado && fase === 1 ? (
        <div className="mt-6 space-y-4">
          <p className="text-center text-sm font-medium text-slate-200">
            Preencha seus dados para receber seu código e concorrer aos brindes.
          </p>
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
          <Button type="button" className="w-full" disabled={pending} onClick={submitFase1}>
            {pending ? "Salvando…" : "Continuar"}
          </Button>
        </div>
      ) : null}

      {!encerrado && fase === 2 ? (
        <div className="mt-6 space-y-5">
          <p className="text-center text-sm font-medium text-slate-200">
            Avalie sua experiência no evento (obrigatório)
          </p>
          {npsPerguntas.length === 0 ? (
            <p className="text-center text-sm text-slate-400">Nenhuma pergunta configurada. Você pode continuar.</p>
          ) : (
            npsPerguntas.map((p) => (
              <NpsPerguntaField
                key={p.chave}
                pergunta={p}
                value={npsRespostas[p.chave]}
                onChange={(v) => setNpsRespostas((prev) => ({ ...prev, [p.chave]: v }))}
              />
            ))
          )}
          {erro ? <p className="text-sm text-red-400">{erro}</p> : null}
          <Button type="button" className="w-full" disabled={pending} onClick={submitFase2}>
            {pending ? "Salvando…" : "Salvar avaliação e continuar"}
          </Button>
        </div>
      ) : null}

      {!encerrado && fase === 3 ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold">Indique amigos e ganhe mais cupons</p>
            <p className="mt-1 text-amber-100/85">
              Dê a oportunidade a outras pessoas que você conhece de fazer network, apresentar o negócio e
              conhecer investimentos e consórcio. Ajude amigos a terem acesso às oportunidades, conhecer
              pessoas e fazer novos negócios.
            </p>
            <p className="mt-2 font-medium text-amber-200">
              Cada indicação válida = 1 cupom a mais para você. Quanto mais indicações, mais chances de
              ganhar os prêmios.
            </p>
          </div>

          {aviso ? <p className="text-sm text-amber-300">{aviso}</p> : null}

          <div>
            <Label className="text-slate-200">Nome do indicado</Label>
            <Input
              value={indNome}
              onChange={(e) => setIndNome(e.target.value)}
              className="mt-1 border-slate-600 bg-slate-950 text-white"
            />
          </div>
          <div>
            <Label className="text-slate-200">Tipo</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["amigo", "familiar"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setIndTipo(t)}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold capitalize transition ${
                    indTipo === t
                      ? "border-amber-400 bg-amber-500/20 text-amber-100"
                      : "border-slate-600 bg-slate-950 text-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-slate-200">Telefone do indicado</Label>
            <Input
              value={indTelefone}
              onChange={(e) => setIndTelefone(formatWhatsappBrInput(e.target.value))}
              className="mt-1 border-slate-600 bg-slate-950 text-white"
              inputMode="tel"
            />
          </div>

          {erro ? <p className="text-sm text-red-400">{erro}</p> : null}

          <Button type="button" className="w-full" disabled={pending} onClick={submitIndicacao}>
            {pending ? "Salvando…" : codigos.length > 1 ? "Adicionar indicação" : "Salvar indicação e ganhar cupom"}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={concluir}>
            {codigos.length > 1 ? "Finalizar cadastro" : "Pular indicações e finalizar"}
          </Button>
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs text-slate-500">
        Sorteio de brindes — dados usados apenas para contato comercial.
      </p>
    </div>
  );
}

function NpsPerguntaField({
  pergunta,
  value,
  onChange,
}: {
  pergunta: NpsPerguntaPublica;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (pergunta.tipo === "escala_0_10") {
    const selected = typeof value === "number" ? value : null;
    return (
      <div>
        <Label className="text-slate-200">
          {pergunta.titulo}
          {pergunta.obrigatoria ? " *" : ""}
        </Label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`h-9 w-9 rounded-lg border text-sm font-semibold transition ${
                selected === n
                  ? "border-amber-400 bg-amber-500/25 text-amber-100"
                  : "border-slate-600 bg-slate-950 text-slate-200 hover:border-amber-500/40"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (pergunta.tipo === "sim_nao") {
    const selected = value === true ? "sim" : value === false ? "nao" : "";
    return (
      <div>
        <Label className="text-slate-200">
          {pergunta.titulo}
          {pergunta.obrigatoria ? " *" : ""}
        </Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["sim", true, "Sim"],
              ["nao", false, "Não"],
            ] as const
          ).map(([key, val, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange(val)}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                selected === key
                  ? "border-amber-400 bg-amber-500/20 text-amber-100"
                  : "border-slate-600 bg-slate-950 text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label className="text-slate-200">
        {pergunta.titulo}
        {pergunta.obrigatoria ? " *" : ""}
      </Label>
      <Textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1 border-slate-600 bg-slate-950 text-white"
      />
    </div>
  );
}
