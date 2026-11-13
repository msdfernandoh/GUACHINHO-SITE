"use client";

import { Fragment, createContext, useContext } from "react";
import { euaText, type EuaCopyKey, type EuaLang } from "@/lib/eua-landing/copy";
import s from "./eua-landing.module.css";

export const EuaLangContext = createContext<EuaLang>("pt");

export function useEua() {
  const lang = useContext(EuaLangContext);
  const loc = lang === "en" ? "en-US" : "pt-BR";
  const t = (key: EuaCopyKey, vars?: Record<string, string | number>) => euaText(lang, key, vars);
  const brl = (v: number) => `R$ ${Math.round(v).toLocaleString(loc)}`;
  const brlK = (v: number) =>
    v >= 1e6
      ? `R$ ${(v / 1e6).toLocaleString(loc, { maximumFractionDigits: 2 })}${t("mi")}`
      : `R$ ${Math.round(v / 1000).toLocaleString(loc)}${t("mil")}`;
  const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
  return { lang, loc, t, brl, brlK, usd };
}

/** Renderiza `**trecho**` como negrito. */
export function Rich({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

export function Flag({ country, large }: { country: "us" | "br"; large?: boolean }) {
  return <span aria-hidden className={`${s.fl} ${country === "us" ? s.flUs : s.flBr} ${large ? s.flLg : ""}`} />;
}

export function Brand({ large, iconUrl, franqueado }: { large?: boolean; iconUrl: string | null; franqueado: string }) {
  return (
    <span className={`${s.brand} ${large ? s.brandLg : s.topBrand}`} aria-label="Racon Consórcios · Franqueado Gauchinho">
      <span className={s.rc}>
        <span className={s.rcW}>
          Rac<span className={s.rcO}>o</span>n
        </span>
        <span className={s.rcC}>Consórcios</span>
      </span>
      <span className={s.sep} />
      <span className={s.fr}>
        <span className={s.gIcon}>
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- ícone pequeno da marca, sem otimização necessária
            <img src={iconUrl} alt="" width={40} height={40} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            "G"
          )}
        </span>
        <span>
          <small className={s.frSmall}>{franqueado}</small>
          <b className={s.frBig}>GAUCHINHO</b>
        </span>
      </span>
    </span>
  );
}

export function rangeFill(value: number, min: number, max: number) {
  return { ["--p" as string]: `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties;
}
