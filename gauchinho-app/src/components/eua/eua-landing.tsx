"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EUA_GRUPOS,
  EUA_OBJETIVO_TIPO_BEM,
  aluguelEstimado,
  calcularPlano,
  cartaParaLiquido,
  comparativoFinanciamento,
  lanceEmbutido,
  opcoesDeCota,
  parcelaReduzida,
  type EuaObjetivo,
  type EuaUrgencia,
} from "@/lib/eua-landing/calculos";
import type { EuaCopyKey, EuaLang } from "@/lib/eua-landing/copy";
import type { EuaLandingProps, EuaOportunidade } from "@/lib/eua-landing/types";
import { EuaCheckoutDrawer, EuaLeadDrawer, type EuaPlanoResumo, type LeadModo } from "./eua-forms";
import { EuaScheduler } from "./eua-scheduler";
import { Brand, EuaLangContext, Flag, Rich, rangeFill, useEua } from "./eua-ui";
import s from "./eua-landing.module.css";

const OBJETIVOS: { id: EuaObjetivo; e: string; t: EuaCopyKey; sub: EuaCopyKey }[] = [
  { id: "imovel", e: "🏠", t: "objImovel", sub: "objImovelSub" },
  { id: "renda", e: "🏘️", t: "objRenda", sub: "objRendaSub" },
  { id: "veiculo", e: "🚙", t: "objVeiculo", sub: "objVeiculoSub" },
  { id: "alavancagem", e: "📈", t: "objAlav", sub: "objAlavSub" },
];
const URGENCIAS: { id: EuaUrgencia; e: string; t: EuaCopyKey; sub: EuaCopyKey; estrat: EuaCopyKey }[] = [
  { id: "ja", e: "⚡", t: "urgJa", sub: "urgJaSub", estrat: "estratJa" },
  { id: "ano", e: "🗓️", t: "urgAno", sub: "urgAnoSub", estrat: "estratAno" },
  { id: "calma", e: "🌱", t: "urgCalma", sub: "urgCalmaSub", estrat: "estratCalma" },
];
const COMPRAS: Record<EuaObjetivo, [string, string][]> = {
  imovel: [["🏠 Casa", "🏠 House"], ["🏢 Apartamento", "🏢 Apartment"], ["🌳 Terreno", "🌳 Land"], ["🔨 Construção/reforma", "🔨 Build/renovate"]],
  renda: [["🏢 Apto para alugar", "🏢 Rental apartment"], ["🏬 Sala comercial", "🏬 Office unit"], ["🏘️ Kitnets", "🏘️ Studios"], ["🏗️ Imóvel novo sendo entregue", "🏗️ New unit being delivered"]],
  veiculo: [["🚗 Carro 0km", "🚗 New car"], ["🚙 SUV", "🚙 SUV"], ["🛻 Caminhonete", "🛻 Pickup truck"], ["🏍️ Moto", "🏍️ Motorcycle"]],
  alavancagem: [["📑 Várias cartas", "📑 Several letters"], ["💰 Compra à vista", "💰 Cash purchase"], ["🔁 Imóveis devolvidos", "🔁 Returned units"], ["🏘️ Imóveis para renda", "🏘️ Income properties"]],
};
type Aba = "aposent" | "alav" | "carro" | "volta" | "cmp";
const ABAS: { id: Aba; t: EuaCopyKey }[] = [
  { id: "aposent", t: "tabAposent" },
  { id: "alav", t: "tabAlav" },
  { id: "carro", t: "tabCarro" },
  { id: "volta", t: "tabVolta" },
  { id: "cmp", t: "tabCmp" },
];

export function EuaLanding(props: EuaLandingProps) {
  const [lang, setLang] = useState<EuaLang>(props.initialLang);

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
    const url = new URL(window.location.href);
    if (lang === "en") url.searchParams.set("lang", "en");
    else url.searchParams.delete("lang");
    window.history.replaceState(null, "", url);
  }, [lang]);

  return (
    <EuaLangContext.Provider value={lang}>
      <EuaLandingBody {...props} onLang={setLang} />
    </EuaLangContext.Provider>
  );
}

function EuaLandingBody({ cambio, cambioData, oportunidades, contatos, iconeGauchinhoUrl, agoraIso, onLang }: EuaLandingProps & { onLang: (l: EuaLang) => void }) {
  const { lang, loc, t, brl, brlK, usd } = useEua();
  const pick = (par: [string, string]) => (lang === "en" ? par[1] : par[0]);

  const [heroUsd, setHeroUsd] = useState("300");
  const [usdMensal, setUsdMensal] = useState(300);
  const [objetivo, setObjetivo] = useState<EuaObjetivo>("imovel");
  const [urgencia, setUrgencia] = useState<EuaUrgencia>("ano");
  const [lcCredito, setLcCredito] = useState(300_000);
  const [lcPct, setLcPct] = useState(25);
  const [rvWant, setRvWant] = useState(300_000);
  const [opFiltro, setOpFiltro] = useState<"all" | "imovel" | "carta">("all");
  const [aba, setAba] = useState<Aba>("aposent");
  const [apN, setApN] = useState(3);
  const [apV, setApV] = useState(250_000);
  const [voAnos, setVoAnos] = useState(5);
  const anoAtual = new Date(agoraIso).getFullYear();
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [lead, setLead] = useState<LeadModo | null>(null);

  const tipoBem = EUA_OBJETIVO_TIPO_BEM[objetivo];
  const plano = useMemo(() => calcularPlano(usdMensal, cambio, tipoBem), [usdMensal, cambio, tipoBem]);
  const heroNum = Number(heroUsd.replace(/\D/g, "")) || 0;
  const heroPlano = useMemo(() => calcularPlano(heroNum, cambio, "imovel"), [heroNum, cambio]);
  const urg = URGENCIAS.find((u) => u.id === urgencia)!;
  const objetivoCfg = OBJETIVOS.find((o) => o.id === objetivo)!;

  const resumo: EuaPlanoResumo = {
    objetivo: t(objetivoCfg.t),
    tipoBem,
    urgencia,
    usdMensal,
    cambio,
    creditoTotal: plano.creditoTotal,
    parcelaReduzida: plano.parcelaReduzidaTotal,
    quantidadeCotas: plano.quantidadeCotas,
    grupo: plano.grupo.grupo,
  };

  const lance = lanceEmbutido(lcCredito, lcPct / 100);
  const alUma = calcularPlano(usdMensal * 2, cambio, "imovel").creditoPossivel;
  const cmp = comparativoFinanciamento(300_000);
  const aluguel = aluguelEstimado(apN, apV);

  const opsFiltradas = oportunidades.filter((o) => opFiltro === "all" || o.tipo === opFiltro);

  const waLink = (numero: string, quem: string) =>
    `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(t("waMsg", { quem }))}`;

  return (
    <div className={s.root}>
      {/* Topo */}
      <header className={s.top}>
        <div className={s.ribbon} />
        <div className={`${s.wrap} ${s.topRow}`}>
          <a href="#topo" style={{ textDecoration: "none" }}>
            <Brand iconUrl={iconeGauchinhoUrl} franqueado={t("franqueado")} />
          </a>
          <nav className={s.nav}>
            <a href="#plano">{t("navPlano")}</a>
            <a href="#lance">{t("navLance")}</a>
            <a href="#oportunidades">{t("navOportunidades")}</a>
            <a href="#estrategias">{t("navEstrategias")}</a>
            <a href="#decidir">{t("navDecidir")}</a>
            <a href="#faq">{t("navFaq")}</a>
          </nav>
          <div className={s.lang} role="group" aria-label="Idioma / Language">
            <button type="button" className={lang === "pt" ? s.langOn : ""} onClick={() => onLang("pt")} aria-pressed={lang === "pt"}>
              <Flag country="br" />
              PT
            </button>
            <button type="button" className={lang === "en" ? s.langOn : ""} onClick={() => onLang("en")} aria-pressed={lang === "en"}>
              <Flag country="us" />
              EN
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className={s.hero} id="topo">
        <div className={`${s.wrap} ${s.heroGrid}`}>
          <div>
            <span className={s.tag}>
              <Flag country="us" /> → <Flag country="br" /> {t("heroTag")}
            </span>
            <h1 className={s.heroTitle}>
              {t("heroTitle1")}
              <span className={s.hl}>{t("heroTitle2")}</span>
            </h1>
            <p className={s.lead}>
              <Rich text={t("heroLead")} />
            </p>
            <div className={s.heroCtas}>
              <a href="#plano" className={`${s.btn} ${s.btnY}`}>
                {t("heroCtaPlano")}
              </a>
              <a href="#decidir" className={`${s.btn} ${s.btnO}`}>
                {t("heroCtaReuniao")}
              </a>
            </div>
            <div className={s.trust}>
              <span><i>●</i> {t("trust1")}</span>
              <span><i>●</i> {t("trust2")}</span>
              <span><i>●</i> {t("trust3")}</span>
            </div>
          </div>
          <div className={s.converter}>
            <h3>{t("convTitle")}</h3>
            <label className={`${s.convRow} ${s.convUs}`}>
              <Flag country="us" large />
              <span className={s.cur}>$</span>
              <input
                className={s.num}
                inputMode="numeric"
                value={heroUsd}
                aria-label="USD"
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setHeroUsd(v);
                  const n = Number(v);
                  if (n >= 100 && n <= 3000) setUsdMensal(Math.round(n / 25) * 25);
                }}
              />
              <span className={s.cur}>{t("convPorMes")}</span>
            </label>
            <div className={s.convArrow}>{t("convVira")}</div>
            <div className={`${s.convRow} ${s.convBr}`}>
              <Flag country="br" large />
              <span className={`${s.convOut} ${s.brl} ${s.num}`}>{brl(heroPlano.reaisMensal)}</span>
              <span className={s.cur} style={{ marginLeft: "auto" }}>{t("convPorMesBr")}</span>
            </div>
            <div className={s.convBig}>
              <div className={s.convLbl}>{t("convCompra")}</div>
              <div className={`${s.convVal} ${s.num}`}>
                {heroPlano.abaixoDoMinimo ? t("aPartirDe") + brl(EUA_GRUPOS.imovel.creditoMinimo) : brl(heroPlano.creditoPossivel)}
              </div>
              <small>{t("convNota")}</small>
            </div>
            <div className={s.fx}>
              <span>
                {t("cambioRef")} <b className={s.num}>R$ {cambio.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
              </span>
              <span>
                {t("cambioFonte")}
                {cambioData ? ` · ${cambioData}` : ""}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className={s.strip}>
        <div><b>{t("strip1a")}</b>{t("strip1b")}</div>
        <div><b>B3: RAPT4</b>{t("strip2b")}</div>
        <div><b>{t("strip3a")}</b>{t("strip3b")}</div>
        <div><b>{t("strip4a")}</b>{t("strip4b")}</div>
        <div><b>Sinop · MT</b>{t("strip5b")}</div>
      </div>

      {/* Plano */}
      <section id="plano">
        <div className={s.wrap}>
          <div className={s.secHead}>
            <span className={s.tag}>{t("planoTag")}</span>
            <h2>{t("planoTitle")}</h2>
            <p>{t("planoSub")}</p>
            <div className={s.bridge} />
          </div>
          <div className={s.wizard}>
            <div className={s.card}>
              <p className={s.stepLbl}><span className={s.stepN}>1</span> {t("passo1")}</p>
              <div className={s.chips}>
                {OBJETIVOS.map((o) => (
                  <button type="button" key={o.id} className={`${s.chip} ${objetivo === o.id ? s.chipOn : ""}`} onClick={() => setObjetivo(o.id)} aria-pressed={objetivo === o.id}>
                    <span className={s.chipE}>{o.e}</span>
                    <b>{t(o.t)}</b>
                    <small>{t(o.sub)}</small>
                  </button>
                ))}
              </div>
              <p className={s.stepLbl}><span className={s.stepN}>2</span> {t("passo2")}</p>
              <div className={s.sliderBox}>
                <div className={s.sliderTop}>
                  <span className={`${s.bigV} ${s.usd} ${s.num}`}>{usd(usdMensal)}</span>
                  <span className={`${s.muted} ${s.num}`}>≈ {brl(plano.reaisMensal)}{t("porMes")}</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={3000}
                  step={25}
                  value={usdMensal}
                  style={rangeFill(usdMensal, 100, 3000)}
                  aria-label="USD"
                  onChange={(e) => {
                    setUsdMensal(Number(e.target.value));
                    setHeroUsd(e.target.value);
                  }}
                />
                <div className={s.quick}>
                  {[150, 300, 500, 1000, 2000].map((q) => (
                    <button type="button" key={q} onClick={() => { setUsdMensal(q); setHeroUsd(String(q)); }}>
                      {usd(q)}
                    </button>
                  ))}
                </div>
              </div>
              <p className={s.stepLbl}><span className={s.stepN}>3</span> {t("passo3")}</p>
              <div className={`${s.chips} ${s.chips3}`}>
                {URGENCIAS.map((u) => (
                  <button type="button" key={u.id} className={`${s.chip} ${urgencia === u.id ? s.chipOn : ""}`} onClick={() => setUrgencia(u.id)} aria-pressed={urgencia === u.id}>
                    <span className={s.chipE}>{u.e}</span>
                    <b>{t(u.t)}</b>
                    <small>{t(u.sub)}</small>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className={s.plan}>
                <div className={`${s.ribbon} ${s.planRibbon}`} />
                <div className={s.planTtl}>{t("seuPlano")}{t(objetivoCfg.t)}</div>
                <div className={`${s.planCredit} ${s.num}`}>{brl(plano.creditoTotal)}</div>
                <div className={s.planSub}>{t("planoCreditoSub")}</div>
                {plano.quantidadeCotas > 1 ? (
                  <div className={s.multi}>{t("planoDividido", { n: plano.quantidadeCotas, v: brl(plano.creditoPorCota) })}</div>
                ) : plano.abaixoDoMinimo ? (
                  <div className={s.multi}>
                    {t("planoMinimo", {
                      v: brl(plano.grupo.creditoMinimo),
                      p: brl(parcelaReduzida(plano.grupo.creditoMinimo, tipoBem)),
                      u: usd(parcelaReduzida(plano.grupo.creditoMinimo, tipoBem) / cambio),
                    })}
                  </div>
                ) : null}
                <div className={s.planGrid}>
                  <div><small><Flag country="br" />{t("parcelaReduzida")}</small><b className={`${s.brl} ${s.num}`}>{brl(plano.parcelaReduzidaTotal)}</b></div>
                  <div><small><Flag country="us" />{t("emDolar")}</small><b className={`${s.usd} ${s.num}`}>{usd(plano.parcelaReduzidaTotal / cambio)}{t("porMes")}</b></div>
                  <div><small>{t("grupoSugerido")}</small><b>{plano.grupo.grupo} · {plano.grupo.prazoMeses}{lang === "en" ? " mo" : "m"}</b></div>
                  <div><small>{t("juros")}</small><b style={{ color: "var(--green)" }}>{t("zero")}</b></div>
                </div>
                <div className={s.strategy}><Rich text={t(urg.estrat)} /></div>
                <div className={s.whatBuy}>
                  {COMPRAS[objetivo].map((c) => <span key={c[0]}>{pick(c)}</span>)}
                </div>
                <div className={s.stack}>
                  <button type="button" className={`${s.btn} ${s.btnY} ${s.btnBlock}`} onClick={() => setCheckoutAberto(true)}>
                    {t("btnQueroCota")}
                  </button>
                  <button type="button" className={`${s.btn} ${s.btnO} ${s.btnBlock}`} onClick={() => setLead({ tipo: "plano" })}>
                    {t("btnReceberPlano")}
                  </button>
                </div>
                <p className={s.disc}>{t("planoDisc")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lance embutido */}
      <section id="lance" className={s.lanceSec}>
        <div className={s.wrap}>
          <div className={s.secHead}>
            <span className={s.tag}>{t("lanceTag")}</span>
            <h2>{t("lanceTitle1")}<span className={s.brl}>{t("lanceTitle2")}</span></h2>
            <p>{t("lanceSub")}</p>
            <div className={s.bridge} />
          </div>
          <div className={s.twoCol}>
            <div className={s.card}>
              <div className={s.sliderTop}><span className={s.muted}>{t("creditoContratado")}</span><b className={s.num}>{brl(lcCredito)}</b></div>
              <input type="range" min={100_000} max={1_000_000} step={10_000} value={lcCredito} style={rangeFill(lcCredito, 100_000, 1_000_000)} onChange={(e) => setLcCredito(Number(e.target.value))} aria-label={t("creditoContratado")} />
              <div className={s.sliderTop} style={{ marginTop: 10 }}><span className={s.muted}>{t("parteLance")}</span><b className={`${s.num} ${s.brl}`}>{lcPct}%</b></div>
              <input type="range" min={0} max={30} step={5} value={lcPct} style={rangeFill(lcPct, 0, 30)} onChange={(e) => setLcPct(Number(e.target.value))} aria-label={t("parteLance")} />
              <div className={s.bar}>
                <div className={s.barA} style={{ width: `${lcPct}%` }}>{lcPct >= 10 ? t("barLance") + brlK(lance.lance) : ""}</div>
                <div className={s.barB} style={{ width: `${100 - lcPct}%` }}>{t("barMao") + brlK(lance.liquido)}</div>
              </div>
              <div className={s.legend}>
                <span><i style={{ background: "#ffc94d" }} />{t("legLance")}</span>
                <span><i style={{ background: "var(--green)" }} />{t("legMao")}</span>
              </div>
              <div className={s.vs}>
                <div className={s.vsNo}><b>{t("lanceComum")}</b><br /><Rich text={t("lanceComumTxt", { v: `**${brl(lance.lance)}**` })} /></div>
                <div className={s.vsYes}><b>{t("lanceEmb")}</b><br /><Rich text={t("lanceEmbTxt")} /></div>
              </div>
            </div>
            <div className={s.card}>
              <h3>{t("reversa")}</h3>
              <p className={s.muted} style={{ marginTop: 0 }}><Rich text={t("reversaPergunta")} /></p>
              <div className={s.reverse}>
                <span style={{ fontWeight: 900 }}>R$</span>
                <input
                  className={s.num}
                  inputMode="numeric"
                  value={rvWant ? rvWant.toLocaleString(loc) : ""}
                  onChange={(e) => setRvWant(Number(e.target.value.replace(/\D/g, "").slice(0, 8)) || 0)}
                  aria-label={t("reversa")}
                />
              </div>
              <p className={s.muted} style={{ margin: "18px 0 4px" }}>{t("reversaContrate")}</p>
              <div className={`${s.bigAnswer} ${s.num}`}>{brl(cartaParaLiquido(rvWant))}</div>
              <p className={s.muted} style={{ margin: "4px 0 0" }}><Rich text={t("reversaUse")} /></p>
              <ul className={s.ck}>
                <li>{t("reversaCk1")}</li>
                <li>{t("reversaCk2")}</li>
                <li>{t("reversaCk3")}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Oportunidades + treinamento */}
      <section id="oportunidades">
        <div className={s.wrap}>
          <div className={s.secHead}>
            <span className={s.tag}><Flag country="br" /> {t("opTag")}</span>
            <h2>{t("opTitle1")}<span className={s.brl}>{t("opTitle2")}</span></h2>
            <p>{t("opSub")}</p>
            <div className={s.bridge} />
          </div>
          <div className={s.filters}>
            {(["all", "imovel", "carta"] as const).map((f) => (
              <button type="button" key={f} className={opFiltro === f ? s.filterOn : ""} onClick={() => setOpFiltro(f)}>
                {f === "all" ? t("opFiltroTodos") : f === "imovel" ? t("opFiltroImoveis") : t("opFiltroCartas")}
              </button>
            ))}
          </div>
          <div className={s.opps}>
            {opsFiltradas.map((o) => (
              <OportunidadeCard key={`${o.tipo}-${o.id}`} o={o} onInteresse={() => setLead({ tipo: "oportunidade", oportunidade: o })} />
            ))}
            <div className={s.opp}>
              <div className={`${s.oppImg} ${s.oppLista}`}>
                <span className={s.badge}>🏗️ 🔁</span>
                <span>🏙️</span>
                <span className={s.city}>{lang === "en" ? "Nationwide" : "Brasil inteiro"}</span>
              </div>
              <div className={s.oppBody}>
                <b>{t("opListaTitulo")}</b>
                <div className={s.note}>{t("opListaTxt")}</div>
                <button type="button" className={`${s.btn} ${s.btnY}`} onClick={() => setLead({ tipo: "lista" })}>
                  {t("opListaBtn")}
                </button>
              </div>
            </div>
          </div>
          {oportunidades.length === 0 ? <p className={`${s.disc} ${s.center}`}>{t("opVazio")}</p> : null}

          <div className={s.training}>
            <div>
              <span className={s.free}>{t("trBonus")}</span>
              <h2>{t("trTitle")}</h2>
              <p className={s.muted}>{t("trSub")}</p>
              <button type="button" className={`${s.btn} ${s.btnY}`} onClick={() => setCheckoutAberto(true)}>
                {t("trBtn")}
              </button>
            </div>
            <div className={s.mods}>
              {([["trM1", "trM1s"], ["trM2", "trM2s"], ["trM3", "trM3s"], ["trM4", "trM4s"]] as [EuaCopyKey, EuaCopyKey][]).map(([a, b], i) => (
                <div className={s.mod} key={a}>
                  <span className={s.modN}>{i + 1}</span>
                  <div><b>{t(a)}</b><small>{t(b)}</small></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Estratégias */}
      <section id="estrategias">
        <div className={s.wrap}>
          <div className={s.secHead}>
            <span className={s.tag}>{t("esTag")}</span>
            <h2>{t("esTitle")}</h2>
            <p>{t("esSub")}</p>
            <div className={s.bridge} />
          </div>
          <div className={s.tabs} role="tablist">
            {ABAS.map((a) => (
              <button type="button" role="tab" aria-selected={aba === a.id} key={a.id} className={`${s.tab} ${aba === a.id ? s.tabOn : ""}`} onClick={() => setAba(a.id)}>
                {t(a.t)}
              </button>
            ))}
          </div>

          {aba === "aposent" ? (
            <div className={`${s.card} ${s.panel}`} key="aposent">
              <div className={s.panelGrid}>
                <div>
                  <h3>{t("apTitle")}</h3>
                  <p className={s.muted}>{t("apTxt")}</p>
                  <div className={s.sliderTop}><span className={s.muted}>{t("apQtd")}</span><b className={s.num}>{apN} {apN > 1 ? t("apImoveis") : t("apImovel")}</b></div>
                  <input type="range" min={1} max={5} step={1} value={apN} style={rangeFill(apN, 1, 5)} onChange={(e) => setApN(Number(e.target.value))} aria-label={t("apQtd")} />
                  <div className={s.sliderTop} style={{ marginTop: 8 }}><span className={s.muted}>{t("apValor")}</span><b className={s.num}>{brl(apV)}</b></div>
                  <input type="range" min={100_000} max={600_000} step={25_000} value={apV} style={rangeFill(apV, 100_000, 600_000)} onChange={(e) => setApV(Number(e.target.value))} aria-label={t("apValor")} />
                  <div className={s.houses}>
                    {[0, 1, 2, 3, 4].map((i) => <div key={i} className={`${s.house} ${i < apN ? s.houseOn : ""}`}>🏠</div>)}
                  </div>
                </div>
                <div>
                  <div className={s.kpis}>
                    <div className={s.kpi}><small>{t("apPat")}</small><b className={s.num}>{brlK(apN * apV)}</b></div>
                    <div className={s.kpi}><small>{t("apAluguel")}</small><b className={`${s.num} ${s.brl}`}>{brl(aluguel)}</b></div>
                    <div className={s.kpi}><small>{t("emDolar")}</small><b className={`${s.num} ${s.usd}`}>{usd(aluguel / cambio)}</b></div>
                  </div>
                  <ul className={s.ck}>
                    <li>{t("apCk1")}</li>
                    <li>{t("apCk2")}</li>
                    <li>{t("apCk3")}</li>
                  </ul>
                  <p className={s.disc}>{t("apDisc")}</p>
                </div>
              </div>
            </div>
          ) : null}

          {aba === "alav" ? (
            <div className={`${s.card} ${s.panel}`} key="alav">
              <div className={s.panelGrid}>
                <div>
                  <h3>{t("alTitle")}</h3>
                  <p className={s.muted}>{t("alTxt")}</p>
                  <ul className={s.ck}>
                    <li><Rich text={t("alCk1")} /></li>
                    <li><Rich text={t("alCk2")} /></li>
                    <li><Rich text={t("alCk3")} /></li>
                  </ul>
                </div>
                <div className={`${s.card} ${s.darkCard}`}>
                  <p className={s.muted} style={{ marginTop: 0 }}>{t("alExemplo")} <b className={s.usd}>{usd(usdMensal * 2)}{t("porMes")}</b></p>
                  <div className={`${s.kpis} ${s.kpis2}`}>
                    <div className={s.kpi}><small>{t("alUma")}</small><b className={s.num}>{brlK(alUma)}</b></div>
                    <div className={s.kpi}><small>{t("alTres")}</small><b className={s.num}>{brlK(Math.floor(alUma / 3 / 10_000) * 10_000)}</b></div>
                  </div>
                  <p className={s.muted} style={{ fontSize: 13 }}>{t("alNota")}</p>
                </div>
              </div>
            </div>
          ) : null}

          {aba === "carro" ? (
            <div className={`${s.card} ${s.panel}`} key="carro">
              <div className={s.panelGrid}>
                <div>
                  <h3>{t("caTitle")}</h3>
                  <p className={s.muted}>{t("caTxt")}</p>
                  <ul className={s.ck}>
                    <li>{t("caCk1")}</li>
                    <li>{t("caCk2")}</li>
                    <li>{t("caCk3")}</li>
                  </ul>
                </div>
                <div className={s.scrollX}>
                  <table className={s.cmp}>
                    <thead>
                      <tr><th>{t("caCredito")}</th><th>{t("parcelaReduzida")}</th><th>{t("emDolar")}</th></tr>
                    </thead>
                    <tbody>
                      {[60_000, 100_000, 150_000, 200_000].map((c) => {
                        const p = parcelaReduzida(c, "veiculo");
                        return (
                          <tr key={c}>
                            <td className={s.num}>{c === 150_000 ? <b>{brl(c)}</b> : brl(c)}</td>
                            <td className={s.num}>{brl(p)}</td>
                            <td className={`${s.usd} ${s.num}`}>{usd(p / cambio)}{t("porMes")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {aba === "volta" ? (
            <div className={`${s.card} ${s.panel}`} key="volta">
              <div className={s.panelGrid}>
                <div>
                  <h3>{t("voTitle")}</h3>
                  <p className={s.muted}>{t("voTxt")}</p>
                  <ul className={s.ck}>
                    <li>{t("voCk1")}</li>
                    <li>{t("voCk2")}</li>
                    <li>{t("voCk3")}</li>
                  </ul>
                </div>
                <div className={`${s.card} ${s.darkCard}`}>
                  <div className={s.sliderTop}><span className={s.muted}>{t("voVoltar")}</span><b className={s.num}>{anoAtual + voAnos}</b></div>
                  <input type="range" min={1} max={15} value={voAnos} style={rangeFill(voAnos, 1, 15)} onChange={(e) => setVoAnos(Number(e.target.value))} aria-label={t("voVoltar")} />
                  <p style={{ margin: "10px 0 0" }}><Rich text={t("voResumo", { p: voAnos * 12, a: voAnos * 12 })} /></p>
                </div>
              </div>
            </div>
          ) : null}

          {aba === "cmp" ? (
            <div className={`${s.card} ${s.panel}`} key="cmp">
              <h3>{t("cmTitle")}</h3>
              <div className={s.scrollX}>
                <table className={s.cmp}>
                  <thead>
                    <tr><th /><th>{t("cmFin")}</th><th>{t("cmCons")}</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>{t("cmJuros")}</td><td className={s.bad}>{t("cmJurosFin")}</td><td className={s.good}>{t("cmZero")}</td></tr>
                    <tr><td>{t("cmTotal")}</td><td className={`${s.bad} ${s.num}`}>≈ {brl(cmp.totalFinanciamento)}</td><td className={`${s.good} ${s.num}`}>≈ {brl(cmp.totalConsorcio)}</td></tr>
                    <tr><td>{t("cmEntrada")}</td><td>{t("cmEntradaFin")}</td><td className={s.good}>{t("cmEntradaCons")}</td></tr>
                    <tr><td>{t("cmRenda")}</td><td className={s.bad}>{t("cmSim")}</td><td className={s.good}>{t("cmRendaCons")}</td></tr>
                    <tr><td>{t("cmFora")}</td><td>{t("cmDificil")}</td><td className={s.good}>{t("cmOnline")}</td></tr>
                    <tr><td>{t("cmRecebe")}</td><td>{t("cmNaHora")}</td><td>{t("cmContemplacao")}</td></tr>
                  </tbody>
                </table>
              </div>
              <p className={s.disc}>{t("cmDisc")}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Como funciona */}
      <section style={{ paddingTop: 20 }}>
        <div className={s.wrap}>
          <div className={s.secHead}>
            <h2>{t("pasTitle")}</h2>
            <p>{t("pasSub")}</p>
            <div className={s.bridge} />
          </div>
          <div className={s.steps}>
            {([["pas1", "pas1s"], ["pas2", "pas2s"], ["pas3", "pas3s"], ["pas4", "pas4s"]] as [EuaCopyKey, EuaCopyKey][]).map(([a, b]) => (
              <div className={`${s.card} ${s.stp}`} key={a}>
                <h3>{t(a)}</h3>
                <p>{t(b)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reunião ou contratar */}
      <section id="decidir">
        <div className={s.wrap}>
          <div className={s.secHead}>
            <span className={s.tag}>{t("decTag")}</span>
            <h2>{t("decTitle")}</h2>
            <div className={s.bridge} />
          </div>
          <div className={s.fork}>
            <div className={`${s.card} ${s.meet}`}>
              <EuaScheduler plano={resumo} agoraIso={agoraIso} />
            </div>
            <div className={`${s.card} ${s.buy}`}>
              <div className={s.headRow}>
                <div className={`${s.avatar} ${s.avatarY}`}>🚀</div>
                <div>
                  <h3>{t("buyTitle")}</h3>
                  <span className={s.muted}>{t("buySub")}</span>
                </div>
              </div>
              <ul className={s.ck} style={{ margin: "18px 0" }}>
                <li>{t("buyCk1")}</li>
                <li>{t("buyCk2")}</li>
                <li>{t("buyCk3")}</li>
                <li>{t("buyCk4")}</li>
                <li><Rich text={t("buyCk5")} /></li>
              </ul>
              <button type="button" className={`${s.btn} ${s.btnY} ${s.btnBlock}`} onClick={() => setCheckoutAberto(true)}>
                {t("buyBtn")}
              </button>
              <p className={`${s.muted} ${s.center}`} style={{ fontSize: 12, margin: "10px 0 0" }}>{t("buySeg")}</p>
              {contatos.length ? (
                <>
                  <hr className={s.hr} />
                  <p style={{ margin: "0 0 10px", fontWeight: 800 }}>{t("buyDireto")}</p>
                  <div className={s.row2} style={{ margin: 0 }}>
                    {contatos.map((c) => (
                      <a key={c.whatsapp} className={`${s.btn} ${s.btnG}`} href={waLink(c.whatsapp, c.nome)} target="_blank" rel="noopener noreferrer">
                        WhatsApp {c.nome}
                      </a>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ paddingTop: 20 }}>
        <div className={`${s.wrap} ${s.faq}`}>
          <div className={s.secHead}>
            <h2>{t("faqTitle")}</h2>
            <div className={s.bridge} />
          </div>
          {([
            ["faq1q", "faq1a", true],
            ["faq2q", "faq2a", true],
            ["faq3q", "faq3a", true],
            ["faq4q", "faq4a", false],
            ["faq5q", "faq5a", false],
            ["faq6q", "faq6a", false],
            ["faq7q", "faq7a", false],
            ["faq8q", "faq8a", false],
            ["faq9q", "faq9a", false],
          ] as [EuaCopyKey, EuaCopyKey, boolean][]).map(([q, a, hi], i) => (
            <details key={q} className={hi ? s.hi : ""} open={i === 0}>
              <summary>{t(q)}</summary>
              <p><Rich text={t(a)} /></p>
            </details>
          ))}
        </div>
      </section>

      <footer className={s.footer}>
        <div className={s.ribbon} style={{ marginTop: -40, marginBottom: 34 }} />
        <div className={`${s.wrap} ${s.footCols}`}>
          <div>
            <div style={{ marginBottom: 16 }}>
              <Brand large iconUrl={iconeGauchinhoUrl} franqueado={t("franqueado")} />
            </div>
            {t("footRep")}
            <br />
            Sinop · Mato Grosso · {t("footBrasil")}
          </div>
          <div>
            WhatsApp
            {contatos.map((c) => (
              <div key={c.whatsapp}>
                {c.whatsapp} · {c.nome}
              </div>
            ))}
          </div>
          <div>{t("footDisc")}</div>
        </div>
      </footer>

      <div className={s.sticky}>
        <div className={s.stickyRow}>
          <div className={s.mini}>
            <span>{t("stickyPlano")}</span>
            <b className={s.num}>{brlK(plano.creditoTotal)}</b>
          </div>
          <a href="#decidir" className={`${s.btn} ${s.btnO}`}>{t("stickyReuniao")}</a>
          <button type="button" className={`${s.btn} ${s.btnY}`} onClick={() => setCheckoutAberto(true)}>{t("stickyContratar")}</button>
        </div>
      </div>

      {checkoutAberto ? (
        <EuaCheckoutDrawer plano={plano} opcoes={opcoesDeCota(plano)} resumo={resumo} onClose={() => setCheckoutAberto(false)} />
      ) : null}
      {lead ? <EuaLeadDrawer modo={lead} plano={plano} resumo={resumo} onClose={() => setLead(null)} /> : null}
    </div>
  );
}

function OportunidadeCard({ o, onInteresse }: { o: EuaOportunidade; onInteresse: () => void }) {
  const { t, brl } = useEua();
  const carta = o.tipo === "carta";
  const bem = o.tipoBem === "imovel" ? t("imovel") : o.tipoBem === "veiculo" || o.tipoBem === "automovel" ? t("veiculo") : o.tipoBem;
  const titulo = carta ? `${t("carta")} ${o.titulo}${bem ? ` · ${bem}` : ""}` : o.titulo;
  return (
    <div className={s.opp}>
      <div
        className={`${s.oppImg} ${carta ? s.oppCarta : s.oppImovel}`}
        style={o.fotoUrl ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.45)), url("${o.fotoUrl}")` } : undefined}
      >
        <span className={s.badge}>{carta ? t("opBadgeCarta") : t("opBadgeImovel")}</span>
        {o.fotoUrl ? <span /> : <span>{carta ? "📑" : "🏢"}</span>}
        {o.cidade ? <span className={s.city}>{o.cidade}</span> : null}
      </div>
      <div className={s.oppBody}>
        <b>{titulo}</b>
        <div className={`${s.price} ${s.num}`}>
          {o.valor ? (carta ? t("opCredito") + brl(o.valor) : brl(o.valor)) : t("opSobConsulta")}
        </div>
        <div className={s.note}>
          {carta && o.entrada ? `${t("opEntrada", { v: brl(o.entrada) })} · ` : ""}
          {carta ? t("opNotaCarta") : t("opNotaImovel")}
        </div>
        <button type="button" className={`${s.btn} ${s.btnO}`} onClick={onInteresse}>
          {t("opInteresse")}
        </button>
      </div>
    </div>
  );
}
