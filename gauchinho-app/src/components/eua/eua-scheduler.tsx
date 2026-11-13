"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { EUA_CANAIS_REUNIAO } from "@/lib/eua-landing/lead";
import { PhoneInput, enviarLeadEua, type EuaPlanoResumo } from "./eua-forms";
import { Rich, useEua } from "./eua-ui";
import s from "./eua-landing.module.css";

const SINOP_TZ = "America/Cuiaba";
/** Cuiabá não tem horário de verão: UTC-4 fixo. */
const SINOP_UTC_OFFSET = 4;
const ATENDIMENTO_INICIO = 9;
const ATENDIMENTO_FIM = 19;

const FUSOS = [
  { value: "America/New_York", label: "Eastern (NY, FL, MA, NJ)" },
  { value: "America/Chicago", label: "Central (TX, IL)" },
  { value: "America/Denver", label: "Mountain (CO, UT)" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Los_Angeles", label: "Pacific (CA, WA)" },
];

type Dia = { key: string; inicioUtc: Date; slots: Date[] };

/** Próximos dias de atendimento (segunda a sábado, horário de Sinop). */
function proximosDias(agora: Date, quantidade = 6): Dia[] {
  const dias: Dia[] = [];
  const limite = new Date(agora.getTime() + 60 * 60 * 1000);
  const sinopHoje = new Date(agora.getTime() - SINOP_UTC_OFFSET * 3600 * 1000);
  for (let i = 0; dias.length < quantidade && i < 14; i++) {
    const base = Date.UTC(sinopHoje.getUTCFullYear(), sinopHoje.getUTCMonth(), sinopHoje.getUTCDate() + i);
    const diaSemana = new Date(base).getUTCDay();
    if (diaSemana === 0) continue;
    const slots: Date[] = [];
    for (let h = ATENDIMENTO_INICIO; h < ATENDIMENTO_FIM; h++) {
      for (const m of [0, 30]) {
        const d = new Date(base + ((h + SINOP_UTC_OFFSET) * 60 + m) * 60 * 1000);
        if (d > limite) slots.push(d);
      }
    }
    if (slots.length) dias.push({ key: new Date(base).toISOString(), inicioUtc: new Date(base + 12 * 3600 * 1000), slots });
  }
  return dias;
}

const semInscricao = () => () => {};
function fusoDoAparelho(): string | null {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return FUSOS.some((f) => f.value === tz) ? tz : null;
}

export function EuaScheduler({ plano, agoraIso }: { plano: EuaPlanoResumo; agoraIso: string }) {
  const { lang, loc, t } = useEua();
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);
  const fusoDetectado = useSyncExternalStore(semInscricao, fusoDoAparelho, () => null);
  const [fusoEscolhido, setFuso] = useState<string | null>(null);
  const fuso = fusoEscolhido ?? fusoDetectado ?? FUSOS[0]!.value;
  const [diaIdx, setDiaIdx] = useState(0);
  const [slot, setSlot] = useState<Date | null>(null);
  const [canal, setCanal] = useState<(typeof EUA_CANAIS_REUNIAO)[number]>("WhatsApp");
  const [nome, setNome] = useState("");
  const [fone, setFone] = useState({ ddi: "+1", numero: "" });
  const [status, setStatus] = useState<"form" | "enviando" | "ok">("form");
  const [erro, setErro] = useState<string | null>(null);

  const dias = useMemo(() => proximosDias(agora), [agora]);
  const dia = dias[diaIdx];

  const fmtDiaSemana = new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: fuso });
  const fmtDiaNum = new Intl.DateTimeFormat(loc, { day: "2-digit", timeZone: fuso });
  const fmtHora = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: fuso });
  const fmtHoraSinop = new Intl.DateTimeFormat(loc, { hour: "numeric", minute: "2-digit", timeZone: SINOP_TZ });
  const fmtCompleto = new Intl.DateTimeFormat(loc, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: fuso });

  async function solicitar() {
    setErro(null);
    if (!slot) return setErro(t("errHorario"));
    if (!nome.trim() || fone.numero.replace(/\D/g, "").length < 8) return setErro(t("errNomeWhats"));
    setStatus("enviando");
    const ok = await enviarLeadEua({
      acao: "reuniao",
      nome,
      whatsapp: `${fone.ddi} ${fone.numero}`,
      idioma: lang,
      plano,
      reuniao: { inicioIso: slot.toISOString(), fuso, canal },
    });
    if (!ok.ok) {
      setStatus("form");
      return setErro(ok.error ?? t("errGenerico"));
    }
    setStatus("ok");
  }

  if (status === "ok" && slot) {
    const iso = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const fim = new Date(slot.getTime() + 15 * 60 * 1000);
    const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t("agendaTitulo"))}&dates=${iso(slot)}/${iso(fim)}`;
    return (
      <div className={s.okBox}>
        <div className={s.okBig}>✅</div>
        <h3>{t("reuOkTitle")}</h3>
        <p className={s.muted}>
          <Rich text={t("reuOkTxt", { nome: nome.trim().split(" ")[0] ?? "", canal, quando: fmtCompleto.format(slot) })} />
        </p>
        <a className={`${s.btn} ${s.btnO}`} href={gcal} target="_blank" rel="noopener noreferrer">
          {t("addAgenda")}
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className={s.headRow}>
        <div className={s.avatar}>👨‍💼</div>
        <div>
          <h3>{t("reuTitle")}</h3>
          <span className={s.muted}>{t("reuSub")}</span>
        </div>
      </div>
      <div className={s.tz}>
        <span className={s.muted}>{t("seuFuso")}</span>
        <select className={s.selSmall} value={fuso} onChange={(e) => setFuso(e.target.value)} aria-label={t("seuFuso")}>
          {FUSOS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div className={s.days}>
        {dias.map((d, i) => (
          <button
            type="button"
            key={d.key}
            className={`${s.day} ${i === diaIdx ? s.dayOn : ""}`}
            onClick={() => {
              setDiaIdx(i);
              setSlot(null);
            }}
          >
            {fmtDiaSemana.format(d.inicioUtc).replace(".", "")}
            <b>{fmtDiaNum.format(d.inicioUtc)}</b>
          </button>
        ))}
      </div>
      <div className={s.slots}>
        {dia ? (
          dia.slots.map((d) => (
            <button
              type="button"
              key={d.toISOString()}
              className={`${s.slot} ${slot && slot.getTime() === d.getTime() ? s.slotOn : ""}`}
              onClick={() => setSlot(d)}
            >
              {fmtHora.format(d)}
              <small>
                {t("horaSinop")}
                {fmtHoraSinop.format(d)}
              </small>
            </button>
          ))
        ) : (
          <p className={s.muted} style={{ gridColumn: "1 / -1" }}>
            {t("semHorarios")}
          </p>
        )}
      </div>
      <div className={s.chan}>
        {EUA_CANAIS_REUNIAO.map((c) => (
          <button type="button" key={c} className={canal === c ? s.chanOn : ""} onClick={() => setCanal(c)}>
            {c === "WhatsApp" ? "🟢 WhatsApp" : c === "Zoom" ? "🎥 Zoom" : "📹 Meet"}
          </button>
        ))}
      </div>
      <div className={s.row2}>
        <input className={s.inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("seuNome")} autoComplete="name" />
        <PhoneInput value={fone} onChange={setFone} />
      </div>
      <button type="button" className={`${s.btn} ${s.btnC} ${s.btnBlock}`} onClick={solicitar} disabled={status === "enviando"}>
        {status === "enviando" ? t("enviando") : t("confirmarReuniao")}
      </button>
      {erro ? <p className={s.err}>{erro}</p> : null}
    </div>
  );
}
