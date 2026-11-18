"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  atualizarUsuarioAction,
  cadastrarUsuarioAction,
  decidirExclusaoAction,
  decidirReservaAction,
  solicitarExclusaoAction,
  gerarConviteAction,
  permissaoEnvioAction,
  salvarPerfilAction,
  salvarConfigAction,
  statusCotaAction,
} from "@/app/(landing-contempladas)/contempladas/actions";
import type { ConfigContempladas, CotaPortal } from "@/lib/contempladas/repo";
import type { Acrescimo } from "@/lib/contempladas/motor";
import { brl, btnOuro, btnSec, Card, inputCls, PixInput, Sair, TelInput, mascaraTelefone, type TipoPix } from "./ui";

type Reserva = { id: string; tipo: "PRE" | "PIX"; nome: string; telefone: string; cotaIds: string[]; expiraEm: string | null; criadaEm: string; valorPix: number | null; comprovanteUrl: string | null };
type Proposta = { numero: number; cliente: string | null; vendedor: string | null; credito: number; entrada: number; desconto: number; rentabilidade: number; vendida: boolean; criadaEm: string };
type Membro = { id: string; nome: string; email: string; telefone: string | null; papel: "GERENTE" | "VENDEDOR"; ativo: boolean };
type UsuarioErp = { id: string; nome: string; email: string; perfil: string; contempladas_pode_enviar: boolean };
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

type Aba = "reservas" | "cotas" | "propostas" | "equipe" | "config" | "meu";

function SeletorValor({ valor, onChange, rotuloPct = "% do crédito" }: { valor: Acrescimo; onChange: (v: Acrescimo) => void; rotuloPct?: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2">
      <select className={`${inputCls} !w-36`} value={valor.tipo} onChange={(e) => onChange({ ...valor, tipo: e.target.value as Acrescimo["tipo"] })}>
        <option value="FIXO">Valor fixo R$</option>
        <option value="PERCENTUAL">{rotuloPct}</option>
      </select>
      <input className={inputCls} type="number" step="0.01" min={0} value={valor.valor} onChange={(e) => onChange({ ...valor, valor: Number(e.target.value) })} />
    </div>
  );
}

export function Painel(props: {
  papel: "DONO" | "GERENTE" | "VENDEDOR";
  adicional: Acrescimo;
  telefone: string | null;
  logoUrl: string | null;
  reservas: Reserva[];
  cotas: CotaPortal[];
  config: ConfigContempladas | null;
  stats: { simulacoes: number; preReservas: number; reservasPix: number; vendidas: number };
  propostas: Proposta[];
  equipe: Membro[];
  usuariosErp: UsuarioErp[];
  vendas: { total: number; noMes: number; creditoTotal: number } | null;
}) {
  const router = useRouter();
  const gerencia = props.papel !== "VENDEDOR";
  const [aba, setAba] = useState<Aba>(gerencia ? "reservas" : "propostas");
  const [busca, setBusca] = useState("");
  const [pend, start] = useTransition();
  const [cfg, setCfg] = useState(props.config);
  const [mesmoAgio, setMesmoAgio] = useState(
    !props.config || (props.config.agio_tipo === props.config.agio_auto_tipo && props.config.agio_valor === props.config.agio_auto_valor),
  );
  const [adicional, setAdicional] = useState(props.adicional);
  const [tel, setTel] = useState(mascaraTelefone(props.telefone ?? ""));
  const [aviso, setAviso] = useState<string | null>(null);
  const [novo, setNovo] = useState({ nome: "", email: "", telefone: "", senha: "", papel: "VENDEDOR" as "GERENTE" | "VENDEDOR" });
  const [convite, setConvite] = useState<string | null>(null);
  const porId = new Map(props.cotas.map((c) => [c.id, c]));
  const [filtroCota, setFiltroCota] = useState<"DISPONIVEL" | "RESERVADA" | "VENDIDA" | "TODAS">("DISPONIVEL");
  const pedidos = props.cotas.filter((c) => c.exclusao_solicitada_em && c.status !== "INATIVA");
  const agir = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        await fn();
        if (ok) setAviso(ok);
        router.refresh();
      } catch (e) {
        setAviso(`⚠️ ${e instanceof Error ? e.message : "Erro"}`);
      }
    });

  const vendidas = props.propostas.filter((p) => p.vendida);
  const somaVendida = vendidas.reduce((s, p) => s + p.rentabilidade, 0);
  const somaAberta = props.propostas.filter((p) => !p.vendida).reduce((s, p) => s + p.rentabilidade, 0);

  const abas: [Aba, string][] = gerencia
    ? [["reservas", `Reservas (${props.reservas.length})`], ["cotas", "Cotas"], ["propostas", "Propostas"], ["equipe", "Equipe"], [ "config", props.papel === "DONO" ? "Configurar" : "Minha unidade"], ["meu", "Meu perfil"]]
    : [["propostas", "Minhas propostas"], ["meu", "Meu perfil"]];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(gerencia
          ? [["Simulações", props.stats.simulacoes], ["Pré-reservas", props.stats.preReservas], ["PIX a conferir", props.stats.reservasPix], ["Vendidas no mês", `${props.vendas?.noMes ?? 0} de ${props.vendas?.total ?? 0}`]]
          : [["Propostas", props.propostas.length], ["Vendidas", vendidas.length], ["Comissões recebidas", brl(somaVendida)], ["Em aberto", brl(somaAberta)]]
        ).map(([l, v]) => (
          <Card key={l as string} className="!p-3"><p className="text-xl font-black text-[#0047bb]">{v}</p><p className="text-[11px] uppercase text-slate-500">{l}</p></Card>
        ))}
      </div>

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (busca) router.push(`/contempladas/p/${busca.replace(/\D/g, "")}`); }}>
        <input className={inputCls} inputMode="numeric" placeholder="Nº da proposta para reimprimir" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className={btnOuro}>Abrir</button>
      </form>

      <div className="flex gap-1 overflow-x-auto">
        {abas.map(([k, l]) => (
          <button key={k} onClick={() => { setAba(k); setAviso(null); }} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${aba === k ? "bg-[#0047bb] text-white" : "bg-slate-50"}`}>{l}</button>
        ))}
        <span className="ml-auto self-center pl-2"><Sair /></span>
      </div>
      {aviso && <p className="text-sm">{aviso}</p>}

      {aba === "reservas" && gerencia && (
        <div className="space-y-2">
          {!props.reservas.length && <Card className="text-center text-slate-500">Nenhuma reserva ativa.</Card>}
          {props.reservas.map((r) => {
            const cs = r.cotaIds.map((id) => porId.get(id)).filter(Boolean) as CotaPortal[];
            return (
              <Card key={r.id} className={r.tipo === "PIX" ? "border-emerald-300" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#0047bb]">{r.tipo === "PIX" ? "Em análise · PIX enviado, cota bloqueada" : "Pré-reserva"}</p>
                    <p className="font-bold">{r.nome}</p>
                    <a className="text-sm text-emerald-700 underline" href={`https://wa.me/55${r.telefone}`} target="_blank" rel="noreferrer">{r.telefone}</a>
                  </div>
                  {r.expiraEm && <p className="text-right text-xs text-slate-500">expira<br />{new Date(r.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
                </div>
                <p className="mt-2 text-sm">{cs.map((c) => `${c.codigo} ${brl(c.credito)}`).join(" + ")}</p>
                {r.valorPix != null && <p className="text-sm">PIX esperado: <b>{brl(r.valorPix)}</b></p>}
                {r.comprovanteUrl && <a className="mt-1 inline-block text-sm text-[#0047bb] underline" href={r.comprovanteUrl} target="_blank" rel="noreferrer">Ver comprovante</a>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button disabled={pend} className="rounded-xl bg-emerald-500 py-3 font-bold text-white" onClick={() => agir(() => decidirReservaAction(r.id, "VENDIDA"))}>✔ Vendida</button>
                  <button disabled={pend} className="rounded-xl border border-slate-300 py-3 font-semibold" onClick={() => agir(() => decidirReservaAction(r.id, "CANCELAR"))}>{r.tipo === "PIX" ? "Liberar" : "Remover"}</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {aba === "cotas" && gerencia && (
        <div className="space-y-3">
          <a href="/contempladas/importar" className={`${btnOuro} block text-center`}>+ Incluir cotas</a>

          {props.papel === "DONO" && pedidos.length > 0 && (
            <Card className="space-y-2 border-amber-300 bg-amber-50">
              <p className="font-bold text-amber-900">Pedidos de exclusão ({pedidos.length})</p>
              {pedidos.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
                  <span><b>{c.codigo}</b> · {brl(c.credito)} · {c.dono_nome ?? "—"}<span className="block text-xs text-slate-500">Pedido por {c.exclusao_solicitada_por} em {dataHora(c.exclusao_solicitada_em)}{c.exclusao_motivo ? ` · “${c.exclusao_motivo}”` : ""}</span></span>
                  <span className="flex gap-2">
                    <button className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white" disabled={pend} onClick={() => agir(async () => { const r = await decidirExclusaoAction(c.id, true); if (!r.ok) throw new Error(r.erro); })}>Aprovar exclusão</button>
                    <button className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold" disabled={pend} onClick={() => agir(async () => { const r = await decidirExclusaoAction(c.id, false); if (!r.ok) throw new Error(r.erro); })}>Recusar</button>
                  </span>
                </div>
              ))}
            </Card>
          )}

          <div className="flex flex-wrap gap-1">
            {([["DISPONIVEL", "Disponíveis"], ["RESERVADA", "Em análise"], ["VENDIDA", "Vendidas"], ["TODAS", "Todas"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFiltroCota(k)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filtroCota === k ? "bg-[#0a2a66] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
                {l} ({k === "TODAS" ? props.cotas.length : props.cotas.filter((c) => c.status === k).length})
              </button>
            ))}
          </div>

          {props.cotas.filter((c) => filtroCota === "TODAS" || c.status === filtroCota).map((c) => (
            <Card key={c.id} className="!p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{c.tipo === "automovel" ? "🚗" : "🏠"}</span>
                  <div>
                    <p className="text-lg font-black text-[#0a2a66]">{brl(c.credito)}</p>
                    <p className="text-xs text-slate-500">{c.codigo} · <span className="capitalize">{c.administradora}</span> · {c.tipo === "automovel" ? "Veículo" : "Imóvel"}{c.dono_nome ? ` · Unidade ${c.dono_nome}` : ""}</p>
                  </div>
                </div>
                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${c.status === "VENDIDA" ? "bg-slate-200 text-slate-700" : c.status === "RESERVADA" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                  {c.status === "RESERVADA" ? "EM ANÁLISE" : c.status === "VENDIDA" ? "VENDIDA" : "DISPONÍVEL"}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
                {[
                  ["Entrada", brl(c.entrada)],
                  ["Entrada administradora", brl(c.entrada_original)],
                  ["Ágio", brl(c.entrada_acrescimo)],
                  ["Parcela", brl(c.parcela)],
                  ["Prazo", `${c.prazo} meses`],
                  ["Saldo devedor", brl(c.saldo_devedor)],
                  ["1º vencimento", c.vencimento_mes ? MESES[c.vencimento_mes - 1] : "—"],
                  ["Comissão", brl(c.comissao_parceiro)],
                  ["Pré-reservas", String(c.preReservas)],
                ].map(([l, v]) => (
                  <div key={l}><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{l}</dt><dd className="font-semibold text-slate-800">{v}</dd></div>
                ))}
              </dl>

              {c.status === "VENDIDA" && (
                <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
                  <p><span className="block text-[11px] font-semibold uppercase text-slate-400">Vendedor</span><b>{c.vendedor_nome ?? "—"}</b></p>
                  <p><span className="block text-[11px] font-semibold uppercase text-slate-400">Gerente / unidade</span><b>{c.dono_nome ?? "—"}</b>{c.vendida_por_nome && c.vendida_por_nome !== c.dono_nome ? <span className="block text-xs text-slate-500">marcada por {c.vendida_por_nome}</span> : null}</p>
                  <p><span className="block text-[11px] font-semibold uppercase text-slate-400">Data e hora</span><b>{dataHora(c.vendida_em)}</b></p>
                </div>
              )}
              {c.exclusao_solicitada_em && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Exclusão pedida em {dataHora(c.exclusao_solicitada_em)}, aguardando o dono do portal.</p>}

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {c.status !== "VENDIDA" && <button disabled={pend} className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white" onClick={() => agir(() => statusCotaAction(c.id, "VENDIDA"))}>✔ Marcar vendida</button>}
                {c.status !== "DISPONIVEL" && <button disabled={pend} className="rounded-lg bg-slate-100 px-4 py-2 font-semibold" onClick={() => agir(() => statusCotaAction(c.id, "DISPONIVEL"))}>{c.status === "VENDIDA" ? "Desfazer venda" : "Liberar"}</button>}
                {props.papel === "DONO" ? (
                  <button disabled={pend} className="rounded-lg bg-red-100 px-4 py-2 font-semibold text-red-700" onClick={() => { if (confirm(`Excluir ${c.codigo} do portal?`)) agir(() => statusCotaAction(c.id, "INATIVA")); }}>Excluir</button>
                ) : !c.exclusao_solicitada_em && (
                  <button disabled={pend} className="rounded-lg bg-slate-100 px-4 py-2 font-semibold text-slate-700"
                    onClick={() => { const m = prompt("Motivo da exclusão (vai para o dono do portal):"); if (m !== null) agir(async () => { const r = await solicitarExclusaoAction(c.id, m); if (!r.ok) throw new Error(r.erro); }, "✅ Pedido de exclusão enviado."); }}>Solicitar exclusão</button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {aba === "propostas" && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">A rentabilidade aparece só aqui, nunca na proposta do cliente.</p>
          {!props.propostas.length && <Card className="text-center text-slate-500">Nenhuma proposta ainda.</Card>}
          {props.propostas.map((p) => (
            <a key={p.numero} href={`/contempladas/p/${p.numero}`} className="block">
              <Card className="!p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">nº {p.numero} · {brl(p.credito)}</p>
                    <p className="text-xs text-slate-500">
                      {p.cliente ?? "sem nome"}{gerencia && p.vendedor ? ` · ${p.vendedor}` : ""} · entrada {brl(p.entrada)}{p.desconto > 0 ? ` (desc. ${brl(p.desconto)})` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-700">{brl(p.rentabilidade)}</p>
                    <p className={`text-[11px] font-bold ${p.vendida ? "text-emerald-700" : "text-slate-500"}`}>{p.vendida ? "VENDIDA" : "em aberto"}</p>
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}

      {aba === "meu" && (
        <Card>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("adicional_tipo", adicional.tipo);
            fd.set("adicional_valor", String(adicional.valor));
            agir(async () => { const r = await salvarPerfilAction(fd); if (!r.ok) throw new Error(r.erro); }, "✅ Perfil salvo.");
          }}>
            <div>
              <p className="font-semibold">Logomarca na proposta</p>
              <p className="mb-2 text-xs text-slate-500">Aparece no topo das propostas que você gerar. PNG, JPG ou WEBP até 2 MB.</p>
              {props.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={props.logoUrl} alt="Logo atual" className="mb-2 h-16 rounded-lg bg-white p-2 object-contain" />
              )}
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className={inputCls} />
              {props.logoUrl && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" name="remover_logo" value="1" /> remover logo atual</label>}
            </div>
            <div>
              <p className="font-semibold">Seu WhatsApp</p>
              <p className="mb-1 text-xs text-slate-500">Sai na proposta, embaixo da sua assinatura.</p>
              <TelInput name="telefone" value={tel} onChange={setTel} />
            </div>
            <div>
              <p className="font-semibold">Adicional fixo na entrada</p>
              <p className="mb-1 text-xs text-slate-500">Entra sozinho em toda proposta que você gerar logado e soma na sua rentabilidade. O cliente vê só a entrada total.</p>
              <SeletorValor valor={adicional} onChange={setAdicional} />
            </div>
            <button className={`${btnOuro} w-full`} disabled={pend}>Salvar</button>
          </form>
        </Card>
      )}

      {aba === "config" && gerencia && cfg && (
        <Card className="space-y-4">
          <p className="text-sm text-slate-500">
            {props.papel === "DONO"
              ? "Padrão da empresa: vale para as suas cotas e para gerentes que ainda não configuraram a unidade."
              : "Configuração da sua unidade: vale só para as cotas que você sobe."}
          </p>
          <label className="block text-sm font-semibold">Nome da unidade (aparece para o cliente)
            <input className={inputCls} value={cfg.unidade ?? ""} onChange={(e) => setCfg({ ...cfg, unidade: e.target.value })} placeholder="Ex.: Racon Sorriso" />
          </label>

          <div>
            <p className="text-sm font-semibold">Ágio na subida das cotas</p>
            <label className="my-1 flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-[#0047bb]" checked={mesmoAgio}
                onChange={(e) => { setMesmoAgio(e.target.checked); if (e.target.checked) setCfg({ ...cfg, agio_auto_tipo: cfg.agio_tipo, agio_auto_valor: cfg.agio_valor }); }} />
              Mesmo ágio para imóvel e veículo
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><p className="mb-1 text-xs text-slate-500">{mesmoAgio ? "Imóvel e veículo" : "Imóvel"}</p>
                <SeletorValor valor={{ tipo: cfg.agio_tipo, valor: cfg.agio_valor }}
                  onChange={(v) => setCfg({ ...cfg, agio_tipo: v.tipo, agio_valor: v.valor, ...(mesmoAgio ? { agio_auto_tipo: v.tipo, agio_auto_valor: v.valor } : {}) })} /></div>
              {!mesmoAgio && <div><p className="mb-1 text-xs text-slate-500">Veículo</p>
                <SeletorValor valor={{ tipo: cfg.agio_auto_tipo, valor: cfg.agio_auto_valor }} onChange={(v) => setCfg({ ...cfg, agio_auto_tipo: v.tipo, agio_auto_valor: v.valor })} /></div>}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold">Sinal para bloquear a negociação (opcional)</p>
            <p className="mb-1 text-xs text-slate-500">PIX que o cliente paga para travar a cota. Em branco ou zero: o PIX é a entrada inteira.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-500">Imóvel (R$)<input className={inputCls} type="number" min={0} step="0.01" value={cfg.sinal_imovel || ""} onChange={(e) => setCfg({ ...cfg, sinal_imovel: Number(e.target.value) })} /></label>
              <label className="text-xs text-slate-500">Veículo (R$)<input className={inputCls} type="number" min={0} step="0.01" value={cfg.sinal_auto || ""} onChange={(e) => setCfg({ ...cfg, sinal_auto: Number(e.target.value) })} /></label>
            </div>
          </div>

          <label className="block text-sm font-semibold">Comissão paga ao vendedor
            <select className={inputCls} value={cfg.comissao_modo} onChange={(e) => setCfg({ ...cfg, comissao_modo: e.target.value as ConfigContempladas["comissao_modo"] })}>
              <option value="TABELA">A comissão de cada cota (tabela)</option>
              <option value="PERCENTUAL">Percentual sobre o crédito</option>
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {cfg.comissao_modo === "PERCENTUAL" && (
              <label className="block text-sm">% do crédito<input className={inputCls} type="number" step="0.01" value={cfg.comissao_percentual} onChange={(e) => setCfg({ ...cfg, comissao_percentual: Number(e.target.value) })} /></label>
            )}
            <label className="block text-sm">Repasse ao vendedor (%)<input className={inputCls} type="number" value={cfg.comissao_repasse_percentual} onChange={(e) => setCfg({ ...cfg, comissao_repasse_percentual: Number(e.target.value) })} /></label>
          </div>
          <label className="block text-sm font-semibold">WhatsApp de reservas da unidade
            <TelInput value={mascaraTelefone(cfg.whatsapp ?? "")} onChange={(v) => setCfg({ ...cfg, whatsapp: v })} />
          </label>
          <div className="block text-sm font-semibold">Chave PIX da unidade
            <PixInput tipo={cfg.chave_pix_tipo as TipoPix} valor={cfg.chave_pix ?? ""} onChange={(t, v) => setCfg({ ...cfg, chave_pix_tipo: t, chave_pix: v })} />
          </div>
          <label className="block text-sm font-semibold">Favorecido (nome que aparece no PIX)<input className={inputCls} value={cfg.favorecido_pix ?? ""} onChange={(e) => setCfg({ ...cfg, favorecido_pix: e.target.value })} /></label>
          {props.papel === "DONO" && (
            <label className="block text-sm font-semibold">Tempo da pré-reserva (minutos, vale para todas as unidades)
              <input className={inputCls} type="number" min={5} value={cfg.pre_reserva_minutos} onChange={(e) => setCfg({ ...cfg, pre_reserva_minutos: Number(e.target.value) })} />
            </label>
          )}
          <button className={`${btnOuro} w-full`} disabled={pend} onClick={() => agir(async () => { const r = await salvarConfigAction(cfg); if (!r.ok) throw new Error(r.erro); }, "✅ Configuração salva.")}>Salvar</button>
        </Card>
      )}

      {aba === "equipe" && gerencia && (
        <div className="space-y-3">
          <Card className="space-y-2">
            <p className="font-semibold">Link de cadastro</p>
            <p className="text-xs text-slate-500">Vale 7 dias. Quem se cadastra pelo link entra só no portal, sem acesso ao ERP.</p>
            <div className="grid grid-cols-2 gap-2">
              <button className={btnSec} disabled={pend} onClick={() => start(async () => { const r = await gerarConviteAction("VENDEDOR"); if (r.ok) setConvite(`${location.origin}/contempladas/cadastro/${r.token}`); })}>Link de vendedor</button>
              {props.papel === "DONO" && (
                <button className={btnSec} disabled={pend} onClick={() => start(async () => { const r = await gerarConviteAction("GERENTE"); if (r.ok) setConvite(`${location.origin}/contempladas/cadastro/${r.token}`); })}>Link de gerente</button>
              )}
            </div>
            {convite && (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
                <p className="select-all break-all">{convite}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button className={btnSec} onClick={() => navigator.clipboard.writeText(convite)}>Copiar</button>
                  <a className={`${btnSec} text-center`} href={`https://wa.me/?text=${encodeURIComponent(`Seu cadastro no portal de cotas contempladas: ${convite}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                </div>
              </div>
            )}
          </Card>

          <Card className="space-y-2">
            <p className="font-semibold">Cadastrar agora</p>
            <input className={inputCls} placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
            <input className={inputCls} type="email" placeholder="E-mail (login)" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
            <TelInput value={novo.telefone} onChange={(v) => setNovo({ ...novo, telefone: v })} />
            <input className={inputCls} placeholder="Senha inicial (mín. 8)" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} />
            {props.papel === "DONO" && (
              <select className={inputCls} value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as "GERENTE" | "VENDEDOR" })}>
                <option value="VENDEDOR">Vendedor</option>
                <option value="GERENTE">Gerente</option>
              </select>
            )}
            <button className={`${btnOuro} w-full`} disabled={pend}
              onClick={() => start(async () => {
                const r = await cadastrarUsuarioAction(novo);
                setAviso(r.ok ? `✅ ${novo.nome} cadastrado. Login: ${novo.email}` : `⚠️ ${r.erro}`);
                if (r.ok) { setNovo({ nome: "", email: "", telefone: "", senha: "", papel: "VENDEDOR" }); router.refresh(); }
              })}>Cadastrar</button>
          </Card>

          <Card className="space-y-1">
            <p className="mb-1 font-semibold">Usuários do portal</p>
            {!props.equipe.length && <p className="text-sm text-slate-500">Ninguém cadastrado ainda.</p>}
            {props.equipe.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 border-t border-slate-100 py-2">
                <span className="text-sm"><b>{m.nome}</b><span className="block text-xs text-slate-500">{m.email} · {m.papel === "GERENTE" ? "gerente" : "vendedor"}</span></span>
                <div className="flex gap-1">
                  {props.papel === "DONO" && (
                    <button className="rounded-lg bg-slate-100 px-2 py-1 text-xs" disabled={pend} onClick={() => agir(() => atualizarUsuarioAction(m.id, { papel: m.papel === "GERENTE" ? "VENDEDOR" : "GERENTE" }))}>
                      {m.papel === "GERENTE" ? "→ vendedor" : "→ gerente"}
                    </button>
                  )}
                  <button className={`rounded-lg px-2 py-1 text-xs ${m.ativo ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"}`} disabled={pend} onClick={() => agir(() => atualizarUsuarioAction(m.id, { ativo: !m.ativo }))}>
                    {m.ativo ? "Bloquear" : "Ativar"}
                  </button>
                </div>
              </div>
            ))}
          </Card>

          {props.papel === "DONO" && props.usuariosErp.length > 0 && (
            <Card className="space-y-1">
              <p className="mb-1 font-semibold">Usuários do ERP com gerência no portal</p>
              {props.usuariosErp.map((u) => (
                <label key={u.id} className="flex items-center justify-between gap-2 border-t border-slate-100 py-2">
                  <span className="text-sm"><b>{u.nome}</b><span className="block text-xs text-slate-500">{u.email} · {u.perfil}</span></span>
                  <input type="checkbox" className="h-6 w-6 accent-[#0047bb]" disabled={pend || u.perfil === "master"} checked={u.perfil === "master" || u.contempladas_pode_enviar}
                    onChange={(e) => agir(() => permissaoEnvioAction(u.id, e.target.checked))} />
                </label>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
