"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  consultarCheckinAction,
  submeterCheckinConversacionalAction,
} from "@/app/(public)/eventos/[slug]/sorteio/checkin-actions";
import {
  OPCOES_CAPACIDADE_MENSAL,
  OPCOES_MORADIA,
  OPCOES_VEICULO,
  type CapacidadeMensalQualificacao,
  type MoradiaQualificacao,
  type VeiculoQualificacao,
} from "@/lib/eventos-sorteio/checkin-conversacional-types";
import { useTenantBrand } from "@/components/tenant/tenant-brand-context";
import { formatWhatsappBrInput, digitsOnlyPhone } from "@/lib/utils/format";

type EventoBrandProps = {
  id: string;
  nome: string;
  slug: string;
  corPrimaria?: string | null;
  corSecundaria?: string | null;
  logoPersonalizadoUrl?: string | null;
};

type Props = {
  evento: EventoBrandProps;
  qrCodeUnicoId?: string | null;
};

type Step = 1 | 2 | 3 | 4 | 5 | "final";

export function EventoCheckinConversacional({ evento, qrCodeUnicoId }: Props) {
  const tenantBrand = useTenantBrand();
  const [step, setStep] = useState<Step>(1);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [veiculo, setVeiculo] = useState<VeiculoQualificacao | "">("");
  const [moradia, setMoradia] = useState<MoradiaQualificacao | "">("");
  const [capacidade, setCapacidade] = useState<CapacidadeMensalQualificacao | "">("");

  const [codigoSorte, setCodigoSorte] = useState<string>("");
  const [jaEstavaCadastrado, setJaEstavaCadastrado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [modalLgpdAberto, setModalLgpdAberto] = useState(false);

  // Identidade visual dinâmica (prioridade para customização do evento, fallback para o tenant)
  const logo = evento.logoPersonalizadoUrl || tenantBrand.logoUrl;
  const primaryColor = evento.corPrimaria || tenantBrand.corPrimaria || "#0066cc";
  const brandNome = tenantBrand.nome || "Consórcios";

  // Primeiro nome para fala amigável
  const primeiroNome = nome.trim().split(" ")[0] || "amigo";

  // Avançar do passo 1 (Nome) para o 2 (WhatsApp)
  const handleAvancarNome = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nome.trim()) {
      setErro("Por favor, digite seu nome.");
      return;
    }
    setErro(null);
    setStep(2);
  };

  // Avançar do passo 2 (WhatsApp) com verificação de duplicidade instantânea
  const handleAvancarWhatsapp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const digits = digitsOnlyPhone(whatsapp);
    if (!digits || digits.length < 10) {
      setErro("Por favor, digite seu WhatsApp com DDD completo.");
      return;
    }
    setErro(null);

    startTransition(async () => {
      try {
        const check = await consultarCheckinAction(evento.id, whatsapp);
        if (check.cadastrado && check.codigo) {
          // Já cadastrado no evento: mostra diretamente a tela final amigável
          setCodigoSorte(check.codigo);
          if (check.nome) setNome(check.nome);
          setJaEstavaCadastrado(true);
          setStep("final");
          return;
        }
        // Novo participante: prossegue para a qualificação
        setStep(3);
      } catch {
        setStep(3);
      }
    });
  };

  // Pergunta 1 (Veículo): seleção com avanço automático
  const handleSelecionarVeiculo = (v: VeiculoQualificacao) => {
    setVeiculo(v);
    setErro(null);
    setStep(4);
  };

  // Pergunta 2 (Moradia): seleção com avanço automático
  const handleSelecionarMoradia = (m: MoradiaQualificacao) => {
    setMoradia(m);
    setErro(null);
    setStep(5);
  };

  // Pergunta 3 (Capacidade): seleção final e submissão atômica
  const handleSelecionarCapacidade = (c: CapacidadeMensalQualificacao) => {
    setCapacidade(c);
    setErro(null);

    if (!veiculo || !moradia) {
      setErro("Responda todas as perguntas para concluir.");
      return;
    }

    startTransition(async () => {
      const res = await submeterCheckinConversacionalAction({
        eventoId: evento.id,
        nome: nome.trim(),
        whatsapp: formatWhatsappBrInput(whatsapp),
        qualificacao: {
          veiculo,
          moradia,
          capacidade_mensal: c,
        },
        qrCodeUnicoId,
        lgpdVersao: "v1_checkin_evento",
      });

      if (!res.ok) {
        setErro(res.error);
        return;
      }

      setCodigoSorte(res.codigo);
      if (res.nome) setNome(res.nome);
      setJaEstavaCadastrado(res.jaCadastrado);
      setStep("final");
    });
  };

  return (
    <div
      className="mx-auto w-full max-w-md min-h-[75vh] flex flex-col justify-between rounded-3xl border border-zinc-200/80 bg-white/95 p-6 text-zinc-900 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-zinc-100 sm:p-8"
      style={{ "--theme-primary": primaryColor } as React.CSSProperties}
    >
      {/* Cabeçalho da Marca */}
      <header className="flex flex-col items-center text-center">
        {logo ? (
          <div className="flex h-14 w-auto items-center justify-center">
            <Image
              src={logo}
              alt={brandNome}
              width={160}
              height={56}
              className="max-h-12 w-auto object-contain"
              priority
            />
          </div>
        ) : (
          <span className="text-lg font-black tracking-wider uppercase text-zinc-800 dark:text-zinc-200">
            {brandNome}
          </span>
        )}
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          {evento.nome}
        </p>

        {/* Barra de Progresso Discreta (se não estiver na tela final) */}
        {step !== "final" ? (
          <div className="mt-4 flex w-full justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === n
                    ? "w-8 bg-[var(--theme-primary)]"
                    : typeof step === "number" && step > n
                      ? "w-4 bg-emerald-500/80"
                      : "w-3 bg-zinc-300 dark:bg-zinc-800"
                }`}
              />
            ))}
          </div>
        ) : null}
      </header>

      {/* Conteúdo Central — 1 Pergunta por Tela */}
      <main className="my-auto py-6">
        {/* TELA 1 — Boas-vindas e Nome */}
        {step === 1 ? (
          <form onSubmit={handleAvancarNome} className="space-y-6">
            <div className="space-y-2">
              <span className="inline-block text-2xl">👋</span>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                Olá! Que bom ter você aqui.
              </h1>
              <p className="text-base text-zinc-600 dark:text-zinc-300">
                Vamos confirmar sua presença para você concorrer aos sorteios de prêmios de hoje.
              </p>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                É bem rapidinho 😊
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <label htmlFor="nome-input" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                Como você se chama?
              </label>
              <input
                id="nome-input"
                type="text"
                autoFocus
                placeholder="Seu nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-2xl border-2 border-zinc-300 bg-white px-4 py-3.5 text-lg font-medium text-zinc-950 placeholder-zinc-400 outline-none transition focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </div>

            {erro ? <p className="text-sm font-medium text-red-500">{erro}</p> : null}

            <button
              type="submit"
              disabled={!nome.trim()}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[var(--theme-primary)] px-6 text-lg font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50"
            >
              Continuar →
            </button>
          </form>
        ) : null}

        {/* TELA 2 — WhatsApp */}
        {step === 2 ? (
          <form onSubmit={handleAvancarWhatsapp} className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                Prazer, {primeiroNome}! 😊
              </h1>
              <p className="text-base text-zinc-600 dark:text-zinc-300">
                Qual é o seu WhatsApp?
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Se você já tiver um número de sorteio neste evento, nós o recuperamos para você.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <input
                id="whatsapp-input"
                type="tel"
                inputMode="tel"
                autoFocus
                placeholder="(00) 00000-0000"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhatsappBrInput(e.target.value))}
                className="w-full rounded-2xl border-2 border-zinc-300 bg-white px-4 py-3.5 text-xl font-mono font-semibold text-zinc-950 placeholder-zinc-400 outline-none transition focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </div>

            {erro ? <p className="text-sm font-medium text-red-500">{erro}</p> : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex min-h-14 w-1/3 items-center justify-center rounded-2xl border border-zinc-300 px-4 text-base font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={pending || digitsOnlyPhone(whatsapp).length < 10}
                className="flex min-h-14 w-2/3 items-center justify-center rounded-2xl bg-[var(--theme-primary)] px-6 text-lg font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50"
              >
                {pending ? "Verificando…" : "Continuar →"}
              </button>
            </div>
          </form>
        ) : null}

        {/* TELA 3 — Pergunta 1: Veículo */}
        {step === 3 ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                Pergunta 1 de 3
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                {primeiroNome}, hoje você possui algum veículo?
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Toque na opção para avançar:
              </p>
            </div>

            <div className="grid gap-3 pt-2">
              {OPCOES_VEICULO.map((opcao) => (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => handleSelecionarVeiculo(opcao.id)}
                  className="flex min-h-16 w-full items-center justify-between rounded-2xl border-2 border-zinc-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-[var(--theme-primary)]"
                >
                  <span className="text-base font-bold text-zinc-900 dark:text-white">
                    {opcao.label}
                  </span>
                  <span className="text-2xl">{opcao.emoji}</span>
                </button>
              ))}
            </div>

            {erro ? <p className="text-sm font-medium text-red-500">{erro}</p> : null}
          </div>
        ) : null}

        {/* TELA 4 — Pergunta 2: Moradia */}
        {step === 4 ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                Pergunta 2 de 3
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                E sobre sua moradia atual?
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Toque na opção para avançar:
              </p>
            </div>

            <div className="grid gap-3 pt-2">
              {OPCOES_MORADIA.map((opcao) => (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => handleSelecionarMoradia(opcao.id)}
                  className="flex min-h-16 w-full items-center justify-between rounded-2xl border-2 border-zinc-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-[var(--theme-primary)]"
                >
                  <span className="text-base font-bold text-zinc-900 dark:text-white">
                    {opcao.label}
                  </span>
                  <span className="text-2xl">{opcao.emoji}</span>
                </button>
              ))}
            </div>

            {erro ? <p className="text-sm font-medium text-red-500">{erro}</p> : null}
          </div>
        ) : null}

        {/* TELA 5 — Pergunta 3: Capacidade Mensal + LGPD */}
        {step === 5 ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                Pergunta 3 de 3
              </span>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
                Pensando em aumentar seu patrimônio, qual valor mensal hoje faria sentido para você investir?
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Toque para confirmar sua presença e gerar seu número da sorte:
              </p>
            </div>

            <div className="grid gap-2.5 pt-1">
              {OPCOES_CAPACIDADE_MENSAL.map((opcao) => (
                <button
                  key={opcao.id}
                  type="button"
                  disabled={pending}
                  onClick={() => handleSelecionarCapacidade(opcao.id)}
                  className="flex min-h-14 w-full items-center justify-between rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5 active:scale-[0.98] disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-[var(--theme-primary)]"
                >
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">
                    {opcao.label}
                  </span>
                  <span className="text-xs text-zinc-400">→</span>
                </button>
              ))}
            </div>

            {/* Aviso de Ciência / LGPD */}
            <div className="rounded-xl bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
              <p>
                Ao continuar, confirmo minha presença no evento e concordo com o tratamento dos meus dados
                para organização do evento e contato sobre oportunidades apresentadas.
              </p>
              <button
                type="button"
                onClick={() => setModalLgpdAberto(true)}
                className="mt-1 font-semibold underline hover:text-[var(--theme-primary)]"
              >
                Ler Política de Privacidade
              </button>
            </div>

            {erro ? <p className="text-sm font-medium text-red-500">{erro}</p> : null}
            {pending ? (
              <p className="text-center text-sm font-semibold text-[var(--theme-primary)] animate-pulse">
                Confirmando sua presença e emitindo número da sorte…
              </p>
            ) : null}
          </div>
        ) : null}

        {/* TELA FINAL — Confirmação e Número da Sorte */}
        {step === "final" ? (
          <div className="space-y-6 text-center animate-fade-in">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
              🎉
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white sm:text-3xl">
                Tudo certo, {primeiroNome}!
              </h1>
              <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                {jaEstavaCadastrado ? "Sua presença já está confirmada." : "Sua presença foi confirmada."}
              </p>
            </div>

            {/* Card com Destaque Máximo para o Número da Sorte */}
            <div className="rounded-3xl border-2 border-[var(--theme-primary)]/40 bg-gradient-to-b from-[var(--theme-primary)]/10 to-transparent p-6 shadow-xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Seu Número da Sorte
              </p>
              <p className="mt-3 font-mono text-5xl font-extrabold tracking-widest text-[var(--theme-primary)] sm:text-6xl">
                {codigoSorte}
              </p>
              <p className="mt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Guarde este número com você
              </p>
            </div>

            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
              <p>Teremos sorteios de prêmios hoje durante o evento. 🎁</p>
              <p>Obrigado por participar e aproveite o evento. Boa sorte! 🍀</p>
            </div>

            <div className="pt-2">
              <Link
                href={`/eventos/${evento.slug}`}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Ver informações do evento
              </Link>
            </div>
          </div>
        ) : null}
      </main>

      {/* Rodapé Seguro */}
      <footer className="mt-auto pt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
        Check-in oficial e seguro · {evento.nome}
      </footer>

      {/* Modal LGPD */}
      {modalLgpdAberto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl dark:bg-zinc-900 dark:text-zinc-100">
            <h3 className="text-lg font-bold">Privacidade e Uso dos Dados</h3>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              <p>
                <strong>Finalidade:</strong> Seus dados coletados (nome, telefone e preferências de
                qualificação) destinam-se exclusivamente à gestão de presença no evento {evento.nome},
                emissão de cupons para sorteios de prêmios e contato comercial posterior referente a planos de
                consórcio e oportunidades patrimoniais apresentadas.
              </p>
              <p>
                <strong>Segurança:</strong> Seus dados são armazenados de forma segura e não serão
                compartilhados com terceiros alheios à organização do evento e à comercialização dos produtos.
              </p>
              <p>
                <strong>Direitos do Titular:</strong> Em conformidade com a Lei Geral de Proteção de Dados
                (Lei nº 13.709/2018 - LGPD), você poderá a qualquer momento solicitar a atualização, confirmação
                ou eliminação dos seus dados entrando em contato com a equipe organizadora.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalLgpdAberto(false)}
              className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--theme-primary)] font-bold text-white shadow-md"
            >
              Entendido e Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
