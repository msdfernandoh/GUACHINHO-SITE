"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatWhatsappBrInput } from "@/lib/utils/format";
import {
  OPCOES_AVALIACAO_ENCONTRO,
  OPCOES_CAPACIDADE_MENSAL,
  OPCOES_MOMENTO_OPORTUNIDADE,
  OPCOES_MORADIA,
  OPCOES_VEICULO,
} from "@/lib/eventos-sorteio/checkin-conversacional-types";
import { MODELOS_PARCERIA } from "@/lib/spl/types";
import {
  DESAFIO_SEM_INTERESSE,
  FUNCOES_CORRETOR,
  META_CLIENTES_EVENTO,
  OPCOES_DESAFIO,
  type ClienteEvento,
  type FuncaoCorretor,
  type ImobiliariaOpcao,
  type SessaoCorretor,
} from "@/lib/spl/evento-tipos";

type Props = {
  evento: { id: string; nome: string };
  imobiliarias: ImobiliariaOpcao[];
  empreendimentos: { slug: string; nome: string; cidade: string }[];
  /** QR code: abre direto no cadastro do corretor, sem a tela de apresentação. */
  inicioDireto?: boolean;
};

type Etapa =
  | "intro"
  | "corretor"
  | "imobiliaria"
  | "clientes"
  | "desafio"
  | "veiculo"
  | "moradia"
  | "capacidade"
  | "avaliacao"
  | "momento"
  | "final";

const ORDEM: Etapa[] = ["corretor", "imobiliaria", "clientes", "desafio", "veiculo", "moradia", "capacidade", "avaliacao", "momento"];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v % 1 ? 2 : 0 });

const input =
  "w-full rounded-2xl border-2 border-white/15 bg-white/5 px-4 py-4 text-lg text-white placeholder:text-white/40 outline-none transition focus:border-[#F59E0B] focus:ring-4 focus:ring-[#F59E0B]/20";

function Botao({
  children,
  onClick,
  disabled,
  tipo = "ouro",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tipo?: "ouro" | "contorno";
}) {
  const cor =
    tipo === "ouro"
      ? "bg-[#F59E0B] text-[#3B2302] hover:bg-[#FBB43A]"
      : "border-2 border-white/25 text-white hover:border-white/50";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[58px] w-full rounded-2xl px-6 py-4 text-lg font-extrabold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${cor}`}
    >
      {children}
    </button>
  );
}

function Opcao({ selecionada, onClick, children }: { selecionada?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border-2 px-4 py-4 text-left text-base font-semibold transition active:scale-[0.99] ${
        selecionada ? "border-[#F59E0B] bg-[#F59E0B]/15 text-white" : "border-white/10 bg-white/5 text-white/90 hover:border-white/30"
      }`}
    >
      {children}
    </button>
  );
}

function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl">{children}</h1>
      {sub ? <p className="text-base text-white/70">{sub}</p> : null}
    </div>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-sm font-bold uppercase tracking-wide text-white/70">{children}</span>;
}

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const r = await fetch("/api/public/spl/evento", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string };
  if (!r.ok || !j.ok) throw new Error(j.error ?? "Não foi possível concluir agora.");
  return j.data as T;
}

export function SplEventoCheckin({ evento, imobiliarias, empreendimentos, inicioDireto = false }: Props) {
  const chaveLocal = `spl-evento-${evento.id}`;
  const [etapa, setEtapa] = useState<Etapa>(inicioDireto ? "corretor" : "intro");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sessao, setSessao] = useState<SessaoCorretor | null>(null);

  // Etapa 1
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [imobId, setImobId] = useState("");
  const [imobOutra, setImobOutra] = useState("");
  const [funcao, setFuncao] = useState<FuncaoCorretor | "">("");

  // Dados da imobiliária
  const [imob, setImob] = useState({ email: "", cnpj: "", chave_pix: "", modelo_parceria: "", quantidade_vendedores: "" });

  // Clientes
  const [clientes, setClientes] = useState<ClienteEvento[]>([]);
  const [cli, setCli] = useState({ nome: "", telefone: "", empreendimento: "" });
  const [confirmarMenos, setConfirmarMenos] = useState(false);

  // Desafio e pesquisa
  const [desafio, setDesafio] = useState("");
  const [q, setQ] = useState({ veiculo: "", moradia: "", capacidade_mensal: "", avaliacao_encontro: "", avaliacao_melhoria: "", momento_oportunidade: "" });
  const [cupons, setCupons] = useState<string[]>([]);
  const [concluido, setConcluido] = useState(false);

  const primeiroNome = (sessao?.nome ?? nome).trim().split(/\s+/)[0] ?? "";

  // Retoma a sessão no mesmo aparelho (recarregou a página ou voltou depois).
  useEffect(() => {
    let salvo: { nome: string; telefone: string } | null = null;
    try {
      salvo = JSON.parse(localStorage.getItem(chaveLocal) ?? "null");
    } catch {
      salvo = null;
    }
    if (!salvo?.telefone) return;
    setNome(salvo.nome);
    setTelefone(formatWhatsappBrInput(salvo.telefone));
    chamar<SessaoCorretor>({ acao: "iniciar", eventoId: evento.id, nome: salvo.nome, telefone: salvo.telefone })
      .then((s) => aplicarSessao(s))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aplicarSessao(s: SessaoCorretor) {
    setSessao(s);
    setClientes(s.clientes);
    setConcluido(s.jaConcluiu);
    try {
      localStorage.setItem(chaveLocal, JSON.stringify({ nome: s.nome, telefone: s.telefone }));
    } catch {
      /* sem armazenamento local */
    }
    setEtapa(s.precisaDadosImobiliaria ? "imobiliaria" : "clientes");
  }

  const auth = () => ({ eventoId: evento.id, participanteId: sessao?.participanteId, telefone: sessao?.telefone });

  async function executar(fn: () => Promise<void>) {
    setErro(null);
    setEnviando(true);
    try {
      await fn();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir agora.");
    } finally {
      setEnviando(false);
    }
  }

  const iniciar = () =>
    executar(async () => {
      if (!funcao) throw new Error("Marque se você é colaborador ou proprietário.");
      if (!imobId) throw new Error("Escolha a sua imobiliária.");
      const s = await chamar<SessaoCorretor>({
        acao: "iniciar",
        eventoId: evento.id,
        nome,
        telefone,
        imobiliariaId: imobId,
        imobiliariaOutra: imobId === "outra" ? imobOutra : "",
        funcao,
      });
      aplicarSessao(s);
    });

  const salvarImob = () =>
    executar(async () => {
      await chamar({ acao: "imobiliaria", ...auth(), ...imob });
      setEtapa("clientes");
    });

  const adicionarCliente = () =>
    executar(async () => {
      const r = await chamar<{ cliente: ClienteEvento }>({
        acao: "cliente",
        ...auth(),
        nome: cli.nome,
        clienteTelefone: cli.telefone,
        empreendimento: cli.empreendimento,
      });
      setClientes((l) => [...l, r.cliente]);
      setCli({ nome: "", telefone: "", empreendimento: "" });
      setConfirmarMenos(false);
    });

  const finalizar = (qualificacao: typeof q) =>
    executar(async () => {
      const r = await chamar<{ cupons: string[] }>({ acao: "finalizar", ...auth(), desafio, qualificacao });
      setCupons(r.cupons);
      setConcluido(true);
      setEtapa("final");
    });

  function avancarClientes() {
    if (clientes.length < META_CLIENTES_EVENTO && !confirmarMenos) {
      setConfirmarMenos(true);
      return;
    }
    setConfirmarMenos(false);
    if (concluido && sessao) {
      setCupons([sessao.cupomPresenca, ...clientes.map((c) => c.cupom).filter((c): c is string => Boolean(c))]);
      setEtapa("final");
      return;
    }
    setEtapa("desafio");
  }

  const escolher = (campo: keyof typeof q, valor: string, proxima: Etapa) => {
    setQ((v) => ({ ...v, [campo]: valor }));
    setErro(null);
    setEtapa(proxima);
  };

  const progresso = useMemo(() => {
    const i = ORDEM.indexOf(etapa);
    return i < 0 ? (etapa === "final" ? 1 : 0) : (i + 1) / ORDEM.length;
  }, [etapa]);

  const voltar = (para: Etapa) => (
    <button type="button" onClick={() => setEtapa(para)} className="text-sm font-bold text-white/60 hover:text-white">
      ← Voltar
    </button>
  );

  const faltam = Math.max(0, META_CLIENTES_EVENTO - clientes.length);

  return (
    <div className="mx-auto w-full max-w-lg overflow-hidden rounded-[28px] bg-[#0A1931] text-white shadow-2xl ring-1 ring-white/10">
      <div className="border-b border-white/10 px-5 pb-4 pt-5">
        <div className="flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/spl-img/spl.png" alt="SPL Engenharia" className="h-7 w-auto rounded bg-white px-2 py-1" />
          <span className="text-xs font-bold text-white/50">×</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/spl-img/logo-racon-gauchinho.jpeg" alt="Racon Consórcios · Gauchinho" className="h-7 w-auto rounded bg-white px-1" />
        </div>
        <p className="mt-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-[#00AEEF]">{evento.nome}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#F59E0B] transition-all" style={{ width: `${Math.round(progresso * 100)}%` }} />
        </div>
      </div>

      <div className="space-y-5 px-5 py-7">
        {etapa === "intro" ? (
          <>
            <Titulo sub="Três passos rápidos para você concorrer aos prêmios de hoje.">Pesquisa, Sorteio e Desafio</Titulo>
            <ul className="space-y-3">
              {[
                ["🎟️", "Sorteio", "Cada cliente que você indicar vira 1 cupom. Indique 5 e garanta 5 cupons, além do seu de presença."],
                ["🔑", "Desafio", "Topa fazer o seu primeiro consórcio? Escolha um dos planos do evento."],
                ["📝", "Pesquisa", "Algumas perguntas rápidas e a avaliação do encontro."],
              ].map(([emoji, t, d]) => (
                <li key={t} className="flex gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <span className="text-2xl">{emoji}</span>
                  <span>
                    <span className="block font-black">{t}</span>
                    <span className="text-sm text-white/70">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Botao onClick={() => setEtapa("corretor")}>Começar →</Botao>
          </>
        ) : null}

        {etapa === "corretor" ? (
          <>
            <Titulo sub="Seu cadastro de corretor no evento.">Olá! Que bom ter você aqui 👋</Titulo>
            <label className="block">
              <Rotulo>Seu nome completo</Rotulo>
              <input className={input} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome e sobrenome" autoComplete="name" />
            </label>
            <label className="block">
              <Rotulo>WhatsApp</Rotulo>
              <input
                className={input}
                value={telefone}
                onChange={(e) => setTelefone(formatWhatsappBrInput(e.target.value))}
                placeholder="(66) 99999-9999"
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
            <label className="block">
              <Rotulo>Imobiliária</Rotulo>
              <select className={`${input} appearance-none`} value={imobId} onChange={(e) => setImobId(e.target.value)}>
                <option value="" className="text-slate-900">
                  Selecione a sua imobiliária
                </option>
                {imobiliarias.map((i) => (
                  <option key={i.id} value={i.id} className="text-slate-900">
                    {i.nome}
                  </option>
                ))}
                <option value="outra" className="text-slate-900">
                  Outra (não está na lista)
                </option>
              </select>
            </label>
            {imobId === "outra" ? (
              <input className={input} value={imobOutra} onChange={(e) => setImobOutra(e.target.value)} placeholder="Nome da imobiliária" />
            ) : null}
            <div>
              <Rotulo>Você é</Rotulo>
              <div className="grid grid-cols-2 gap-3">
                {FUNCOES_CORRETOR.map((f) => (
                  <Opcao key={f.value} selecionada={funcao === f.value} onClick={() => setFuncao(f.value)}>
                    <span className="block text-lg font-black">{f.label}</span>
                    <span className="text-sm font-normal text-white/60">{f.descricao}</span>
                  </Opcao>
                ))}
              </div>
            </div>
            <Botao onClick={iniciar} disabled={enviando || nome.trim().length < 3 || telefone.replace(/\D/g, "").length < 10}>
              {enviando ? "Confirmando…" : "Continuar →"}
            </Botao>
          </>
        ) : null}

        {etapa === "imobiliaria" ? (
          <>
            <Titulo sub={`Como proprietário, complete os dados da ${sessao?.imobiliariaNome ?? "imobiliária"}.`}>Dados da imobiliária</Titulo>
            <label className="block">
              <Rotulo>E-mail da imobiliária</Rotulo>
              <input className={input} type="email" value={imob.email} onChange={(e) => setImob({ ...imob, email: e.target.value })} placeholder="contato@imobiliaria.com.br" />
            </label>
            <label className="block">
              <Rotulo>CNPJ (opcional)</Rotulo>
              <input className={input} inputMode="numeric" value={imob.cnpj} onChange={(e) => setImob({ ...imob, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </label>
            <label className="block">
              <Rotulo>Quantos corretores na equipe?</Rotulo>
              <input
                className={input}
                inputMode="numeric"
                value={imob.quantidade_vendedores}
                onChange={(e) => setImob({ ...imob, quantidade_vendedores: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="Ex.: 8"
              />
            </label>
            <div>
              <Rotulo>Modelo de parceria</Rotulo>
              <div className="space-y-2">
                {MODELOS_PARCERIA.map((m) => (
                  <Opcao key={m.value} selecionada={imob.modelo_parceria === m.value} onClick={() => setImob({ ...imob, modelo_parceria: m.value })}>
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-black">{m.label}</span>
                      <span className="text-[#F59E0B]">{m.percentual}</span>
                    </span>
                    <span className="block text-sm font-normal text-white/60">{m.descricao}</span>
                  </Opcao>
                ))}
              </div>
            </div>
            {imob.modelo_parceria && imob.modelo_parceria !== "SOMENTE_LIBERAR_CARTEIRA" ? (
              <label className="block">
                <Rotulo>Chave PIX para comissões</Rotulo>
                <input className={input} value={imob.chave_pix} onChange={(e) => setImob({ ...imob, chave_pix: e.target.value })} placeholder="CNPJ, e-mail, celular ou chave aleatória" />
              </label>
            ) : null}
            <Botao onClick={salvarImob} disabled={enviando}>
              {enviando ? "Salvando…" : "Salvar e continuar →"}
            </Botao>
            <button type="button" onClick={() => setEtapa("clientes")} className="w-full text-center text-sm font-bold text-white/60 hover:text-white">
              Completar depois
            </button>
          </>
        ) : null}

        {etapa === "clientes" ? (
          <>
            <Titulo sub="Cada cliente indicado gera 1 cupom para o sorteio. A meta é 5!">
              {primeiroNome ? `${primeiroNome}, ` : ""}indique seus clientes
            </Titulo>
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-bold uppercase tracking-wide text-white/70">Seus cupons</p>
                <p className="text-sm text-white/60">
                  {clientes.length} de {META_CLIENTES_EVENTO} clientes
                </p>
              </div>
              <div className="mt-2 flex gap-1.5">
                {Array.from({ length: Math.max(META_CLIENTES_EVENTO, clientes.length) }).map((_, i) => (
                  <span key={i} className={`h-2 flex-1 rounded-full ${i < clientes.length ? "bg-[#F59E0B]" : "bg-white/15"}`} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {sessao ? (
                  <span className="rounded-full bg-[#00AEEF]/15 px-3 py-1 text-sm font-bold text-[#7DD3FC]">🎟️ {sessao.cupomPresenca} · presença</span>
                ) : null}
                {clientes.map((c) => (
                  <span key={c.id} className="rounded-full bg-[#F59E0B]/15 px-3 py-1 text-sm font-bold text-[#FCD34D]">
                    🎟️ {c.cupom} · {c.nome.split(/\s+/)[0]}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border-2 border-dashed border-white/15 p-4">
              <p className="font-black">Cliente {clientes.length + 1}</p>
              <input className={input} value={cli.nome} onChange={(e) => setCli({ ...cli, nome: e.target.value })} placeholder="Nome do cliente" />
              <input
                className={input}
                value={cli.telefone}
                onChange={(e) => setCli({ ...cli, telefone: formatWhatsappBrInput(e.target.value) })}
                placeholder="Telefone / WhatsApp"
                inputMode="tel"
              />
              <select className={`${input} appearance-none`} value={cli.empreendimento} onChange={(e) => setCli({ ...cli, empreendimento: e.target.value })}>
                <option value="" className="text-slate-900">
                  Empreendimento SPL (opcional)
                </option>
                {empreendimentos.map((e) => (
                  <option key={e.slug} value={e.slug} className="text-slate-900">
                    {e.nome} · {e.cidade}
                  </option>
                ))}
              </select>
              <Botao onClick={adicionarCliente} disabled={enviando || cli.nome.trim().length < 2 || cli.telefone.replace(/\D/g, "").length < 10}>
                {enviando ? "Gerando cupom…" : clientes.length >= META_CLIENTES_EVENTO ? "+ Adicionar mais clientes" : "+ Adicionar e gerar cupom"}
              </Botao>
            </div>

            {confirmarMenos ? (
              <div className="space-y-3 rounded-2xl bg-[#F59E0B]/10 p-4 ring-1 ring-[#F59E0B]/40">
                <p className="font-bold">
                  Faltam {faltam} {faltam === 1 ? "cliente" : "clientes"} para completar seus {META_CLIENTES_EVENTO} cupons. Quer adicionar agora?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Botao onClick={() => setConfirmarMenos(false)}>Adicionar</Botao>
                  <Botao tipo="contorno" onClick={avancarClientes}>
                    Continuar assim
                  </Botao>
                </div>
              </div>
            ) : (
              <Botao tipo="contorno" onClick={avancarClientes}>
                {concluido ? "Ver meus cupons" : "Seguir para o desafio →"}
              </Botao>
            )}
          </>
        ) : null}

        {etapa === "desafio" ? (
          <>
            {voltar("clientes")}
            <Titulo sub="Escolha uma opção:">Topa o desafio do seu primeiro consórcio?</Titulo>
            <div className="space-y-2">
              {OPCOES_DESAFIO.map((d) => (
                <Opcao key={d.id} selecionada={desafio === d.id} onClick={() => setDesafio(d.id)}>
                  <span className="block text-sm font-bold uppercase tracking-wide text-[#00AEEF]">{d.titulo}</span>
                  <span className="block text-2xl font-black">{brl(d.credito)}</span>
                  <span className="text-white/80">
                    Parcela <b className="text-[#F59E0B]">{brl(d.parcela)}</b> · {d.prazo} parcelas
                  </span>
                </Opcao>
              ))}
              <Opcao selecionada={desafio === DESAFIO_SEM_INTERESSE.id} onClick={() => setDesafio(DESAFIO_SEM_INTERESSE.id)}>
                {DESAFIO_SEM_INTERESSE.titulo}
              </Opcao>
            </div>
            <Botao onClick={() => setEtapa("veiculo")} disabled={!desafio}>
              Continuar →
            </Botao>
          </>
        ) : null}

        {etapa === "veiculo" ? (
          <>
            {voltar("desafio")}
            <Titulo sub="Toque na opção para avançar:">{primeiroNome}, hoje você possui algum veículo?</Titulo>
            <div className="space-y-2">
              {OPCOES_VEICULO.map((o) => (
                <Opcao key={o.id} selecionada={q.veiculo === o.id} onClick={() => escolher("veiculo", o.id, "moradia")}>
                  {o.emoji} {o.label}
                </Opcao>
              ))}
            </div>
          </>
        ) : null}

        {etapa === "moradia" ? (
          <>
            {voltar("veiculo")}
            <Titulo sub="Toque na opção para avançar:">E sobre sua moradia atual?</Titulo>
            <div className="space-y-2">
              {OPCOES_MORADIA.map((o) => (
                <Opcao key={o.id} selecionada={q.moradia === o.id} onClick={() => escolher("moradia", o.id, "capacidade")}>
                  {o.emoji} {o.label}
                </Opcao>
              ))}
            </div>
          </>
        ) : null}

        {etapa === "capacidade" ? (
          <>
            {voltar("moradia")}
            <Titulo sub="Toque na opção para avançar:">
              Pensando em aumentar seu patrimônio, qual valor mensal hoje faria sentido para você investir?
            </Titulo>
            <div className="space-y-2">
              {OPCOES_CAPACIDADE_MENSAL.map((o) => (
                <Opcao key={o.id} selecionada={q.capacidade_mensal === o.id} onClick={() => escolher("capacidade_mensal", o.id, "avaliacao")}>
                  {o.label}
                </Opcao>
              ))}
            </div>
          </>
        ) : null}

        {etapa === "avaliacao" ? (
          <>
            {voltar("capacidade")}
            <Titulo>Como você avalia o conteúdo e as oportunidades apresentadas no encontro?</Titulo>
            <div className="space-y-2">
              {OPCOES_AVALIACAO_ENCONTRO.map((o) => (
                <Opcao
                  key={o.id}
                  selecionada={q.avaliacao_encontro === o.id}
                  onClick={() =>
                    o.id === "pode_melhorar"
                      ? setQ((v) => ({ ...v, avaliacao_encontro: o.id }))
                      : escolher("avaliacao_encontro", o.id, "momento")
                  }
                >
                  {o.label}
                </Opcao>
              ))}
            </div>
            {q.avaliacao_encontro === "pode_melhorar" ? (
              <>
                <textarea
                  className={`${input} min-h-[110px]`}
                  value={q.avaliacao_melhoria}
                  onChange={(e) => setQ({ ...q, avaliacao_melhoria: e.target.value.slice(0, 500) })}
                  placeholder="O que podemos melhorar?"
                />
                <Botao onClick={() => setEtapa("momento")} disabled={q.avaliacao_melhoria.trim().length < 3}>
                  Continuar →
                </Botao>
              </>
            ) : null}
          </>
        ) : null}

        {etapa === "momento" ? (
          <>
            {voltar("avaliacao")}
            <Titulo sub={enviando ? "Gerando seus cupons…" : "Toque para concluir e gerar seus cupons:"}>
              Pensando nas oportunidades apresentadas, qual dessas opções mais combina com o seu momento atual?
            </Titulo>
            <div className="space-y-2">
              {OPCOES_MOMENTO_OPORTUNIDADE.map((o) => (
                <Opcao
                  key={o.id}
                  selecionada={q.momento_oportunidade === o.id}
                  onClick={() => {
                    if (enviando) return;
                    const respostas = { ...q, momento_oportunidade: o.id };
                    setQ(respostas);
                    void finalizar(respostas);
                  }}
                >
                  {o.label}
                </Opcao>
              ))}
            </div>
          </>
        ) : null}

        {etapa === "final" ? (
          <>
            <div className="text-center text-5xl">🎉</div>
            <Titulo sub="Boa sorte no sorteio! Fique de olho no telão.">Tudo certo, {primeiroNome}!</Titulo>
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm font-bold uppercase tracking-wide text-white/70">
                Você está concorrendo com {cupons.length} {cupons.length === 1 ? "cupom" : "cupons"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {cupons.map((c) => (
                  <span key={c} className="rounded-xl bg-[#F59E0B] px-3 py-2 text-lg font-black text-[#3B2302]">
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <Botao tipo="contorno" onClick={() => setEtapa("clientes")}>
              + Indicar mais clientes e ganhar mais cupons
            </Botao>
          </>
        ) : null}

        {erro ? (
          <p role="alert" className="rounded-2xl border border-red-400/40 bg-red-500/15 px-4 py-3 font-semibold text-red-100">
            {erro}
          </p>
        ) : null}
      </div>
      <p className="border-t border-white/10 px-5 py-3 text-center text-xs text-white/40">
        Dados usados apenas para contato comercial · Sorteio de brindes
      </p>
    </div>
  );
}
