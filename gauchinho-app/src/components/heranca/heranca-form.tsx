"use client";

import { useState } from "react";
import { formatWhatsappBrInput } from "@/lib/utils/format";
import type { HerancaEventoView } from "./types";
import s from "./heranca.module.css";

type Modo = "evento" | "info";
type Resultado =
  | { tipo: "confirmado"; mensagem: string }
  | { tipo: "espera" }
  | { tipo: "info" };

const MSG_ESPERA =
  "As vagas deste encontro já foram preenchidas. Devido à grande procura, vamos realizar um novo encontro e você será informado pelo WhatsApp assim que a nova data for definida.";

function lerUtm() {
  const p = new URLSearchParams(window.location.search);
  return { source: p.get("utm_source"), medium: p.get("utm_medium"), campaign: p.get("utm_campaign") };
}

export function HerancaForm({
  evento,
  modoInicial = "evento",
  somenteEvento = false,
}: {
  evento: HerancaEventoView | null;
  modoInicial?: Modo;
  somenteEvento?: boolean;
}) {
  const [modo, setModo] = useState<Modo>(evento ? modoInicial : "info");
  const [nome, setNome] = useState("");
  const [fone, setFone] = useState("");
  const [qtd, setQtd] = useState(1);
  const [idades, setIdades] = useState<string[]>([""]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function escolherQtd(n: number) {
    setQtd(n);
    setIdades((atual) => Array.from({ length: n }, (_, i) => atual[i] ?? ""));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const digitos = fone.replace(/\D/g, "");
    if (!nome.trim()) return setErro("Informe seu nome.");
    if (digitos.length < 10) return setErro("Informe o WhatsApp com DDD.");
    const lista = idades.map((v) => v.trim());
    if (lista.some((v) => v === "" || !/^\d{1,2}$/.test(v))) return setErro("Informe a idade de cada filho.");
    const filhosIdades = lista.map(Number);

    setEnviando(true);
    try {
      if (modo === "evento" && evento) {
        const res = await fetch("/api/public/eventos/inscricao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: evento.slug, nomeParticipante: nome.trim(), telefoneParticipante: fone, filhosIdades }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; status?: string; mensagem?: string };
        if (!res.ok) throw new Error(data.error ?? "Não foi possível concluir sua inscrição.");
        setResultado(data.status === "lista_espera" ? { tipo: "espera" } : { tipo: "confirmado", mensagem: data.mensagem ?? "" });
      } else {
        const res = await fetch("/api/public/filhos/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: nome.trim(), whatsapp: fone, filhosIdades, utm: lerUtm() }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar agora.");
        setResultado({ tipo: "info" });
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar agora.");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    const primeiro = nome.trim().split(" ")[0];
    if (resultado.tipo === "espera") {
      return (
        <div className={`${s.form} ${s.ok}`}>
          <div className={s.okEmoji}>💛</div>
          <h3>Obrigado, {primeiro}!</h3>
          <p className={s.okEspera}>{MSG_ESPERA}</p>
          <p>Seu nome já está na lista de prioridade.</p>
        </div>
      );
    }
    if (resultado.tipo === "info") {
      return (
        <div className={`${s.form} ${s.ok}`}>
          <div className={s.okEmoji}>📲</div>
          <h3>Recebemos, {primeiro}!</h3>
          <p>Em breve você recebe no WhatsApp como a carta de R$ 100 mil pode construir o futuro {qtd > 1 ? "dos seus filhos" : "do seu filho"}.</p>
        </div>
      );
    }
    const agenda =
      evento?.dataIso != null
        ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(evento.nome)}&dates=${iso(evento.dataIso)}/${iso(new Date(new Date(evento.dataIso).getTime() + 90 * 60000).toISOString())}${evento.local ? `&location=${encodeURIComponent([evento.local, evento.endereco, evento.cidade].filter(Boolean).join(", "))}` : ""}`
        : null;
    const convite = `https://wa.me/?text=${encodeURIComponent(
      `Conheci o Método Herança Inteligente: um jeito de construir o patrimônio dos filhos enquanto eles crescem — e estar junto no dia de entregar a chave. ` +
        `Vai ter um encontro gratuito${evento?.dataLabel ? ` ${evento.dataLabel}` : ""}${evento?.local ? `, no ${evento.local}` : ""}, com vagas limitadas. ` +
        `Garanta a sua: ${linkEvento()}`,
    )}`;
    return (
      <div className={`${s.form} ${s.ok}`}>
        <div className={s.okEmoji}>🔑</div>
        <h3>Sua vaga está garantida, {primeiro}!</h3>
        <p>{resultado.mensagem || "Inscrição confirmada! Em breve nosso time entra em contato."}</p>
        {evento?.dataLabel ? (
          <p>
            <b>{evento.dataLabel}</b>
            {evento.local ? ` · ${evento.local}` : ""}
          </p>
        ) : (
          <p>A data e o local chegam no seu WhatsApp.</p>
        )}
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {agenda ? (
            <a className={`${s.btn} ${s.btnInk}`} href={agenda} target="_blank" rel="noopener noreferrer">
              📅 Salvar na agenda
            </a>
          ) : null}
          <a className={`${s.btn} ${s.btnGold}`} href={convite} target="_blank" rel="noopener noreferrer">
            Compartilhe essa oportunidade com outros pais
          </a>
        </div>
      </div>
    );
  }

  return (
    <form className={s.form} onSubmit={enviar} noValidate>
      {evento && !somenteEvento ? (
        <div className={s.abas} role="tablist">
          <button type="button" role="tab" aria-selected={modo === "evento"} className={modo === "evento" ? s.abaOn : ""} onClick={() => setModo("evento")}>
            Quero participar do encontro
          </button>
          <button type="button" role="tab" aria-selected={modo === "info"} className={modo === "info" ? s.abaOn : ""} onClick={() => setModo("info")}>
            Só quero informações
          </button>
        </div>
      ) : null}
      <h3>{modo === "evento" ? "Reserve sua vaga no encontro" : "Receba o método no seu WhatsApp"}</h3>
      <p className={s.muted} style={{ marginTop: -4 }}>
        {modo === "evento"
          ? "Encontro gratuito e presencial. Leva menos de 1 minuto."
          : "Enviamos como a carta de R$ 100 mil funciona para a idade do seu filho."}
      </p>
      <div className={s.field}>
        <label htmlFor="h-nome">Seu nome</label>
        <input id="h-nome" className={s.inp} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" placeholder="Nome e sobrenome" />
      </div>
      <div className={s.field}>
        <label htmlFor="h-fone">WhatsApp</label>
        <input
          id="h-fone"
          className={s.inp}
          value={fone}
          onChange={(e) => setFone(formatWhatsappBrInput(e.target.value))}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(66) 99999-9999"
        />
      </div>
      <div className={s.field}>
        <label>Quantos filhos você tem?</label>
        <div className={s.qtd}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button type="button" key={n} className={qtd === n ? s.qtdOn : ""} onClick={() => escolherQtd(n)} aria-pressed={qtd === n}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className={s.field}>
        <label>{qtd > 1 ? "Idade de cada filho" : "Idade do seu filho"}</label>
        <div className={s.idades}>
          {idades.map((v, i) => (
            <label className={s.idade} key={i}>
              <small>{qtd > 1 ? `${i + 1}º filho` : "Filho"}</small>
              <div>
                <input
                  value={v}
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="0"
                  aria-label={`Idade do ${i + 1}º filho`}
                  onChange={(e) => setIdades((atual) => atual.map((x, j) => (j === i ? e.target.value.replace(/\D/g, "").slice(0, 2) : x)))}
                />
                <span>anos</span>
              </div>
            </label>
          ))}
        </div>
      </div>
      <button type="submit" className={`${s.btn} ${s.btnGold} ${s.btnBlock}`} disabled={enviando}>
        {enviando ? "Enviando…" : modo === "evento" ? "Garantir minha vaga" : "Quero receber"}
      </button>
      {erro ? <p className={s.erro}>{erro}</p> : null}
      <p className={s.formNota}>🔒 Seus dados ficam com a equipe Racon Sinop · Franqueado Gauchinho.</p>
    </form>
  );
}

/** No subdomínio filhos. a inscrição é /evento; no domínio principal, /filhos/evento. */
function linkEvento() {
  if (typeof window === "undefined") return "";
  const { origin, host } = window.location;
  return `${origin}${host.startsWith("filhos.") ? "/evento" : "/filhos/evento"}`;
}

function iso(d: string) {
  return new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, "");
}
