"use client";

import { useState } from "react";
import { useIniciarContratacao } from "@/lib/contratacoes-online/use-iniciar-contratacao";
import { parcelaReduzida, type EuaPlano } from "@/lib/eua-landing/calculos";
import type { EuaLeadBody } from "@/lib/eua-landing/lead";
import type { EuaOportunidade } from "@/lib/eua-landing/types";
import { mascararTelefone, telefoneCompleto } from "@/lib/eua-landing/telefone";
import { Rich, useEua } from "./eua-ui";
import s from "./eua-landing.module.css";

export type EuaPlanoResumo = NonNullable<EuaLeadBody["plano"]>;

export function lerUtm(): EuaLeadBody["utm"] {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  return { source: p.get("utm_source"), medium: p.get("utm_medium"), campaign: p.get("utm_campaign") };
}

export async function enviarLeadEua(body: Omit<EuaLeadBody, "utm">): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/public/eua/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, utm: lerUtm() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: data.error };
  } catch {
    return { ok: false };
  }
}

type Fone = { ddi: string; numero: string };

export function PhoneInput({ value, onChange }: { value: Fone; onChange: (v: Fone) => void }) {
  const { t } = useEua();
  return (
    <div className={s.phone}>
      <select
        value={value.ddi}
        onChange={(e) => onChange({ ddi: e.target.value, numero: mascararTelefone(e.target.value, value.numero) })}
        aria-label={t("pais")}
      >
        <option value="+1">🇺🇸 +1</option>
        <option value="+55">🇧🇷 +55</option>
      </select>
      <input
        className={s.inp}
        value={value.numero}
        onChange={(e) => onChange({ ...value, numero: mascararTelefone(value.ddi, e.target.value) })}
        placeholder={value.ddi === "+1" ? "(407) 555-1234" : "(66) 99999-9999"}
        inputMode="tel"
        autoComplete="tel-national"
        aria-label={t("whatsapp")}
      />
    </div>
  );
}

function foneValido(f: Fone) {
  return telefoneCompleto(f.ddi, f.numero);
}

export type LeadModo = { tipo: "plano" } | { tipo: "oportunidade"; oportunidade: EuaOportunidade } | { tipo: "lista" };

export function EuaLeadDrawer({
  modo,
  plano,
  resumo,
  onClose,
}: {
  modo: LeadModo;
  plano: EuaPlano;
  resumo: EuaPlanoResumo;
  onClose: () => void;
}) {
  const { lang, t, brl, usd } = useEua();
  const [nome, setNome] = useState("");
  const [fone, setFone] = useState<Fone>({ ddi: "+1", numero: "" });
  const [cidade, setCidade] = useState("");
  const [conjuge, setConjuge] = useState(false);
  const [status, setStatus] = useState<"form" | "enviando" | "ok">("form");
  const [erro, setErro] = useState<string | null>(null);

  const titulo = modo.tipo === "plano" ? t("ldTituloPlano") : modo.tipo === "lista" ? t("ldTituloLista") : t("ldTituloOp");
  const intro = modo.tipo === "plano" ? t("ldIntroPlano") : modo.tipo === "lista" ? t("ldIntroLista") : t("ldIntroOp");

  async function enviar() {
    setErro(null);
    if (!nome.trim() || !foneValido(fone)) return setErro(t("errNomeWhats"));
    setStatus("enviando");
    const op = modo.tipo === "oportunidade" ? modo.oportunidade : null;
    const r = await enviarLeadEua({
      acao: modo.tipo === "plano" ? "plano" : "oportunidade",
      nome,
      whatsapp: `${fone.ddi} ${fone.numero}`,
      cidade: cidade || null,
      idioma: lang,
      conjuge: modo.tipo === "plano" ? conjuge : false,
      plano: resumo,
      oportunidade:
        modo.tipo === "plano"
          ? null
          : op
            ? { tipo: op.tipo, id: op.id, titulo: `${op.titulo}${op.cidade ? ` — ${op.cidade}` : ""}`, valor: op.valor }
            : { tipo: "lista_novos_devolvidos", titulo: cidade ? `Região de interesse: ${cidade}` : null },
    });
    if (!r.ok) {
      setStatus("form");
      return setErro(r.error ?? t("errGenerico"));
    }
    setStatus("ok");
  }

  return (
    <>
      <div className={s.drawerBg} onClick={onClose} />
      <aside className={s.drawer} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className={s.ribbon} />
        <div className={s.drHead}>
          <b>{titulo}</b>
          <button type="button" onClick={onClose} aria-label={t("fechar")}>
            ×
          </button>
        </div>
        <div className={s.drBody}>
          {status === "ok" ? (
            <div className={s.okBox}>
              <div className={s.okBig}>📲</div>
              <h3>{t("ldOkTitle")}</h3>
              <p className={s.muted}>{t("ldOkTxt")}</p>
              <button type="button" className={`${s.btn} ${s.btnO}`} onClick={onClose}>
                {t("fechar")}
              </button>
            </div>
          ) : (
            <>
              <p className={s.muted} style={{ marginTop: 0 }}>
                {intro}
              </p>
              <div className={`${s.card} ${s.darkCard}`} style={{ marginBottom: 14 }}>
                {modo.tipo === "oportunidade" ? (
                  <>
                    <small className={s.muted}>
                      {modo.oportunidade.tipo === "carta" ? t("opBadgeCarta") : t("opBadgeImovel")}
                      {modo.oportunidade.cidade ? ` · ${modo.oportunidade.cidade}` : ""}
                    </small>
                    <br />
                    <b style={{ fontSize: 18 }}>{modo.oportunidade.titulo}</b>
                    <br />
                    <span className={s.brl}>{modo.oportunidade.valor ? brl(modo.oportunidade.valor) : t("opSobConsulta")}</span>
                  </>
                ) : modo.tipo === "lista" ? (
                  <b>{t("opListaTitulo")}</b>
                ) : (
                  <>
                    <small className={s.muted}>{resumo.objetivo}</small>
                    <br />
                    <b style={{ fontSize: 22 }}>{brl(plano.creditoTotal)}</b>
                    <br />
                    <span className={s.muted}>
                      {t("investindo")} {usd(resumo.usdMensal ?? 0)}
                      {t("porMes")}
                    </span>
                  </>
                )}
              </div>
              <div className={s.field}>
                <label>{t("nome")}</label>
                <input className={s.inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("seuNome")} autoComplete="name" />
              </div>
              <div className={s.field}>
                <label>{t("whatsapp")}</label>
                <PhoneInput value={fone} onChange={setFone} />
              </div>
              <div className={s.field}>
                <label>{modo.tipo === "lista" ? t("regiaoInteresse") : t("cidadeEua")}</label>
                <input
                  className={s.inp}
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder={modo.tipo === "lista" ? t("regiaoPh") : t("cidadeEuaPh")}
                />
              </div>
              {modo.tipo === "plano" ? (
                <label className={s.check}>
                  <input type="checkbox" checked={conjuge} onChange={(e) => setConjuge(e.target.checked)} /> {t("conjuge")}
                </label>
              ) : null}
              <button type="button" className={`${s.btn} ${s.btnY} ${s.btnBlock}`} style={{ marginTop: 16 }} onClick={enviar} disabled={status === "enviando"}>
                {status === "enviando" ? t("enviando") : t("enviar")}
              </button>
              {erro ? <p className={s.err}>{erro}</p> : null}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export function EuaCheckoutDrawer({
  plano,
  opcoes,
  resumo,
  onClose,
}: {
  plano: EuaPlano;
  opcoes: number[];
  resumo: EuaPlanoResumo;
  onClose: () => void;
}) {
  const { lang, t, brl, usd } = useEua();
  const { iniciar, loading } = useIniciarContratacao();
  const cambio = resumo.cambio ?? 5.4;
  const [passo, setPasso] = useState(0);
  const [sel, setSel] = useState(Math.max(0, opcoes.indexOf(plano.creditoPorCota)));
  const [nome, setNome] = useState("");
  const [fone, setFone] = useState<Fone>({ ddi: "+1", numero: "" });
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const creditoCota = opcoes[sel] ?? plano.creditoPorCota;
  const qtd = plano.quantidadeCotas;
  const creditoTotal = creditoCota * qtd;
  const parcelaTotal = parcelaReduzida(creditoCota, plano.tipoBem) * qtd;
  const grupoLabel = `${plano.grupo.grupo} · ${plano.grupo.prazoMeses} ${t("meses")}`;

  async function continuar() {
    setErro(null);
    if (passo === 0) return setPasso(1);
    if (!nome.trim() || !foneValido(fone)) return setErro(t("errNomeWhats"));
    const whatsapp = `${fone.ddi} ${fone.numero}`;
    const resumoCota = { ...resumo, creditoTotal, parcelaReduzida: parcelaTotal, quantidadeCotas: qtd };
    // Registra o interesse no CRM mesmo que o cliente não conclua a proposta.
    await enviarLeadEua({ acao: "contratar", nome, whatsapp, email: email || null, idioma: lang, plano: resumoCota });
    try {
      await iniciar({
        modo: "cliente_site",
        origem: "simulador",
        cliente_pre_nome: nome.trim(),
        cliente_pre_telefone: whatsapp,
        cliente_pre_email: email.trim() || undefined,
        dados_simulacao: {
          modo: "consorcio",
          tipoBem: plano.tipoBem === "veiculo" ? "automovel" : "imovel",
          entrada: { valorCredito: creditoTotal, prazoMeses: plano.grupo.prazoMeses },
          resultado: {
            valorCredito: creditoTotal,
            parcelaEstimada: parcelaTotal,
            parcelaReduzida: parcelaTotal,
            prazoMeses: plano.grupo.prazoMeses,
            quantidadeCotas: qtd,
          },
          landingEua: {
            ...resumoCota,
            creditoPorCota: creditoCota,
            grupoReferencia: plano.grupo.grupo,
            idioma: lang,
          },
        },
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("errGenerico"));
    }
  }

  return (
    <>
      <div className={s.drawerBg} onClick={onClose} />
      <aside className={s.drawer} role="dialog" aria-modal="true" aria-label={t("ckTitle")}>
        <div className={s.ribbon} />
        <div className={s.drHead}>
          <b>{t("ckTitle")}</b>
          <button type="button" onClick={onClose} aria-label={t("fechar")}>
            ×
          </button>
        </div>
        <div className={s.progress}>
          <span className={s.progOn} />
          <span className={passo >= 1 ? s.progOn : ""} />
          <span />
          <span />
        </div>
        <div className={s.drBody}>
          {passo === 0 ? (
            <>
              <h3>{t("ck1")}</h3>
              <p className={s.muted} style={{ marginTop: 0 }}>
                {t("ck1s")}
              </p>
              {opcoes.map((v, i) => {
                const p = parcelaReduzida(v, plano.tipoBem) * qtd;
                return (
                  <button type="button" key={v} className={`${s.cotaOpt} ${i === sel ? s.cotaOptOn : ""}`} onClick={() => setSel(i)}>
                    <span>
                      <b className={s.num}>{brl(v * qtd)}</b>
                      <br />
                      <small className={s.muted}>
                        {t("ckGrupo")} {grupoLabel}
                        {qtd > 1 ? ` · ${qtd}${t("ckCotas")}` : ""}
                      </small>
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <b className={`${s.brl} ${s.num}`}>{brl(p)}</b>
                      <br />
                      <small className={`${s.usd} ${s.num}`}>
                        ≈ {usd(p / cambio)}
                        {t("porMes")}
                      </small>
                    </span>
                  </button>
                );
              })}
              <p className={s.muted} style={{ fontSize: 13 }}>
                {t("ckIncluiTreino")}
              </p>
            </>
          ) : (
            <>
              <h3>{t("ck2")}</h3>
              <p className={s.muted} style={{ marginTop: 0 }}>
                <Rich text={t("ck2s")} />
              </p>
              <div className={s.field}>
                <label>{t("nomeCompleto")}</label>
                <input className={s.inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("comoDocumento")} autoComplete="name" />
              </div>
              <div className={s.field}>
                <label>{t("whatsapp")}</label>
                <PhoneInput value={fone} onChange={setFone} />
              </div>
              <div className={s.field}>
                <label>{t("email")}</label>
                <input className={s.inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
              </div>
              <div className={`${s.card} ${s.darkCard}`}>
                <b className={s.num} style={{ fontSize: 20 }}>
                  {brl(creditoTotal)}
                </b>
                <br />
                <span className={s.muted}>
                  {t("parcelaReduzida")} <b className={s.brl}>{brl(parcelaTotal)}</b> (≈ {usd(parcelaTotal / cambio)}
                  {t("porMes")})
                </span>
              </div>
            </>
          )}
          {erro ? <p className={s.err}>{erro}</p> : null}
        </div>
        <div className={s.drFoot}>
          <button
            type="button"
            className={`${s.btn} ${s.btnO}`}
            style={{ visibility: passo === 0 ? "hidden" : "visible" }}
            onClick={() => setPasso(0)}
          >
            {t("ckVoltar")}
          </button>
          <button type="button" className={`${s.btn} ${s.btnY}`} style={{ flex: 1 }} onClick={continuar} disabled={loading}>
            {loading ? t("ckEnviando") : passo === 0 ? t("ckBotaoContinuar") : t("ckBotaoIr")}
          </button>
        </div>
      </aside>
    </>
  );
}
