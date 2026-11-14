"use client";

import { useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/eua/eua-ui";
import { HERANCA_ANOS, HERANCA_PARCELA_INICIAL, HERANCA_POR_DIA, projecaoAno, tabelaProjecao } from "@/lib/heranca-inteligente/projecao";
import { HerancaForm } from "./heranca-form";
import type { HerancaEventoView } from "./types";
import s from "./heranca.module.css";

const brl = (v: number, casas = 0) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
const mil = (v: number) => `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;
const fill = (v: number, min: number, max: number) => ({ ["--p" as string]: `${((v - min) / (max - min)) * 100}%` }) as React.CSSProperties;
const anos = (n: number) => (n === 1 ? "1 ano" : `${n} anos`);

/** Contador que sobe até o valor final (respeita redução de movimento). */
function useContador(alvo: number, duracao = 1600) {
  const [valor, setValor] = useState(alvo);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const inicio = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracao);
      setValor(Math.round(alvo * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duracao]);
  return valor;
}

export function HerancaLanding({ evento, iconeUrl }: { evento: HerancaEventoView | null; iconeUrl: string | null }) {
  const maior = projecaoAno(1).creditoNoFim;
  const menor = projecaoAno(HERANCA_ANOS).creditoNoFim;
  const contador = useContador(Math.round(maior));

  const [idadeFilho, setIdadeFilho] = useState(2);
  const [anoContemplacao, setAnoContemplacao] = useState(5);
  const [verTabela, setVerTabela] = useState(false);
  const [modoForm, setModoForm] = useState<"evento" | "info">("evento");
  const linha = useMemo(() => projecaoAno(anoContemplacao), [anoContemplacao]);
  const tabela = useMemo(() => tabelaProjecao(), []);
  const idadeContemplacao = idadeFilho + anoContemplacao;
  const idadeFim = idadeFilho + HERANCA_ANOS;
  const antesDos33 = 33 - idadeFim;

  const vagasTxt =
    evento?.vagasRestantes != null
      ? evento.vagasRestantes > 0
        ? `Restam ${evento.vagasRestantes} ${evento.vagasRestantes === 1 ? "vaga" : "vagas"}`
        : "Vagas esgotadas · lista de prioridade aberta"
      : "Vagas limitadas";

  return (
    <div className={s.root}>
      {/* HERO */}
      <header className={s.top}>
        <div className={`${s.wrap} ${s.topRow}`}>
          <Brand iconUrl={iconeUrl} franqueado="FRANQUEADO" />
          <a className={s.topCta} href="#participar">
            {evento ? "Encontro gratuito →" : "Quero saber mais →"}
          </a>
        </div>
      </header>

      <section className={s.hero}>
        <div className={`${s.wrap} ${s.heroGrid}`}>
          <div>
            <span className={s.eyebrow}>✦ Método Herança Inteligente</span>
            <h1 className={s.heroTitle}>
              A herança que <span className={s.it}>você vive junto.</span>
            </h1>
            <p className={s.heroLead}>
              A maioria das heranças chega num dia de despedida. Esta chega num <b>dia de festa</b> — e você está lá para ver
              seu filho abrir a porta do primeiro imóvel dele.
            </p>
            <div className={s.heroCtas}>
              {evento ? (
                <a href="#participar" className={`${s.btn} ${s.btnGold}`} onClick={() => setModoForm("evento")}>
                  Quero participar do encontro
                </a>
              ) : null}
              <a href="#participar" className={`${s.btn} ${evento ? s.btnGhost : s.btnGold}`} onClick={() => setModoForm("info")}>
                Quero receber informações
              </a>
            </div>
            <div className={s.heroNote}>
              <span>Comece com {brl(HERANCA_PARCELA_INICIAL)} por mês</span>
              <span>Sem juros</span>
              {evento ? <span>{vagasTxt}</span> : null}
            </div>
          </div>

          <div className={s.gift} aria-label="Resumo da carta de R$ 100 mil">
            <span className={s.giftRibbon}>Para o seu filho</span>
            <div className={s.giftRow}>
              <small>Você começa hoje com</small>
              <b>{brl(HERANCA_PARCELA_INICIAL)}/mês</b>
            </div>
            <div className={s.giftRow}>
              <small>Isso é cerca de</small>
              <b>{brl(Math.floor(HERANCA_POR_DIA))} por dia</b>
            </div>
            <div className={s.giftArrow}>e pode virar</div>
            <div className={s.giftKey} aria-hidden>
              🔑
            </div>
            <div className={s.giftBig}>{brl(contador)}</div>
            <div className={s.giftSub}>
              de patrimônio para ele em 16 anos — no mínimo {mil(menor)}*
            </div>
          </div>
        </div>
      </section>

      {/* DUAS HERANÇAS */}
      <section className={s.light}>
        <div className={s.wrap}>
          <div className={`${s.center} ${s.narrow}`} style={{ margin: "0 auto" }}>
            <span className={`${s.eyebrow} ${s.eyebrowDark}`}>Existem duas formas de deixar herança</span>
            <h2 style={{ marginTop: 14 }}>
              Uma chega quando você parte. <span className={s.it}>A outra, quando você ainda pode abraçar.</span>
            </h2>
          </div>
          <div className={s.duas}>
            <div className={`${s.heranca} ${s.herancaTarde}`}>
              <span className={s.herancaTag}>A herança que chega tarde</span>
              <h3>Inventário, cartório e saudade</h3>
              <ul className={s.lista}>
                <li><i>—</i>Seu filho recebe aos 40, 50 anos, quando já pagou a própria casa.</li>
                <li><i>—</i>Chega dividida, depois de anos de burocracia.</li>
                <li><i>—</i>Você não está lá para ver o que ela se tornou.</li>
              </ul>
            </div>
            <div className={`${s.heranca} ${s.herancaViva}`}>
              <span className={s.herancaTag} style={{ color: "#b45f06" }}>A herança que você vive junto</span>
              <h3>Chave na mão, você do lado</h3>
              <ul className={s.lista}>
                <li><i>✓</i>Seu filho começa a vida adulta com patrimônio, não com dívida.</li>
                <li><i>✓</i>Você ensina a cuidar, a alugar, a multiplicar.</li>
                <li><i>✓</i>Você está na foto do primeiro dia na casa nova.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* A CENA */}
      <section className={s.cena}>
        <div className={s.wrap}>
          <p className={s.cenaTexto}>
            Imagine o aniversário de 18 anos dele. Não é um presente que acaba na semana seguinte.
            <br />
            <em>É uma chave.</em> E quem entrega é você.
          </p>
          <span className={s.cenaKey} aria-hidden>
            🔑
          </span>
        </div>
      </section>

      {/* LINHA DO TEMPO */}
      <section className={s.light} id="simular">
        <div className={s.wrap}>
          <div className={`${s.center} ${s.narrow}`} style={{ margin: "0 auto" }}>
            <span className={`${s.eyebrow} ${s.eyebrowDark}`}>A linha do tempo do seu filho</span>
            <h2 style={{ marginTop: 14 }}>
              Veja onde ele estará <span className={s.it}>quando você cumprir a promessa.</span>
            </h2>
            <p className={s.muted}>Carta de R$ 100 mil, começando com {brl(HERANCA_PARCELA_INICIAL)} por mês.</p>
          </div>
          <div className={s.simGrid}>
            <div className={s.painel}>
              <div className={s.campo}>
                <div className={s.campoTop}>
                  <span>Idade do seu filho hoje</span>
                  <b>{idadeFilho === 0 ? "bebê" : anos(idadeFilho)}</b>
                </div>
                <input type="range" min={0} max={17} value={idadeFilho} style={fill(idadeFilho, 0, 17)} onChange={(e) => setIdadeFilho(Number(e.target.value))} aria-label="Idade do seu filho hoje" />
              </div>
              <div className={s.campo}>
                <div className={s.campoTop}>
                  <span>Contemplação no</span>
                  <b>{anoContemplacao}º ano</b>
                </div>
                <input type="range" min={1} max={HERANCA_ANOS} value={anoContemplacao} style={fill(anoContemplacao, 1, HERANCA_ANOS)} onChange={(e) => setAnoContemplacao(Number(e.target.value))} aria-label="Ano da contemplação" />
                <small>A contemplação acontece por sorteio ou lance, em qualquer assembleia mensal.</small>
              </div>
              <button type="button" className={s.tabelaBtn} onClick={() => setVerTabela((v) => !v)}>
                {verTabela ? "Ocultar a projeção dos 16 anos" : "Ver a projeção completa dos 16 anos"}
              </button>
              {verTabela ? (
                <div className={s.tabelaWrap}>
                  <table className={s.tabela}>
                    <thead>
                      <tr><th>Ano</th><th>Parcela</th><th>Crédito no ano</th><th>No 16º ano</th></tr>
                    </thead>
                    <tbody>
                      {tabela.map((l) => (
                        <tr key={l.ano} style={l.ano === anoContemplacao ? { background: "#fff1d6", fontWeight: 800 } : undefined}>
                          <td>{l.ano}º</td>
                          <td>{brl(l.parcelaMensal, 2)}</td>
                          <td>{brl(l.creditoNoAno, 2)}</td>
                          <td>{brl(l.creditoNoFim, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            <div className={s.timeline}>
              <div className={`${s.marco} ${s.marcoHoje}`}>
                <span className={s.marcoIdade}>Hoje · ele tem {idadeFilho === 0 ? "menos de 1 ano" : anos(idadeFilho)}</span>
                <b>Você começa com {brl(HERANCA_PARCELA_INICIAL)} por mês</b>
                <p className={s.muted}>Cerca de {brl(Math.floor(HERANCA_POR_DIA))} por dia. A parcela é reajustada uma vez por ano.</p>
              </div>
              <div className={s.marco}>
                <span className={s.marcoIdade}>{anoContemplacao}º ano · ele terá {anos(idadeContemplacao)}</span>
                <b>A carta é contemplada: {brl(linha.creditoNoAno)}</b>
                <p className={s.muted}>O crédito acompanha o reajuste e fica disponível para imóvel. Se ficar aplicado, ele continua crescendo.</p>
              </div>
              <div className={`${s.marco} ${s.marcoFim}`}>
                <span className={s.marcoIdade}>16º ano · ele terá {anos(idadeFim)}</span>
                <b>O patrimônio que você entrega em vida</b>
                <div className={s.marcoValor}>{brl(linha.creditoNoFim)}</div>
                {antesDos33 > 0 ? (
                  <div className={s.destaque33}>
                    🏡 {antesDos33} {antesDos33 === 1 ? "ano" : "anos"} antes da idade em que o brasileiro costuma comprar o primeiro imóvel (33 anos).
                  </div>
                ) : (
                  <div className={s.destaque33}>🏡 Patrimônio pronto para o próximo passo da vida dele — e dos seus netos.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CICLO DOS 33 ANOS */}
      <section>
        <div className={s.wrap}>
          <div className={s.ciclo}>
            <div>
              <span className={s.eyebrow}>Por que o método existe</span>
              <div className={s.big33}>33</div>
              <p className={s.mutedDark} style={{ fontSize: 18 }}>
                anos é a idade média em que o brasileiro compra o primeiro imóvel.
              </p>
            </div>
            <ul className={s.cicloLista}>
              <li><b>18 anos</b>começa do zero</li>
              <li><b>Décadas</b>de trabalho</li>
              <li><b>33 anos</b>conquista o primeiro imóvel</li>
              <li><b>Anos seguintes</b>pagando esse imóvel</li>
              <li><b>50, 60 anos</b>tentando construir patrimônio</li>
              <li><b>Depois</b>não consegue repetir para os filhos</li>
            </ul>
          </div>
          <p className={s.faixa}>
            O problema não é falta de esforço. <span className={s.it}>É falta de patrimônio herdado.</span>
          </p>
        </div>
      </section>

      {/* GERAÇÕES */}
      <section className={s.light}>
        <div className={s.wrap}>
          <div className={`${s.center} ${s.narrow}`} style={{ margin: "0 auto" }}>
            <span className={`${s.eyebrow} ${s.eyebrowDark}`}>Uma decisão pode mudar gerações</span>
            <h2 style={{ marginTop: 14 }}>
              Toda família tem alguém que muda a sua história. <span className={s.it}>Talvez seja você.</span>
            </h2>
          </div>
          <div className={s.geracoes}>
            {[
              ["🫶", "Você", "Toma a decisão de construir patrimônio hoje."],
              ["🧒", "Seu filho", "Não precisa começar a vida do zero."],
              ["👶", "Seu neto", "Nasce numa família com mais oportunidades."],
              ["🌱", "Seu bisneto", "Começa ainda mais à frente."],
              ["🌳", "Futuras gerações", "Colhem os frutos de uma decisão tomada agora."],
            ].map(([e, t, d], i) => (
              <div className={`${s.ger} ${i === 0 ? s.gerVoce : ""}`} key={t}>
                <div className={s.gerEmoji}>{e}</div>
                <b>{t}</b>
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AVÔ */}
      <section>
        <div className={`${s.wrap} ${s.center}`}>
          <span className={s.eyebrow}>Toda família tem uma história como essa</span>
          <h2 style={{ marginTop: 14 }}>
            O avô que comprou terrenos por nada… <span className={s.it}>e vendeu tudo antes de valorizar.</span>
          </h2>
          <div className={s.avo}>
            <div className={`${s.avoCard} ${s.avoNao}`}>Ele não sabia o que tinha nas mãos.</div>
            <div className={`${s.avoCard} ${s.avoSim}`}>Mas você sabe.</div>
          </div>
          <p className={s.faixa}>Você pode ser o avô que os seus netos vão agradecer.</p>
        </div>
      </section>

      {/* PRIMEIRO PASSO */}
      <section className={s.light}>
        <div className={`${s.wrap} ${s.center}`}>
          <span className={`${s.eyebrow} ${s.eyebrowDark}`}>Como começar</span>
          <h2 style={{ marginTop: 14 }}>
            O primeiro passo é <span className={s.it}>mais simples do que parece.</span>
          </h2>
          <div className={s.passo}>
            <div className={s.passoCard}><small>Comece com um crédito de</small><b>R$ 100 mil</b></div>
            <div className={s.passoCard}><small>Pagando apenas</small><b>{brl(HERANCA_PARCELA_INICIAL)}</b><small>por mês</small></div>
            <div className={`${s.passoCard} ${s.passoCardOn}`}><small>Isso dá cerca de</small><b>{brl(Math.floor(HERANCA_POR_DIA))}</b><small>por dia</small></div>
          </div>
          <p className={s.faixa} style={{ color: "#12193a" }}>
            Menos do que muita coisa que a gente compra sem perceber. <span className={s.it}>O importante é começar enquanto o tempo está a favor do seu filho.</span>
          </p>
        </div>
      </section>

      {/* ENCONTRO + FORMULÁRIO */}
      <section className={s.eventoSec} id="participar">
        <div className={`${s.wrap} ${s.eventoGrid}`}>
          <div>
            <span className={s.eyebrow}>{evento ? "Encontro presencial e gratuito" : "Fale com a gente"}</span>
            <h2 style={{ marginTop: 14 }}>
              {evento ? (
                <>
                  Venha entender o método <span className={s.it}>olhando nos olhos.</span>
                </>
              ) : (
                <>
                  Vamos começar <span className={s.it}>o futuro do seu filho?</span>
                </>
              )}
            </h2>
            <p className={s.mutedDark}>
              Herança não é deixar bens. É deixar <b style={{ color: "#fff" }}>escolhas, oportunidades e liberdade</b>.
            </p>
            {evento ? (
              <>
                <div className={s.eventoInfo}>
                  <div>
                    <span>📅</span>
                    <p style={{ margin: 0 }}>
                      <b>{evento.dataLabel ?? "Data confirmada pelo WhatsApp"}</b>
                      <small>{evento.nome}</small>
                    </p>
                  </div>
                  <div>
                    <span>📍</span>
                    <p style={{ margin: 0 }}>
                      <b>{evento.local ?? "Racon Sinop · Franqueado Gauchinho"}</b>
                      <small>{[evento.endereco, evento.cidade].filter(Boolean).join(" · ") || "Endereço enviado na confirmação"}</small>
                    </p>
                  </div>
                </div>
                <span className={s.vagas}>
                  <i className={s.vagasPonto} />
                  {vagasTxt}
                </span>
              </>
            ) : null}
          </div>
          <HerancaForm key={modoForm} evento={evento} modoInicial={modoForm} />
        </div>
      </section>

      {/* DÚVIDAS */}
      <section className={s.light}>
        <div className={`${s.wrap} ${s.narrow} ${s.faq}`}>
          <h2 className={s.center}>Perguntas de pai e mãe</h2>
          {[
            ["Preciso ter dinheiro guardado para começar?", "Não. Você começa com a parcela de R$ 375 por mês da carta de R$ 100 mil. Não há entrada."],
            ["E se eu tiver mais de um filho?", "Cada filho pode ter a sua carta. No formulário você informa quantos filhos tem e a idade de cada um, e montamos o plano para a família."],
            ["Quando a carta é contemplada?", "Em qualquer assembleia mensal, por sorteio ou por lance. Não existe data garantida — por isso a linha do tempo mostra o resultado para cada ano."],
            ["A parcela aumenta?", "Sim, uma vez por ano, acompanhando o reajuste do crédito. A projeção usa 8% ao ano como referência, e o crédito cresce na mesma proporção."],
            ["O valor de R$ 317 mil a R$ 599 mil é garantido?", "Não. É uma projeção ilustrativa: crédito reajustado em 8% ao ano e, depois da contemplação, aplicado a 1% ao mês até o 16º ano. Os valores reais dependem do reajuste e do rendimento de cada período."],
            ["Quem administra?", "A Racon Consórcios, do Grupo Randon (desde 1949), autorizada pelo Banco Central. O atendimento é da Racon Sinop · Franqueado Gauchinho."],
          ].map(([q, a], i) => (
            <details key={q} open={i === 0}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footRow}`}>
          <Brand iconUrl={iconeUrl} franqueado="FRANQUEADO" />
          <p style={{ maxWidth: 560, margin: 0 }}>
            *Projeção ilustrativa da carta de R$ 100 mil em 16 anos: reajuste de 8% ao ano e rendimento de 1% ao mês após a contemplação. Crédito via
            consórcio, sujeito às regras do grupo, taxas e reajustes. Contemplação por sorteio ou lance.
          </p>
        </div>
      </footer>

      <div className={s.sticky}>
        <div className={s.stickyRow}>
          <div className={s.stickyTxt}>
            <b>{evento ? "Encontro Herança Inteligente" : "Herança Inteligente"}</b>
            {evento ? vagasTxt : `Comece com ${brl(HERANCA_PARCELA_INICIAL)}/mês`}
          </div>
          <a className={`${s.btn} ${s.btnGold}`} href="#participar">
            {evento ? "Quero participar" : "Quero saber mais"}
          </a>
        </div>
      </div>
    </div>
  );
}
